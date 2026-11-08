/**
 * Smart Ri'ayah - Fonnte API Gateway Client Service
 * Menghubungkan dashboard ke Endpoint Backend Proxy (/api/whatsapp/fonnte/...)
 * dengan Seamless Direct Fallback ke https://api.fonnte.com
 */

const DEFAULT_TOKEN = (import.meta.env.VITE_FONNTE_TOKEN || '').trim();

function getStoredToken(customToken) {
  if (customToken && typeof customToken === 'string' && customToken.trim()) {
    return customToken.trim();
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('sr_fonnte_token');
    if (!saved || saved === 'XvFjdLyyvBgNUbXBZYzZ') {
      if (DEFAULT_TOKEN) localStorage.setItem('sr_fonnte_token', DEFAULT_TOKEN);
      return DEFAULT_TOKEN;
    }
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_TOKEN;
}

export function normalizePhone(raw) {
  let clean = String(raw || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('08')) {
    clean = '628' + clean.slice(2);
  } else if (clean.startsWith('8')) {
    clean = '628' + clean.slice(1);
  }
  return clean;
}

/**
 * 1. Refresh Status Koneksi Device Fonnte
 */
export async function fetchDeviceStatus(customToken = null) {
  const token = getStoredToken(customToken);

  // 1. Coba lewat backend proxy
  try {
    const res = await fetch('/api/whatsapp/fonnte/status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fonnte-token': token,
      },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.success !== undefined || data.status !== undefined)) {
        return {
          success: data.success,
          status: data.status || (data.isConnected ? 'connect' : 'disconnect'),
          isConnected: data.isConnected || data.status === 'connect',
          device: data.device || '6285960213654',
          name: data.name || 'SmartRIAYAH',
          quota: data.quota || '1000',
          messages: data.messages != null ? data.messages : 0,
          package: data.package || 'Free',
          expired: data.expired || '7 Dec 2026',
          raw: data.raw || data,
          log: data.log || null
        };
      }
    }
  } catch (backendErr) {
    console.warn('⚠️ [Fonnte Service] Backend proxy status unavailable, trying direct API:', backendErr.message);
  }

  // 2. Direct Fallback ke Fonnte Official API
  try {
    const directRes = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: { Authorization: token },
    });
    const directData = await directRes.json().catch(() => ({}));
    const isConnected = directData.device_status === 'connect';

    return {
      success: directRes.ok && (directData.status === true || directData.status === 'true'),
      status: directData.device_status || (isConnected ? 'connect' : 'disconnect'),
      isConnected,
      device: directData.device || '6285960213654',
      name: directData.name || 'SmartRIAYAH',
      quota: directData.quota || (directData.messages != null ? String(directData.messages) : '1000'),
      messages: directData.messages != null ? directData.messages : 0,
      package: directData.package || 'Free',
      expired: directData.expired || '7 Dec 2026',
      raw: directData,
      log: !isConnected ? {
        event: 'device disconnected',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        details: 'Perangkat WhatsApp terdeteksi terputus dari server WhatsApp'
      } : null
    };
  } catch (directErr) {
    console.error('❌ [Fonnte Service] Direct status check failed:', directErr);
    return {
      success: false,
      status: 'disconnect',
      isConnected: false,
      device: '6285960213654',
      name: 'SmartRIAYAH',
      quota: '1000',
      messages: 0,
      package: 'Free',
      expired: '7 Dec 2026',
      error: directErr.message,
      log: {
        event: 'device disconnected',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        details: `Koneksi ke server WhatsApp gagal: ${directErr.message}`
      }
    };
  }
}

/**
 * 2. Ambil QR Code resmi dari Fonnte (Base64)
 */
export async function fetchQrCode(whatsappNumber = '', customToken = null) {
  const token = getStoredToken(customToken);
  const cleanPhone = whatsappNumber ? normalizePhone(whatsappNumber) : '';

  // 1. Coba lewat backend proxy
  try {
    const res = await fetch('/api/whatsapp/fonnte/qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fonnte-token': token,
      },
      body: JSON.stringify({ token, whatsapp: cleanPhone }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.qrImage || data.status)) {
        return data;
      }
    }
  } catch (backendErr) {
    console.warn('⚠️ [Fonnte Service] Backend proxy QR unavailable, trying direct API:', backendErr.message);
  }

  // 2. Direct Fallback
  try {
    const formData = new FormData();
    formData.append('type', 'qr');
    if (cleanPhone) formData.append('whatsapp', cleanPhone);

    const directRes = await fetch('https://api.fonnte.com/qr', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });
    const directData = await directRes.json().catch(() => ({}));

    if (directData.url) {
      return {
        success: true,
        status: 'qr',
        qrImage: directData.url.startsWith('data:image') ? directData.url : `data:image/png;base64,${directData.url}`,
        code: directData.code || null,
        message: 'QR Code resmi WhatsApp berhasil dimuat',
        raw: directData
      };
    }

    const msg = (directData.message || directData.reason || '').toLowerCase();
    if (directData.connected === true || msg.includes('already connected') || msg.includes('device connected')) {
      return {
        success: true,
        status: 'connected',
        isConnected: true,
        message: 'Device already connected',
        raw: directData
      };
    }

    return {
      success: false,
      status: 'error',
      message: directData.reason || directData.message || 'Gagal memuat QR Code WhatsApp',
      raw: directData
    };
  } catch (directErr) {
    console.error('❌ [Fonnte Service] Direct QR fetch failed:', directErr);
    return {
      success: false,
      status: 'error',
      message: `Gagal memuat QR: ${directErr.message}`
    };
  }
}

