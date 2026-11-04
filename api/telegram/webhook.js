import { generateAutonomousReply, isPhoneInManualTakeover } from '../../server/whatsapp-gateway/aiAutonomousResponder.js';
import { broadcastToSupabaseRealtime } from '../../server/whatsapp-gateway/supabaseBroadcaster.js';

/**
 * Vercel Serverless Function: /api/telegram/webhook
 * Menerima pesan masuk dari Telegram Bot (@smartriayah_ai_bot) dan membalas secara otonom
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'Smart Riayah Telegram AI Bot Webhook',
      timestamp: new Date().toISOString()
    });
  }

  let update = req.body || {};
  if (typeof update === 'string') {
    try {
      update = JSON.parse(update);
    } catch (e) {
      console.warn('JSON parse warning:', e);
    }
  }
  console.log('📥 [Telegram Webhook Received]:', JSON.stringify(update));

  const msg = update.message || update.edited_message || update.channel_post;
  if (!msg || !msg.text) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const chatId = msg.chat?.id;
  const incomingText = msg.text.trim();
  const senderName = msg.from?.first_name || msg.from?.username || msg.chat?.first_name || 'Wali Santri (Telegram)';
  const senderPhone = `TG-${chatId}`;
  const nowWIB = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  try {
    // 1. Siarkan pesan masuk Telegram ke dashboard AI Inbox via Supabase Realtime
    const incomingData = {
      id: `TG-${msg.message_id || Date.now()}`,
      pengirim: senderName,
      nomor: senderPhone,
      pesan: incomingText,
      waktu: nowWIB,
      channel: 'Telegram Bot',
      tipe: 'TELEGRAM_INCOMING'
    };
    try {
      await broadcastToSupabaseRealtime('whatsapp.incoming', incomingData);
    } catch (e) {
      console.warn('Realtime broadcast warning:', e.message);
    }

    // 2. Cek apakah percakapan sedang diambil alih manual oleh Admin
    let inTakeover = false;
    try {
      inTakeover = await isPhoneInManualTakeover(String(chatId));
    } catch (e) {
      inTakeover = false;
    }
    if (inTakeover) {
      console.log(`⏸️ [Telegram Takeover]: Chat ${chatId} sedang diambil alih manual oleh Admin. AI diistirahatkan.`);
      return res.status(200).json({ ok: true, status: 'manual_takeover' });
    }

    // 3. Tangani perintah khusus /start
    let aiReply = '';
    if (incomingText === '/start') {
      aiReply = `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${senderName}.\n\nSelamat datang di Layanan AI Resmi Pesantren Modern Darul Ulum.\n\nSaya adalah *Smart Ri'ayah AI Bot* yang siap membantu Bapak/Ibu 24 jam untuk:\n1. 💳 *Cek Saldo Dompet RFID & Limit Jajan*\n2. 📈 *Kondisi & Poin Kedisiplinan Santri*\n3. 📋 *Prosedur Perizinan & Liburan*\n4. 🏥 *Layanan Kesehatan Poskestren*\n5. 📅 *Jadwal Sambangan & Kunjungan Wali*\n\nSilakan ketik pertanyaan Bapak/Ibu secara langsung di sini.`;
    } else {
      // Generate balasan cerdas Smart Ri'ayah
      aiReply = await generateAutonomousReply(String(chatId), incomingText, senderName);
    }

    // 4. Kirim balasan otomatis ke pengguna di Telegram
    const FALLBACK_TELEGRAM_TOKEN = '9079176204:AAEBAzGX5ReS_Kykuk32ctWtIkmIhh-ElVQ';
    const token = req.query?.token || process.env.TELEGRAM_BOT_TOKEN || FALLBACK_TELEGRAM_TOKEN;
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiReply
      })
    });
    const tgData = await tgRes.json().catch(() => ({}));
    console.log('📤 [Telegram sendMessage Result]:', JSON.stringify(tgData));

    // 5. Siarkan balasan AI ke dashboard AI Inbox
    const aiReplyData = {
      id: `AI-TG-${Date.now()}`,
      target: senderPhone,
      namaWali: senderName,
      incomingText: incomingText,
      replyText: aiReply,
      waktu: nowWIB,
      dispatched: Boolean(tgData.ok),
      channel: 'Telegram Bot',
      mode: 'AUTONOMOUS'
    };
    await broadcastToSupabaseRealtime('whatsapp.ai_reply', aiReplyData);

    return res.status(200).json({
      ok: true,
      chat_id: chatId,
      reply: aiReply,
      sent: Boolean(tgData.ok)
    });
  } catch (err) {
    console.error('❌ [Telegram Webhook Error]:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
