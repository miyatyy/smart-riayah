/**
 * Vercel Serverless Function: /api/whatsapp/webhook
 * Menerima incoming webhook dari Fonnte WhatsApp Gateway dan membalas secara Otonom (Autonomous AI)
 */

import { generateAutonomousReply, sendFonnteAutoReply, normalizePhone, isPhoneInManualTakeover } from '../../server/whatsapp-gateway/aiAutonomousResponder.js';
import { broadcastToSupabaseRealtime } from '../../server/whatsapp-gateway/supabaseBroadcaster.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'Smart Riayah Autonomous WhatsApp AI Webhook',
      timestamp: new Date().toISOString()
    });
  }

  const payload = req.body || {};
  console.log('📥 [Vercel WhatsApp Webhook]:', payload);

  try {
    // 1. Deteksi Delivery Report / Status DLR
    if (payload.status || payload.state) {
      const statusData = {
        id: payload.id || `WA-${Date.now()}`,
        status: (payload.status || payload.state || 'DELIVERED').toUpperCase(),
        penerima: payload.name || payload.target || 'Wali Santri',
        nomor: payload.target || payload.phone || payload.sender,
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
      };
      await broadcastToSupabaseRealtime('whatsapp.status', statusData);

      return res.status(200).json({
        success: true,
        type: 'status_update',
        status: payload.status || payload.state
      });
    }

    // 2. Deteksi Pesan Masuk (Incoming Message dari Wali)
    const incomingText = payload.message || payload.text;
    const sender = payload.sender || payload.phone || payload.target;
    const senderName = payload.name || payload.sender_name || 'Wali Santri';

    if (incomingText && sender) {
      const cleanSender = normalizePhone(sender);
      const nowWIB = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      const incomingData = {
        id: payload.id || `IN-${Date.now()}`,
        pengirim: senderName,
        nomor: cleanSender,
        pesan: incomingText,
        waktu: nowWIB,
        tipe: 'PESAN_MASUK_WALI'
      };

      // Siarkan pesan masuk ke Supabase Realtime seketika!
      await broadcastToSupabaseRealtime('whatsapp.incoming', incomingData);

      // Cek apakah nomor sedang dalam Mode Ambil Alih (Manual Override) oleh Admin
      if (isPhoneInManualTakeover(cleanSender)) {
        console.log(`⏸️ [Vercel Takeover Aktif]: Chat dari ${cleanSender} tidak dibalas AI karena sedang diambil alih Admin Ri'ayah.`);
        return res.status(200).json({
          success: true,
          type: 'manual_takeover_active',
          sender: cleanSender,
          incoming: incomingText,
          read: true,
          message: "Mode Ambil Alih Aktif. AI diistirahatkan, percakapan ditangani manual oleh Admin."
        });
      }

      // JALANKAN OTAK AI OTONOM
      console.log(`🤖 [Vercel AI Otonom untuk ${cleanSender}]: "${incomingText}"`);
      const aiReply = await generateAutonomousReply(cleanSender, incomingText, senderName);

      // Kirim balasan aktif ke Fonnte API secara langsung
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

      // Siarkan balasan AI ke Supabase Realtime!
      await broadcastToSupabaseRealtime('whatsapp.ai_reply', aiReplyData);

      // Kembalikan response JSON ke Fonnte (Fonnte webhook auto-reply format)
      return res.status(200).json({
        success: true,
        type: 'autonomous_reply',
        sender: cleanSender,
        incoming: incomingText,
        reply: aiReply,
        read: true,
        broadcasted: true
      });
    }

    return res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('❌ [Vercel Webhook Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

