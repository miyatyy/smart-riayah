import { generateAutonomousReplyWithContext, isPhoneInManualTakeover, setManualTakeover } from '../../server/whatsapp-gateway/aiAutonomousResponder.js';
import { broadcastToSupabaseRealtime } from '../../server/whatsapp-gateway/supabaseBroadcaster.js';
import { createClient } from '@supabase/supabase-js';

function resolveSupabaseUrl() {
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ];
  for (const raw of candidates) {
    const cleaned = String(raw || '').trim().replace(/^['"]|['"]$/g, '');
    if (!cleaned) continue;
    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return cleaned;
      }
    } catch {}
  }
  return '';
}

function resolveSupabaseKey() {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ];
  for (const raw of candidates) {
    const cleaned = String(raw || '').trim().replace(/^['"]|['"]$/g, '');
    if (cleaned) return cleaned;
  }
  return '';
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseKey = resolveSupabaseKey();
let supabase = { from: () => ({ insert: async () => ({}) }) };
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  } catch (err) {
    console.warn('⚠️ [Telegram Webhook] Gagal init Supabase client:', err?.message || err);
  }
}

async function safeLog(senderName, senderRole, text, reaction) {
  try {
    await supabase.from('messages').insert([{
      room_id: 'telegram_log',
      sender_email: 'telegram_webhook@smartriayah.com',
      sender_name: senderName,
      sender_role: senderRole,
      message_text: text,
      reaction: reaction,
      is_read: false
    }]);
  } catch (err) {
    console.warn('Logging notice:', err.message);
  }
}

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
    // 0. Catat ke log persistent Supabase messages
    await safeLog(senderName, 'system', `INCOMING from ${chatId}: "${incomingText}"`, 'RECEIVED');

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

    // 2. Tangani perintah khusus /start (Selalu unblock / reset takeover ke Otonom)
    let aiReply = '';
    let resolvedWali = null;
    if (incomingText === '/start') {
      try {
        await setManualTakeover(String(chatId), false);
      } catch (e) {}
      aiReply = `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${senderName}.\n\nTerima kasih telah menghubungi layanan Pesantren Modern Darul Ulum. Ada yang bisa kami bantu? Silakan sampaikan keperluannya ya Bapak/Ibu. 🙏`;
    } else {
      // 3. Cek apakah percakapan sedang diambil alih manual oleh Admin
      let inTakeover = false;
      try {
        inTakeover = await isPhoneInManualTakeover(String(chatId));
      } catch (e) {
        inTakeover = false;
      }
      if (inTakeover) {
        console.log(`⏸️ [Telegram Takeover]: Chat ${chatId} sedang diambil alih manual oleh Admin. AI diistirahatkan.`);
        await safeLog('Takeover Shield', 'shield', `TAKEOVER ACTIVE for ${chatId}. AI reply suppressed.`, 'SUPPRESSED');
        return res.status(200).json({ ok: true, status: 'manual_takeover' });
      }

      // Generate balasan cerdas Smart Ri'ayah
      const aiResult = await generateAutonomousReplyWithContext(String(chatId), incomingText, senderName);
      aiReply = aiResult.reply;
      resolvedWali = aiResult.waliData;
    }

    // 4. Kirim balasan otomatis ke pengguna di Telegram
    const token = req.query?.token || process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN || '';
    if (!token) {
      console.warn('⚠️ [Telegram Webhook]: TELEGRAM_BOT_TOKEN belum dikonfigurasi di environment variables.');
      return res.status(200).json({ ok: false, error: 'Telegram bot token not configured' });
    }
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

    // Catat hasil pengiriman ke Supabase
    await safeLog('Smart Riayah AI Bot', 'bot', `DISPATCH to ${chatId}: ok=${Boolean(tgData.ok)} - err=${tgData.description || 'none'}`, tgData.ok ? 'SENT' : 'FAILED');

    // 5. Siarkan balasan AI ke dashboard AI Inbox
    const aiReplyData = {
      id: `AI-TG-${Date.now()}`,
      target: senderPhone,
      namaWali: resolvedWali?.namaWali || senderName,
      santriNama: resolvedWali?.santriNama || null,
      incomingText: incomingText,
      replyText: aiReply,
      waktu: nowWIB,
      dispatched: Boolean(tgData.ok),
      channel: 'Telegram Bot',
      mode: 'AUTONOMOUS'
    };
    try {
      await broadcastToSupabaseRealtime('whatsapp.ai_reply', aiReplyData);
    } catch (e) {
      console.warn('Realtime broadcast reply warning:', e.message);
    }

    return res.status(200).json({
      ok: true,
      chat_id: chatId,
      reply: aiReply,
      sent: Boolean(tgData.ok),
      telegram_res: tgData
    });
  } catch (err) {
    console.error('❌ [Telegram Webhook Error]:', err);
    await safeLog('Webhook Exception', 'error', `EXCEPTION: ${err.message}`, 'EXCEPTION');
    return res.status(500).json({ ok: false, error: err.message });
  }
}