/**
 * 3. Validasi apakah nomor terdaftar di WhatsApp
 */
export async function validateWhatsappNumber(phoneNumber, customToken = null) {
  const token = getStoredToken(customToken);
  const normalized = normalizePhone(phoneNumber);

  if (!normalized) {
    return {
      success: false,
      message: 'Nomor WhatsApp wajib diisi!'
    };
  }

  // 1. Coba lewat backend proxy
  try {
    const res = await fetch('/api/whatsapp/fonnte/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fonnte-token': token,
      },
      body: JSON.stringify({ token, phone: normalized }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (backendErr) {
    console.warn('⚠️ [Fonnte Service] Backend proxy validate unavailable, trying direct API:', backendErr.message);
  }

  // 2. Direct Fallback
  try {
    const formData = new FormData();
    formData.append('target', normalized);
    formData.append('countryCode', '62');

    const directRes = await fetch('https://api.fonnte.com/validate', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });
    const data = await directRes.json().catch(() => ({}));

    if (data.reason === 'device disconnected' || (data.status === false && !data.registered)) {
      return {
        success: false,
        isDeviceConnected: false,
        phone: normalized,
        message: data.reason || 'Perangkat WhatsApp sedang terputus. Scan QR terlebih dahulu untuk validasi.',
        raw: data
      };
    }

    const regList = Array.isArray(data.registered) ? data.registered : [];
    const notRegList = Array.isArray(data.not_registered) ? data.not_registered : [];
    const isRegistered = regList.includes(normalized) || (regList.length > 0 && !notRegList.includes(normalized));

    return {
      success: true,
      phone: normalized,
      isRegistered,
      registered: regList,
      not_registered: notRegList,
      message: isRegistered
        ? `Nomor ${normalized} aktif dan terdaftar di WhatsApp.`
        : `Nomor ${normalized} tidak terdaftar di WhatsApp.`,
      raw: data
    };
  } catch (directErr) {
    console.error('❌ [Fonnte Service] Direct validate failed:', directErr);
    return {
      success: false,
      message: `Gagal validasi nomor: ${directErr.message}`
    };
  }
}

/**
 * 4. Putus Koneksi Perangkat Fonnte (Disconnect)
 */
export async function disconnectFonnteDevice(customToken = null) {
  const token = getStoredToken(customToken);

  // 1. Coba lewat backend proxy
  try {
    const res = await fetch('/api/whatsapp/fonnte/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fonnte-token': token,
      },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (backendErr) {
    console.warn('⚠️ [Fonnte Service] Backend proxy disconnect unavailable, trying direct API:', backendErr.message);
  }

  // 2. Direct Fallback
  try {
    const directRes = await fetch('https://api.fonnte.com/disconnect', {
      method: 'POST',
      headers: { Authorization: token },
    });
    const directData = await directRes.json().catch(() => ({}));

    return {
      success: true,
      status: 'disconnected',
      isConnected: false,
      message: directData.detail || directData.message || 'Perangkat WhatsApp berhasil diputuskan',
      log: {
        event: 'device disconnected (manual)',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        details: 'Admin melakukan pemutusan manual tautan WhatsApp dari dashboard'
      },
      raw: directData
    };
  } catch (directErr) {
    console.error('❌ [Fonnte Service] Direct disconnect failed:', directErr);
    return {
      success: false,
      message: `Gagal memutuskan perangkat: ${directErr.message}`
    };
  }
}

/**
 * 5. Kirim Pesan Manual Override WhatsApp
 */
export async function sendManualOverrideMessage(target, message, customToken = null, mediaUrl = null) {
  const token = getStoredToken(customToken);
  const normalized = normalizePhone(target);

  if (!normalized || !message) {
    return {
      success: false,
      message: 'Target nomor dan isi pesan wajib diisi!'
    };
  }

  // 1. Coba lewat backend proxy
  try {
    const res = await fetch('/api/whatsapp/fonnte/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fonnte-token': token,
      },
      body: JSON.stringify({ token, target: normalized, message, url: mediaUrl || undefined }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (backendErr) {
    console.warn('⚠️ [Fonnte Service] Backend proxy send unavailable, trying direct API:', backendErr.message);
  }

  // 2. Direct Fallback
  try {
    const formData = new FormData();
    formData.append('target', normalized);
    formData.append('message', message);
    formData.append('countryCode', '62');
    formData.append('preview', 'false');
    if (mediaUrl) {
      formData.append('url', mediaUrl);
    }

    const directRes = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });
    const directData = await directRes.json().catch(() => ({}));
    const isSuccess = directRes.ok && (directData.status === true || directData.status === 'true' || Boolean(directData.id));

    return {
      success: isSuccess,
      target: normalized,
      data: directData,
      log: isSuccess ? {
        event: 'outbound success',
        severity: 'info',
        timestamp: new Date().toISOString(),
        details: `Pesan manual override AI Inbox terkirim ke ${normalized}`
      } : {
        event: 'outbound failed',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        details: `Gagal mengirim ke ${normalized}: ${directData.reason || directData.message || 'Error response'}`
      }
    };
  } catch (directErr) {
    console.error('❌ [Fonnte Service] Direct send failed:', directErr);
    return {
      success: false,
      message: `Gagal mengirim pesan: ${directErr.message}`
    };
  }
}

