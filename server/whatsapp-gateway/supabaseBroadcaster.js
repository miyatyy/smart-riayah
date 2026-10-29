import { createClient } from '@supabase/supabase-js';

/**
 * ============================================================================
 * SMART RI'AYAH - SUPABASE REALTIME SERVER BROADCASTER
 * Channel: 'whatsapp-room'
 * Menyiarkan event webhook WhatsApp langsung ke Supabase Realtime tanpa WebSocket daemon eksternal.
 * ============================================================================
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://htjnrpyuzkarigglgrxm.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_WQ7Ix8DuKxlVdv_dnwBspw_cXbdkADI';

let serverSupabase = null;
let serverChannel = null;

try {
  serverSupabase = createClient(supabaseUrl, supabaseKey);
  serverChannel = serverSupabase.channel('whatsapp-room');
  serverChannel.subscribe((status) => {
    console.log('📡 [Server Supabase Realtime whatsapp-room] Subscribed:', status);
  });
} catch (e) {
  console.warn('⚠️ [Server Supabase Realtime] Inisialisasi gagal:', e.message);
}

export async function broadcastToSupabaseRealtime(event, payload) {
  try {
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

