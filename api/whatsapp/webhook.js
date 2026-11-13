/**
 * Vercel Serverless Function: /api/whatsapp/webhook
 * Menerima incoming webhook dari Fonnte WhatsApp Gateway dan membalas secara Otonom (Autonomous AI)
 */

import {
  generateAutonomousReplyWithContext,
  sendFonnteAutoReply,
  normalizePhone,
  isPhoneInManualTakeover,
  resolveWaliIdentity,
} from '../../server/whatsapp-gateway/aiAutonomousResponder.js';
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
    const rawSenderName = payload.name || payload.sender_name || '';

    if (incomingText && sender) {
      const cleanSender = normalizePhone(sender);
      const nowWIB = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      // Resolusi identitas wali & santri dinamis (prioritas Supabase + binding 628813576012 -> Nurmiyaty)
      const resolvedIdentity = await resolveWaliIdentity(cleanSender, rawSenderName);
      const displayWaliName = resolvedIdentity?.namaWali || rawSenderName || 'Wali Santri';

      const incomingData = {
        id: payload.id || `IN-${Date.now()}`,
        pengirim: displayWaliName,
        santriNama: resolvedIdentity?.santriNama || null,
        nomor: cleanSender,
        pesan: incomingText,
        waktu: nowWIB,
        tipe: 'PESAN_MASUK_WALI'
      };

      // Siarkan pesan masuk ke Supabase Realtime seketika!
      await broadcastToSupabaseRealtime('whatsapp.incoming', incomingData);

      // Cek apakah nomor sedang dalam Mode Ambil Alih (Manual Override) oleh Admin
      const inTakeover = await isPhoneInManualTakeover(cleanSender);
      if (inTakeover) {
        console.log(`⏸️ [Vercel Takeover Aktif]: Chat dari ${cleanSender} tidak dibalas AI karena sedang diambil alih Admin Ri'ayah.`);
        return res.status(200).json({
          success: true,
          type: 'manual_takeover_active',
          sender: cleanSender,
          namaWali: displayWaliName,
          santriNama: resolvedIdentity?.santriNama || null,
          incoming: incomingText,
          read: true,
          message: "Mode Ambil Alih Aktif. AI diistirahatkan, percakapan ditangani manual oleh Admin."
        });
      }

      // JALANKAN OTAK AI OTONOM
      console.log(`🤖 [Vercel AI Otonom untuk ${cleanSender} (${displayWaliName} -> ${resolvedIdentity?.santriNama || '-'})]: "${incomingText}"`);
      const aiResult = await generateAutonomousReplyWithContext(cleanSender, incomingText, displayWaliName, resolvedIdentity);
      const aiReply = aiResult.reply;

      // Kirim balasan aktif ke Fonnte API secara langsung (sertakan QR Code gambar jika auto-approval weekend)
      const mediaUrl = (!aiResult.bookingRecord?.is_weekday && aiResult.bookingRecord?.barcode_image_url)
        ? aiResult.bookingRecord.barcode_image_url
        : null;
      const dispatchResult = await sendFonnteAutoReply(cleanSender, aiReply, null, mediaUrl);

      const aiReplyData = {
        id: `AI-${Date.now()}`,
        target: cleanSender,
        namaWali: aiResult.waliData?.namaWali || displayWaliName,
        santriNama: aiResult.waliData?.santriNama || resolvedIdentity?.santriNama || null,
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

