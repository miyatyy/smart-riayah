/**
 * BARCODE & QR CODE GATE PASS GENERATOR UTILITY
 * Menghasilkan token resmi Gate Pass serta gambar QR Code & Barcode Code 128
 * secara LOKAL & INSTAN (< 5ms) tanpa blocking request ke server eksternal,
 * sambil tetap menyediakan URL eksternal untuk lampiran media WhatsApp (Fonnte).
 */

import QRCode from 'qrcode';

const qrDataUrlCache = new Map();
const code128DataUrlCache = new Map();

// Tabel pola bar/space Code 128 standar ISO/IEC 15417 (index 0..106)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export function encodeCode128B(text) {
  const clean = String(text || '').replace(/[^\x20-\x7F]/g, '') || 'SR-GATEPASS';
  const START_B = 104;
  const STOP = 106;
  const codes = [START_B];
  let checksum = START_B;

  for (let i = 0; i < clean.length; i += 1) {
    const code = clean.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP);

  return {
    text: clean,
    modules: codes.map(c => CODE128_PATTERNS[c]).join('')
  };
}

/**
 * Gambar Barcode 1D Code 128 langsung ke Canvas 2D context (0ms, tanpa network)
 */
export function drawLocalCode128OnCanvas(ctx, text, x, y, width, height, options = {}) {
  const {
    includeText = false,
    textColor = '#0F172A',
    backgroundColor = '#FFFFFF',
    barColor = '#0F172A',
    quietZoneModules = 6
  } = options;

  const { text: clean, modules } = encodeCode128B(text);
  let totalUnits = quietZoneModules * 2;
  for (let i = 0; i < modules.length; i += 1) {
    totalUnits += Number(modules[i]);
  }

  ctx.save();
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(x, y, width, height);

  const labelHeight = includeText ? Math.max(14, Math.round(height * 0.24)) : 0;
  const barAreaHeight = Math.max(16, height - labelHeight - 6);
  const unitWidth = width / totalUnits;
  let cursorX = x + quietZoneModules * unitWidth;
  const topY = y + 3;

  ctx.fillStyle = barColor;
  for (let i = 0; i < modules.length; i += 1) {
    const w = Number(modules[i]) * unitWidth;
    if (i % 2 === 0) {
      ctx.fillRect(cursorX, topY, Math.max(w, 0.75), barAreaHeight);
    }
    cursorX += w;
  }

  if (includeText) {
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.max(10, Math.min(13, Math.round(labelHeight * 0.78)))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clean, x + width / 2, y + height - labelHeight / 2);
  }

  ctx.restore();
}

/**
 * Generate Data URL PNG QR Code secara lokal (< 5ms)
 */
export async function generateLocalQrDataUrl(text, size = 320) {
  const payload = String(text || '').trim();
  if (!payload) return '';
  const cacheKey = `${size}:${payload}`;
  if (qrDataUrlCache.has(cacheKey)) {
    return qrDataUrlCache.get(cacheKey);
  }
  const dataUrl = await QRCode.toDataURL(payload, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A',
      light: '#FFFFFF'
    }
  });
  if (qrDataUrlCache.size >= 100) {
    const firstKey = qrDataUrlCache.keys().next().value;
    qrDataUrlCache.delete(firstKey);
  }
  qrDataUrlCache.set(cacheKey, dataUrl);
  return dataUrl;
}

/**
 * Generate Data URL PNG Barcode 1D Code 128 secara lokal (< 2ms)
 */
export function generateLocalCode128DataUrl(text, width = 360, height = 84, includeText = true) {
  const payload = String(text || '').trim();
  if (!payload || typeof document === 'undefined') return '';
  const cacheKey = `${width}x${height}:${includeText ? 1 : 0}:${payload}`;
  if (code128DataUrlCache.has(cacheKey)) {
    return code128DataUrlCache.get(cacheKey);
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    drawLocalCode128OnCanvas(ctx, payload, 0, 0, width, height, { includeText });
    const dataUrl = canvas.toDataURL('image/png');
    if (code128DataUrlCache.size >= 100) {
      const firstKey = code128DataUrlCache.keys().next().value;
      code128DataUrlCache.delete(firstKey);
    }
    code128DataUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return '';
  }
}

