/**
 * Vercel Serverless Function: /api/whatsapp/fonnte/[action]
 * Handles status, qr, validate, disconnect, send for Fonnte WhatsApp Gateway
 */

function resolveFonnteToken(req) {
  const headerToken = req.headers['x-fonnte-token'] || req.headers['authorization'];
  if (headerToken) {
    const clean = headerToken.replace(/^Bearer\s+/i, '').trim();
    if (clean) return clean;
  }
  if (req.body?.token && typeof req.body.token === 'string') {
    return req.body.token.trim();
  }
  return (process.env.FONNTE_TOKEN || 'XvFjdLyyvBgNUbXBZYzZ').trim();
}

function normalizeIndonesianPhone(phone) {
  let clean = String(phone || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('08')) {
    clean = '628' + clean.slice(2);
  } else if (clean.startsWith('8')) {
    clean = '628' + clean.slice(1);
  }
  return clean;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-fonnte-token');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Extract action from query param or URL
  const { action } = req.query;
  const token = resolveFonnteToken(req);

  // 1. STATUS
  if (action === 'status') {
    try {
      const response = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await response.json().catch(() => ({}));
      const isConnected = data.device_status === 'connect';

      return res.status(200).json({
        success: response.ok && (data.status === true || data.status === 'true'),
        status: data.device_status || (isConnected ? 'connect' : 'disconnect'),
        isConnected,
        device: data.device || '08813576012',
        name: data.name || 'Smart Permit Pesantren',
        quota: data.quota || (data.messages != null ? String(data.messages) : '931'),
        messages: data.messages != null ? data.messages : 0,
        package: data.package || 'Free',
        expired: data.expired || '-',
        raw: data,
        log: !isConnected ? {
          event: 'device disconnected',
          severity: 'warning',
          timestamp: new Date().toISOString(),
          details: 'Perangkat WhatsApp terdeteksi terputus dari Fonnte'
        } : null
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        status: 'disconnect',
        isConnected: false,
        error: err.message,
        log: {
          event: 'device disconnected',
          severity: 'warning',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // 2. QR
  if (action === 'qr') {
    const whatsappNumber = req.body?.whatsapp ? normalizeIndonesianPhone(req.body.whatsapp) : '';
    try {
      const formData = new FormData();
      formData.append('type', 'qr');
      if (whatsappNumber) formData.append('whatsapp', whatsappNumber);

      const response = await fetch('https://api.fonnte.com/qr', {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (data.url) {
        return res.status(200).json({
          success: true,
          status: 'qr',
          qrImage: data.url.startsWith('data:image') ? data.url : `data:image/png;base64,${data.url}`,
          code: data.code || null,
          message: 'QR Code resmi Fonnte berhasil dimuat',
          raw: data
        });
      }

      const msg = (data.message || data.reason || '').toLowerCase();
      if (data.connected === true || msg.includes('already connected') || msg.includes('device connected')) {
        return res.status(200).json({
          success: true,
          status: 'connected',
          isConnected: true,
          message: 'Device already connected',
          raw: data
        });
      }

      return res.status(400).json({
        success: false,
        status: 'error',
        message: data.reason || data.message || 'Gagal memuat QR Code dari Fonnte',
        raw: data
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 3. VALIDATE
  if (action === 'validate') {
    const rawPhone = req.body?.phone || req.body?.target || '';
    const normalized = normalizeIndonesianPhone(rawPhone);
    if (!normalized) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp wajib diisi!' });
    }

    try {
      const formData = new FormData();
      formData.append('target', normalized);
      formData.append('countryCode', '62');

      const response = await fetch('https://api.fonnte.com/validate', {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (data.reason === 'device disconnected' || (data.status === false && !data.registered)) {
        return res.status(200).json({
          success: false,
          isDeviceConnected: false,
          phone: normalized,
          message: data.reason || 'Perangkat Fonnte sedang terputus. Scan QR terlebih dahulu untuk validasi.',
          raw: data
        });
      }

      const regList = Array.isArray(data.registered) ? data.registered : [];
      const notRegList = Array.isArray(data.not_registered) ? data.not_registered : [];
      const isRegistered = regList.includes(normalized) || (regList.length > 0 && !notRegList.includes(normalized));

      return res.status(200).json({
        success: true,
        phone: normalized,
        isRegistered,
        registered: regList,
        not_registered: notRegList,
        message: isRegistered
          ? `Nomor ${normalized} aktif dan terdaftar di WhatsApp.`
          : `Nomor ${normalized} tidak terdaftar di WhatsApp.`,
        raw: data
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 4. DISCONNECT
  if (action === 'disconnect') {
    try {
      const response = await fetch('https://api.fonnte.com/disconnect', {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await response.json().catch(() => ({}));

      return res.status(200).json({
        success: true,
        status: 'disconnected',
        isConnected: false,
        message: data.detail || data.message || 'Perangkat WhatsApp berhasil diputuskan',
        log: {
          event: 'device disconnected (manual)',
          severity: 'warning',
          timestamp: new Date().toISOString(),
          details: 'Admin melakukan pemutusan manual tautan Fonnte dari dashboard'
        },
        raw: data
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 5. SEND
  if (action === 'send') {
    const { target, message } = req.body || {};
    if (!target || !message) {
      return res.status(400).json({ success: false, message: 'Parameter target dan message wajib diisi!' });
    }
    const normalized = normalizeIndonesianPhone(target);

    try {
      const formData = new FormData();
      formData.append('target', normalized);
      formData.append('message', message);
      formData.append('countryCode', '62');
      formData.append('preview', 'false');

      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      const isSuccess = response.ok && (data.status === true || data.status === 'true' || Boolean(data.id));

      return res.status(200).json({
        success: isSuccess,
        target: normalized,
        data,
        log: isSuccess ? {
          event: 'outbound success',
          severity: 'info',
          timestamp: new Date().toISOString(),
          details: `Pesan manual override AI Inbox terkirim ke ${normalized}`
        } : {
          event: 'outbound failed',
          severity: 'warning',
          timestamp: new Date().toISOString(),
          details: `Gagal mengirim ke ${normalized}: ${data.reason || data.message || 'Error response'}`
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(404).json({ success: false, message: `Action "${action}" tidak ditemukan.` });
}

