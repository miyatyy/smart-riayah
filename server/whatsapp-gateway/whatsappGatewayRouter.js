import crypto from 'node:crypto';
import express from 'express';
import { broadcastToSupabaseRealtime } from './supabaseBroadcaster.js';
import { generateAutonomousReply, sendFonnteAutoReply, normalizePhone, setManualTakeover, isPhoneInManualTakeover } from './aiAutonomousResponder.js';

/**
 * ============================================================================
 * SMART RI'AYAH - WHATSAPP GATEWAY MODULAR ROUTER (SUPABASE REALTIME)
 * Channel: 'whatsapp-room'
 * Endpoint terisolasi untuk Webhook dan status Supabase Realtime Broadcast.
 * ============================================================================
 */

const router = express.Router();

/**
 * VALIDASI SIGNATURE FONNTE/WABA
 * Mencegah attacker mengirim payload palsu ke endpoint webhook.
 */
export function validateWaSignature(req, res, next) {
  const rawHeader =
    req.headers['x-fonnte-signature'] || req.headers['x-waba-signature']; // sesuaikan provider
  const signatureHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  const secret = process.env.WA_WEBHOOK_SECRET?.trim(); // SET INI DI .env BACKEND / RAILWAY / VERCEL

  if (!signatureHeader || typeof signatureHeader !== 'string' || !signatureHeader.trim() || !secret) {
    console.warn('⚠️ [WA Webhook] DITOLAK: Missing signature or secret');
    return res.status(401).json({ error: 'Unauthorized - missing credentials' });
  }

  try {
    // Fonnte standar: HMAC-SHA256(body, secret)
    const bodyString =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    // Perbandingan konstan-time untuk cegah timing attack
    const sigBuffer = Buffer.from(signatureHeader.trim().toLowerCase(), 'utf8');
    const expBuffer = Buffer.from(expectedSig, 'utf8');

    if (
      sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)
    ) {
      throw new Error('Invalid signature');
    }

    return next(); // Lanjut jika valid
  } catch (err) {
    console.error('❌ [WA Webhook] DITOLAK: Invalid signature (Possible Attack!)', err.message);
    return res.status(403).json({ error: 'Forbidden - invalid signature' });
  }
}

/**
 * GET /api/whatsapp/gateway-status
 * Menampilkan status konfigurasi Supabase Realtime channel 'whatsapp-room'
 */
router.get('/gateway-status', async (req, res) => {
  res.json({
    success: true,
    service: 'Smart Riayah WhatsApp Realtime Gateway',
    timestamp: new Date().toISOString(),
    realtime: {
      engine: 'Supabase Realtime Broadcast',
      channel: 'whatsapp-room',
      events: [
        'whatsapp.status',
        'whatsapp.incoming',
        'whatsapp.notification'
      ],
      mode: 'Serverless Native (Vercel Ready, No external WebSocket server needed)'
    }
  });
});

/**
 * POST /api/whatsapp/broadcast
 * Mengirim event broadcast secara manual / programmatic ke Supabase Realtime
 */
router.post('/broadcast', async (req, res) => {
  const { event, data } = req.body;

  if (!event || !data) {
    return res.status(400).json({
      success: false,
      message: 'Field "event" dan "data" wajib disertakan!'
    });
  }

  try {
    const result = await broadcastToSupabaseRealtime(event, data);
    res.json({
      success: true,
      message: `Event "${event}" berhasil dibroadcast ke Supabase Realtime (whatsapp-room)`,
      dispatch: result,
      payload: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Gagal melakukan broadcast event',
      error: error.message
    });
  }
});

/**
 * GET /api/whatsapp/webhook
 * Health check & validasi URL webhook Fonnte
 */
