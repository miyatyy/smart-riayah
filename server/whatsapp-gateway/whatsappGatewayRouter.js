import express from 'express';
import { broadcastToSupabaseRealtime } from './supabaseBroadcaster.js';

/**
 * ============================================================================
 * SMART RI'AYAH - WHATSAPP GATEWAY MODULAR ROUTER (SUPABASE REALTIME)
 * Channel: 'whatsapp-room'
 * Endpoint terisolasi untuk Webhook dan status Supabase Realtime Broadcast.
 * ============================================================================
 */

const router = express.Router();

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
 * POST /api/whatsapp/webhook
 * Menerima callback webhook status pesan atau pesan masuk dari provider WA (Fonnte/Waba)
 * lalu menyiarkannya secara real-time via Supabase Realtime channel 'whatsapp-room'.
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

      await broadcastToSupabaseRealtime('whatsapp.status', statusData);

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

      await broadcastToSupabaseRealtime('whatsapp.incoming', incomingData);

      return res.json({
        success: true,
        type: 'incoming_message',
        broadcasted: true,
        data: incomingData
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

export default router;
