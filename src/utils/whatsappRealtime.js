import { supabase } from './supabaseClient.js';

/**
 * ============================================================================
 * SMART RI'AYAH - SUPABASE REALTIME WHATSAPP BROADCAST SERVICE
 * Channel: 'whatsapp-room'
 * Menyiarkan dan mendengarkan event komunikasi WhatsApp secara live via Supabase Realtime:
 * - 'whatsapp.status' (DLR laporan pengiriman pesan)
 * - 'whatsapp.incoming' (Pesan masuk dari wali santri)
 * - 'whatsapp.notification' (Notifikasi live gate / asrama)
 * ============================================================================
 */

let realtimeChannel = null;

export function getWhatsAppRealtimeChannel() {
  if (!realtimeChannel) {
    realtimeChannel = supabase.channel('whatsapp-room', {
      config: {
        broadcast: { self: true, ack: false },
        presence: { key: 'smart-riayah-web' }
      }
    });

    realtimeChannel.subscribe((status) => {
      console.log('📡 [Supabase Realtime whatsapp-room] Status:', status);
    });
  }

  return realtimeChannel;
}

async function waitForChannelJoined(channel, timeoutMs = 2000) {
  if (!channel) return false;
  if (channel.state === 'joined') return true;
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (channel.state === 'joined') {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 60);
  });
}

/**
 * Mengirimkan event broadcast ke channel 'whatsapp-room' di Supabase
 *
 * @param {string} event - Nama event ('whatsapp.status' | 'whatsapp.incoming' | 'whatsapp.notification')
 * @param {Object} payload - Data event
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function sendWhatsAppBroadcast(event, payload) {
  try {
    const channel = getWhatsAppRealtimeChannel();
    await waitForChannelJoined(channel, 2000);
    await channel.send({
      type: 'broadcast',
      event,
      payload
    });
    console.log(`📤 [Supabase Realtime Broadcast] "${event}" terkirim:`, payload);
    return { success: true };
  } catch (err) {
    console.warn(`⚠️ [Supabase Realtime Broadcast Gagal] ${event}:`, err);
    return { success: false, error: err };
  }
}

