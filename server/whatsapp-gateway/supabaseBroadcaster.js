import { createClient } from '@supabase/supabase-js';

/**
 * ============================================================================
 * SMART RI'AYAH - SUPABASE REALTIME SERVER BROADCASTER
 * Channel: 'whatsapp-room'
 * Menyiarkan event webhook WhatsApp langsung ke Supabase Realtime tanpa WebSocket daemon eksternal.
 * ============================================================================
 */

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

let serverSupabase = null;
let serverChannel = null;
let channelReadyPromise = null;

async function ensureRealtimeChannel() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseKey();
  if (!supabaseUrl || !supabaseKey) return null;
  if (!serverSupabase) {
    serverSupabase = createClient(supabaseUrl, supabaseKey);
  }
  if (serverChannel && serverChannel.state === 'joined') {
    return serverChannel;
  }
  if (!channelReadyPromise) {
    channelReadyPromise = new Promise((resolve) => {
      try {
        if (serverChannel) {
          try { serverSupabase.removeChannel(serverChannel); } catch {}
        }
        serverChannel = serverSupabase.channel('whatsapp-room');
        const timeout = setTimeout(() => {
          channelReadyPromise = null;
          resolve(null);
        }, 3500);

        serverChannel.subscribe((status) => {
          console.log('📡 [Server Supabase Realtime whatsapp-room] Subscribed:', status);
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            resolve(serverChannel);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            clearTimeout(timeout);
            channelReadyPromise = null;
            resolve(null);
          }
        });
      } catch (e) {
        console.warn('⚠️ [Server Supabase Realtime] Inisialisasi gagal:', e.message);
        channelReadyPromise = null;
        resolve(null);
      }
    });
  }
  return channelReadyPromise;
}

export async function broadcastToSupabaseRealtime(event, payload) {
  try {
    const supabaseUrl = resolveSupabaseUrl();
    const supabaseKey = resolveSupabaseKey();
    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase credentials unavailable' };
    }

    // 1. Primary serverless-safe transport: Supabase Realtime HTTP Broadcast API
    try {
      const httpRes = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: 'whatsapp-room',
              event,
              payload,
            },
          ],
        }),
      });

      if (httpRes.ok) {
        return { success: true, transport: 'http-broadcast', status: httpRes.status };
      }
      console.warn(`⚠️ [HTTP Broadcast status ${httpRes.status}] Fallback ke WebSocket channel`);
    } catch (httpErr) {
      console.warn('⚠️ [HTTP Broadcast error] Fallback ke WebSocket channel:', httpErr.message);
    }

    // 2. Fallback: WebSocket channel (tunggu hingga SUBSCRIBED)
    const ch = await ensureRealtimeChannel();
    if (!ch) {
      return { success: false, error: 'Realtime channel failed to subscribe' };
    }

    const res = await ch.send({
      type: 'broadcast',
      event,
      payload
    });

    return { success: res === 'ok', transport: 'websocket', res };
  } catch (err) {
    console.error('❌ [Server broadcastToSupabaseRealtime Error]:', err);
    return { success: false, error: err.message };
  }
}

