/**
 * BARCODE & QR CODE GATE PASS GENERATOR UTILITY
 * Menghasilkan token resmi Gate Pass serta URL gambar QR Code & Barcode Code 128
 * yang 100% nyata dan dapat dipindai oleh scanner barcode USB / kamera smartphone.
 * 
 * UPDATE: QR Code sekarang langsung mengarah ke halaman verifikasi resmi Smart Riayah
 * (Direct Gate Pass Link) sehingga kamera HP, Google Lens, & Scanner otomatis
 * membuka halaman kupon & status tiket secara real-time.
 */

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
  try {
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
