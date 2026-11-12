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

const supabaseUrl = resolveSupabaseUrl();
const supabaseKey = resolveSupabaseKey();

let serverSupabase = null;
let serverChannel = null;

if (supabaseUrl && supabaseKey) {
  try {
    serverSupabase = createClient(supabaseUrl, supabaseKey);
    serverChannel = serverSupabase.channel('whatsapp-room');
    serverChannel.subscribe((status) => {
      console.log('📡 [Server Supabase Realtime whatsapp-room] Subscribed:', status);
    });
  } catch (e) {
    console.warn('⚠️ [Server Supabase Realtime] Inisialisasi gagal:', e.message);
  }
}

export async function broadcastToSupabaseRealtime(event, payload) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase credentials unavailable' };
    }
    if (!serverChannel) {
      if (!serverSupabase) serverSupabase = createClient(supabaseUrl, supabaseKey);
      serverChannel = serverSupabase.channel('whatsapp-room');
      await serverChannel.subscribe();
    }

    const res = await serverChannel.send({
      type: 'broadcast',
      event,
      payload
    });

    return { success: true, res };
  } catch (err) {
    console.error('❌ [Server broadcastToSupabaseRealtime Error]:', err);
    return { success: false, error: err.message };
  }
}