router.get('/webhook', (req, res) => {
  return res.status(200).json({
    status: 'active',
    service: 'Smart Riayah Autonomous WhatsApp AI Webhook',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/whatsapp/webhook
 * Menerima callback webhook status pesan atau pesan masuk dari provider WA (Fonnte/Waba)
 * lalu menyiarkannya secara real-time via Supabase Realtime channel 'whatsapp-room'.
 */
router.post('/webhook', validateWaSignature, async (req, res) => {
  const payload = req.body || {};
  console.log('📥 [WhatsApp Webhook Received]:', payload);

  try {
    // 1. Deteksi status pengiriman pesan (DLR / Delivery Report)
    if (payload.status || payload.state) {
      const statusData = {
        id: payload.id || payload.message_id || `WA-${Date.now()}`,
        status: (payload.status || payload.state || 'DELIVERED').toUpperCase(),
        penerima: payload.name || payload.target || 'Wali Santri',
        nomor: payload.target || payload.phone || payload.sender,
        waktu: new Date().toLocaleTimeString('id-ID'),
        latencyMs: payload.latency || null,
        keterangan: payload.message || 'Status diperbarui via webhook'
      };

      await broadcastToSupabaseRealtime('whatsapp.status', statusData);

      return res.json({
        success: true,
        type: 'status_update',
        broadcasted: true,
        data: statusData
      });
    }

    // 2. Deteksi pesan masuk (Incoming Message dari Wali) & EKSEKUSI AI OTONOM
    const incomingText = payload.message || payload.text;
    const sender = payload.sender || payload.phone || payload.target;
    const senderName = payload.name || payload.sender_name || 'Wali Santri';

    if (incomingText && sender) {
      const cleanSender = normalizePhone(sender);
      const nowWIB = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      // ✅ AMAN - Hanya catat audit, JANGAN pernah auto-update profiles.no_telepon dari payload webhook
      console.log(`🔍 [WA Audit] Pesan masuk dari ${cleanSender}. Update kontak DINONAKTIFKAN demi keamanan.`);

      const incomingData = {
        id: payload.id || `IN-${Date.now()}`,
        pengirim: senderName,
        nomor: cleanSender,
        pesan: incomingText,
        waktu: nowWIB,
        tipe: 'INCOMING_REPLY'
      };

      // Broadcast pesan masuk ke frontend via Supabase Realtime
      await broadcastToSupabaseRealtime('whatsapp.incoming', incomingData);

      // Cek apakah nomor sedang dalam Mode Ambil Alih (Manual Override) oleh Admin Ri'ayah
      const inTakeover = await isPhoneInManualTakeover(cleanSender);
      if (inTakeover) {
        console.log(`⏸️ [Manual Takeover Aktif]: Chat dari ${cleanSender} tidak dibalas AI karena sedang diambil alih Admin Ri'ayah.`);
        return res.json({
          success: true,
          type: 'manual_takeover_active',
          sender: cleanSender,
          incoming: incomingText,
          broadcasted: true,
          read: true,
          message: 'Ditangani manual oleh Admin Ri\'ayah. AI diistirahatkan.'
        });
      }

      // ─── GENERATE BALASAN AI OTONOM (CONTEXT-AWARE SMART RI'AYAH) ───
      console.log(`🤖 [Menjalankan AI Otonom untuk ${cleanSender}]: "${incomingText}"`);
      const aiReply = await generateAutonomousReply(cleanSender, incomingText, senderName);

      // Kirim pesan WhatsApp balasan otomatis via Fonnte REST API
      const dispatchResult = await sendFonnteAutoReply(cleanSender, aiReply);

      const aiReplyData = {
        id: `AI-${Date.now()}`,
        target: cleanSender,
        namaWali: senderName,
        incomingText: incomingText,
        replyText: aiReply,
        waktu: nowWIB,
        dispatched: dispatchResult.success,
        mode: 'AUTONOMOUS'
      };

      // Broadcast balasan AI ke dashboard AI Inbox
      await broadcastToSupabaseRealtime('whatsapp.ai_reply', aiReplyData);

      // Response ke Fonnte Webhook (Format Resmi Fonnte Auto-Reply)
      return res.json({
        success: true,
        type: 'autonomous_reply',
        broadcasted: true,
        read: true,
        reply: aiReply,
        incoming: incomingData,
        outgoing: aiReplyData
      });
    }

    // 3. Fallback generic notification
    await broadcastToSupabaseRealtime('whatsapp.notification', payload);

    res.json({
      success: true,
      type: 'generic_notification',
      broadcasted: true
    });
  } catch (err) {
    console.error('❌ [WhatsApp Webhook Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * ============================================================================
 * FONNTE OFFICIAL REST API PROXY ENDPOINTS (/api/whatsapp/fonnte/...)
 * ============================================================================
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
  return (process.env.FONNTE_TOKEN || process.env.VITE_FONNTE_TOKEN || '').trim();
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

/**
 * 1. GET & POST /api/whatsapp/fonnte/status
 * Refresh status koneksi Fonnte Device
 */
router.all('/fonnte/status', async (req, res) => {
  const token = resolveFonnteToken(req);
  try {
    const response = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
    });

    const data = await response.json().catch(() => ({}));
    const isConnected = data.device_status === 'connect';

    const statusPayload = {
      success: response.ok && (data.status === true || data.status === 'true'),
      status: data.device_status || (isConnected ? 'connect' : 'disconnect'),
      isConnected,
      device: data.device || '6285960213654',
      name: data.name || 'SmartRIAYAH',
      quota: data.quota || (data.messages != null ? String(data.messages) : '1000'),
      messages: data.messages != null ? data.messages : 0,
      package: data.package || 'Free',
      expired: data.expired || '7 Dec 2026',
      raw: data,
      log: !isConnected ? {
        event: 'device disconnected',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        details: 'Perangkat WhatsApp terdeteksi terputus dari Fonnte'
      } : null
    };

    return res.json(statusPayload);
  } catch (error) {
    console.error('❌ [Fonnte Status Error]:', error);
    return res.status(500).json({
      success: false,
      status: 'disconnect',
      isConnected: false,
      error: error.message,
      log: {
        event: 'device disconnected',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        details: `Gagal memverifikasi status Fonnte: ${error.message}`
      }
    });
  }
});

/**
 * 2. POST /api/whatsapp/fonnte/qr
 * Mengambil QR Code resmi dari Fonnte API (Base64)
 */
router.post('/fonnte/qr', async (req, res) => {
  const token = resolveFonnteToken(req);
  const whatsappNumber = req.body?.whatsapp ? normalizeIndonesianPhone(req.body.whatsapp) : '';

  try {
    const formData = new FormData();
    formData.append('type', 'qr');
    if (whatsappNumber) {
      formData.append('whatsapp', whatsappNumber);
    }

    const response = await fetch('https://api.fonnte.com/qr', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    // Cek jika response berisi gambar base64
    if (data.url) {
      return res.json({
        success: true,
        status: 'qr',
        qrImage: data.url.startsWith('data:image') ? data.url : `data:image/png;base64,${data.url}`,
        code: data.code || null,
        message: 'QR Code resmi Fonnte berhasil dimuat',
        raw: data
      });
    }

    // Cek jika device sudah terhubung
    const msg = (data.message || data.reason || '').toLowerCase();
    if (data.connected === true || msg.includes('already connected') || msg.includes('device connected')) {
      return res.json({
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
  } catch (error) {
    console.error('❌ [Fonnte QR Error]:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: error.message
    });
  }
});

/**
 * 3. POST /api/whatsapp/fonnte/validate
 * Validasi apakah nomor terdaftar di WhatsApp
 */
router.post('/fonnte/validate', async (req, res) => {
  const token = resolveFonnteToken(req);
  const rawPhone = req.body?.phone || req.body?.target || '';
  const normalized = normalizeIndonesianPhone(rawPhone);

  if (!normalized) {
    return res.status(400).json({
      success: false,
      message: 'Nomor WhatsApp wajib diisi!'
    });
  }

  try {
    const formData = new FormData();
    formData.append('target', normalized);
    formData.append('countryCode', '62');

    const response = await fetch('https://api.fonnte.com/validate', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    // Cek apakah device disconnected di server Fonnte
    if (data.reason === 'device disconnected' || (data.status === false && !data.registered)) {
      return res.json({
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

    return res.json({
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
  } catch (error) {
    console.error('❌ [Fonnte Validate Error]:', error);
    return res.status(500).json({
      success: false,
      message: `Gagal memvalidasi nomor: ${error.message}`
    });
  }
});

/**
 * 4. POST /api/whatsapp/fonnte/disconnect
 * Memutuskan koneksi perangkat dari Fonnte
 */
router.post('/fonnte/disconnect', async (req, res) => {
  const token = resolveFonnteToken(req);

  try {
    const response = await fetch('https://api.fonnte.com/disconnect', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
    });

    const data = await response.json().catch(() => ({}));

    return res.json({
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
  } catch (error) {
    console.error('❌ [Fonnte Disconnect Error]:', error);
    return res.status(500).json({
      success: false,
      message: `Gagal memutuskan perangkat: ${error.message}`
    });
  }
});

/**
 * 5. POST /api/whatsapp/fonnte/send
 * Mengirim pesan Manual Override dari AI Inbox
 */
router.post('/fonnte/send', async (req, res) => {
  const token = resolveFonnteToken(req);
  const { target, message, url } = req.body;

  if (!target || !message) {
    return res.status(400).json({
      success: false,
      message: 'Parameter "target" dan "message" wajib diisi!'
    });
  }

  const normalized = normalizeIndonesianPhone(target);

  try {
    const formData = new FormData();
    formData.append('target', normalized);
    formData.append('message', message);
    formData.append('countryCode', '62');
    formData.append('preview', 'false');
    if (url) {
      formData.append('url', url);
    }

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    const isSuccess = response.ok && (data.status === true || data.status === 'true' || Boolean(data.id));

    return res.json({
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
  } catch (error) {
    console.error('❌ [Fonnte Send Error]:', error);
    return res.status(500).json({
      success: false,
      message: `Gagal mengirim pesan: ${error.message}`
    });
  }
});

/**
 * 6. POST /api/whatsapp/fonnte/takeover
 * Mengaktifkan atau menonaktifkan Mode Ambil Alih Manual untuk nomor tertentu
 */
router.post('/fonnte/takeover', async (req, res) => {
  const { phone, isManual } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Parameter "phone" wajib diisi!'
    });
  }

  const clean = normalizeIndonesianPhone(phone);
  const active = Boolean(isManual);
  await setManualTakeover(clean, active);

  console.log(`👤 [Fonnte Route Takeover]: Nomor ${clean} diubah status takeover-nya menjadi: ${active ? 'MANUAL' : 'OTONOM'}`);

  return res.json({
    success: true,
    phone: clean,
    isManual: active,
    message: active
      ? `Nomor ${clean} berhasil diambil alih secara manual. AI Otonom diistirahatkan.`
      : `Nomor ${clean} berhasil dikembalikan ke Mode Otonom AI.`
  });
});


/**
 * POST /api/whatsapp/simulate-incoming
 * Endpoint untuk menguji alur Autonomous AI secara langsung dari dashboard
 */
router.post('/simulate-incoming', async (req, res) => {
  const { sender = '08813576012', message = 'Assalamu\'alaikum ustadz, bagaimana kabar ananda Fauzi hari ini?', name = 'Ibu Fatimah Az-Zahra' } = req.body;
  const cleanSender = normalizePhone(sender);
  const nowWIB = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  try {
    const aiReply = await generateAutonomousReply(cleanSender, message, name);
    const dispatch = await sendFonnteAutoReply(cleanSender, aiReply);

    const incomingData = {
      id: `IN-${Date.now()}`,
      pengirim: name,
      nomor: cleanSender,
      pesan: message,
      waktu: nowWIB,
      tipe: 'INCOMING_REPLY'
    };

    const aiReplyData = {
      id: `AI-${Date.now()}`,
      target: cleanSender,
      namaWali: name,
      incomingText: message,
      replyText: aiReply,
      waktu: nowWIB,
      dispatched: dispatch.success,
      mode: 'AUTONOMOUS'
    };

    await broadcastToSupabaseRealtime('whatsapp.incoming', incomingData);
    await broadcastToSupabaseRealtime('whatsapp.ai_reply', aiReplyData);

    return res.json({
      success: true,
      sender: cleanSender,
      incoming: message,
      reply: aiReply,
      dispatched: dispatch.success
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