/**
 * Menghasilkan kode unik token kupon kunjungan
 * Format baru: SR-YYYYMMDD-XXXX-XXXX (contoh: SR-20261107-3654-A9F2)
 */
export function generateBarcodeToken(santriName = 'SANTRI') {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `SR-${dateStr}-${randomNum}-${randomHex}`;
}

/**
 * Menghasilkan direct URL ke halaman verifikasi E-Kupon Smart Riayah
 */
export function getGatePassDirectUrl(token) {
  if (!token) return '';
  const cleanToken = String(token).trim();
  const origin = (typeof window !== 'undefined' && window.location?.origin)
    ? window.location.origin
    : 'https://smart-riayah.vercel.app';

  return `${origin}/?gatepass=${encodeURIComponent(cleanToken)}`;
}

/**
 * Ekstraksi token kupon dari URL saat halaman dibuka
 * Mendukung format:
 * - Query param: ?gatepass=SR-... atau ?token=SR-...
 * - Pathname: /gate-pass/SR-...
 * - Hash: #/gate-pass/SR-... atau #gatepass=SR-...
 */
export function getGatePassTokenFromUrl() {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Cek Query Param (?gatepass=... atau ?token=...)
    const params = new URLSearchParams(window.location.search);
    const paramToken = params.get('gatepass') || params.get('token') || params.get('pass');
    if (paramToken && paramToken.trim()) {
      return decodeURIComponent(paramToken.trim());
    }

    // 2. Cek Pathname (/gate-pass/:token)
    const pathname = window.location.pathname || '';
    const matchPath = pathname.match(/\/gate-pass\/([^/?#]+)/i);
    if (matchPath && matchPath[1]) {
      return decodeURIComponent(matchPath[1].trim());
    }

    // 3. Cek Hash (#/gate-pass/:token atau #gatepass=...)
    const hash = window.location.hash || '';
    const matchHashPath = hash.match(/gate-pass\/([^/?#]+)/i);
    if (matchHashPath && matchHashPath[1]) {
      return decodeURIComponent(matchHashPath[1].trim());
    }
    const hashParams = new URLSearchParams(hash.replace(/^#\/?/, ''));
    const hashToken = hashParams.get('gatepass') || hashParams.get('token');
    if (hashToken && hashToken.trim()) {
      return decodeURIComponent(hashToken.trim());
    }
  } catch (err) {
    console.warn('Gagal membaca token kupon dari URL:', err);
  }

  return null;
}

/**
 * Menghasilkan URL QR Code (Direct Link) & Barcode Linear (Code 128)
 */
export function getVisitGatePassUrls(token) {
  if (!token) {
    return {
      gatePassUrl: '',
      qrCodeUrl: '',
      linearBarcodeUrl: ''
    };
  }
  const cleanToken = String(token).trim();
  const directUrl = getGatePassDirectUrl(cleanToken);
  const encodedDirectUrl = encodeURIComponent(directUrl);
  const encodedToken = encodeURIComponent(cleanToken);

  return {
    gatePassUrl: directUrl,
    // QR Code 2D: Menyimpan direct link URL sehingga kamera HP / Google Lens langsung membuka browser
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodedDirectUrl}&format=png`,
    // Barcode 1D (Code 128): Menyimpan teks token murni untuk scanner laser USB Pos Satpam
    linearBarcodeUrl: `https://quickchart.io/barcode?type=code128&text=${encodedToken}&includeText=true&height=75`
  };
}

export function getBarcodeImageUrl(token, type = 'qr') {
  if (!token) return '';
  const cleanToken = String(token).trim();
  if (type === '128' || type === 'barcode' || type === 'linear') {
    return `https://quickchart.io/barcode?type=code128&text=${encodeURIComponent(cleanToken)}&includeText=true&height=75`;
  }
  const directUrl = getGatePassDirectUrl(cleanToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(directUrl)}&format=png`;
}

/**
 * Download file gambar barcode / QR Code secara lokal ke perangkat user
 */
export async function downloadBarcodeImage(imageUrl, filename = 'Barcode_Gate_Pass.png') {
  if (!imageUrl) return false;
  try {
    if (String(imageUrl).startsWith('data:')) {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }

    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    // Fallback: buka di tab baru jika CORS membatasi fetch
    window.open(imageUrl, '_blank');
    return false;
  }
}
