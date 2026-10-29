import express from 'express';
import { checkRedisStatus } from './redisClient.js';
import { 
  broadcastWhatsAppEvent, 
  broadcastWhatsAppStatus, 
  broadcastWhatsAppIncoming, 
  broadcastWhatsAppNotification 
} from './soketiBroadcaster.js';

/**
 * ============================================================================
 * SMART RI'AYAH - WHATSAPP GATEWAY MODULAR ROUTER
 * Endpoint terisolasi untuk Webhook, status message broker Redis, dan push Soketi.
 * ============================================================================
 */

const router = express.Router();

/**
 * GET /api/whatsapp/gateway-status
 * Menampilkan status koneksi Redis dan konfigurasi Soketi
 */
router.get('/gateway-status', async (req, res) => {
  const redisInfo = await checkRedisStatus();
  
  res.json({
    success: true,
    service: 'Smart Riayah WhatsApp Realtime Gateway',
    timestamp: new Date().toISOString(),
    broker: {
      engine: 'Redis',
      ...redisInfo
    },
    websocket: {
      engine: 'Soketi (Pusher Protocol Compatible)',
      host: process.env.SOKETI_HOST || '127.0.0.1',
      port: process.env.SOKETI_PORT || '6001',
      appId: process.env.SOKETI_APP_ID || 'smart-riayah-app',
      appKey: process.env.SOKETI_APP_KEY || 'smart-riayah-key',
      channel: 'whatsapp-channel',
      supportedEvents: [
        'whatsapp.status',
        'whatsapp.incoming',
        'whatsapp.notification'
      ]
    }
  });
});

/**
 * POST /api/whatsapp/broadcast
 * Mengirim event broadcast secara manual / programmatic ke Redis & Soketi
 */
router.post('/broadcast', async (req, res) => {
  const { event, data, channel } = req.body;

  if (!event || !data) {
    return res.status(400).json({
      success: false,
      message: 'Field "event" dan "data" wajib disertakan!'
    });
  }

  try {
    const result = await broadcastWhatsAppEvent(event, data, channel);
    res.json({
      success: true,
      message: `Event "${event}" berhasil dibroadcast`,
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
 * POST /api/whatsapp/webhook
 * Menerima callback webhook status pesan atau pesan masuk dari provider WA (Fonnte/Waba)
 * lalu langsung menyiarkannya secara real-time ke Soketi & Redis.
 */
router.post('/webhook', async (req, res) => {
  const payload = req.body;
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

      await broadcastWhatsAppStatus(statusData);

      return res.json({
        success: true,
        type: 'status_update',
        broadcasted: true,
        data: statusData
      });
    }

    // 2. Deteksi pesan masuk (Incoming Message dari Wali)
    if (payload.message || payload.text) {
      const incomingData = {
        id: payload.id || `IN-${Date.now()}`,
        pengirim: payload.name || payload.sender || 'Wali Santri',
        nomor: payload.sender || payload.phone || '08xxxxxxxxxx',
        pesan: payload.message || payload.text,
        waktu: new Date().toLocaleTimeString('id-ID'),
        tipe: 'INCOMING_REPLY'
      };

      await broadcastWhatsAppIncoming(incomingData);

      return res.json({
        success: true,
        type: 'incoming_message',
        broadcasted: true,
        data: incomingData
      });
    }

    // 3. Fallback generic notification
    await broadcastWhatsAppNotification(payload);

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

export default router;

