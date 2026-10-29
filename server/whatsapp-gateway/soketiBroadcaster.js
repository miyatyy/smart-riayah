import { redisPublisher } from './redisClient.js';
import crypto from 'crypto';

/**
 * ============================================================================
 * SMART RI'AYAH - SOKETI & WEBSOCKET EVENT BROADCASTER
 * Menyebarkan event pesan WhatsApp secara real-time ke Soketi (Pusher protocol)
 * dan Redis Pub/Sub untuk push live ke browser pengguna.
 * ============================================================================
 */

const SOKETI_HOST = process.env.SOKETI_HOST || '127.0.0.1';
const SOKETI_PORT = process.env.SOKETI_PORT || '6001';
const SOKETI_APP_ID = process.env.SOKETI_APP_ID || 'smart-riayah-app';
const SOKETI_APP_KEY = process.env.SOKETI_APP_KEY || 'smart-riayah-key';
const SOKETI_APP_SECRET = process.env.SOKETI_APP_SECRET || 'smart-riayah-secret';

const DEFAULT_CHANNEL = 'whatsapp-channel';

/**
 * Menghitung signature auth Pusher/Soketi untuk REST API push
 */
function generateAuthSignature(method, path, bodyStr, timestamp) {
  const md5Body = crypto.createHash('md5').update(bodyStr).digest('hex');
  const authQuery = `auth_key=${SOKETI_APP_KEY}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${md5Body}`;
  const stringToSign = `${method}\n${path}\n${authQuery}`;
  const authSignature = crypto.createHmac('sha256', SOKETI_APP_SECRET).update(stringToSign).digest('hex');
  return { authQuery, authSignature };
}

/**
 * Mengirimkan event ke Soketi REST API
 */
async function pushToSoketiHttp(channel, event, data) {
  const body = JSON.stringify({
    name: event,
    channels: [channel],
    data: typeof data === 'string' ? data : JSON.stringify(data)
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const path = `/apps/${SOKETI_APP_ID}/events`;
  const { authQuery, authSignature } = generateAuthSignature('POST', path, body, timestamp);
  const url = `http://${SOKETI_HOST}:${SOKETI_PORT}${path}?${authQuery}&auth_signature=${authSignature}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, status: res.status, error: errText };
    }

    return { success: true };
  } catch (error) {
    // Jika Soketi belum berjalan secara lokal, tangkap tanpa melempar error tak terduga
    return { success: false, error: error.message };
  }
}

/**
 * Broadcaster utama: Publikasikan ke Redis & Push ke Soketi
 * 
 * @param {string} event - Nama event (misal: 'whatsapp.status', 'whatsapp.incoming')
 * @param {Object} data - Payload data event
 * @param {string} [channel='whatsapp-channel'] - Nama channel websocket
 */
export async function broadcastWhatsAppEvent(event, data, channel = DEFAULT_CHANNEL) {
  const payload = {
    event,
    channel,
    timestamp: new Date().toISOString(),
    data
  };

  const results = {
    redis: false,
    soketi: false
  };

  // 1. Publikasikan ke Redis Message Broker
  try {
    if (redisPublisher) {
      await redisPublisher.publish(channel, JSON.stringify(payload));
      results.redis = true;
    }
  } catch (err) {
    console.warn('⚠️ [SoketiBroadcaster] Redis publish gagal:', err.message);
  }

  // 2. Kirim ke Soketi HTTP API
  try {
    const soketiRes = await pushToSoketiHttp(channel, event, data);
    results.soketi = soketiRes.success;
  } catch (err) {
    console.warn('⚠️ [SoketiBroadcaster] Soketi push gagal:', err.message);
  }

  console.log(`📡 [Broadcaster] Event "${event}" dipublikasikan ke channel "${channel}":`, {
    redis: results.redis ? 'OK' : 'SKIP',
    soketi: results.soketi ? 'OK' : 'OFFLINE'
  });

  return results;
}

/**
 * 1. Broadcast pembaruan status pengiriman pesan WhatsApp (SENT, DELIVERED, READ, FAILED)
 */
export async function broadcastWhatsAppStatus(statusData) {
  return await broadcastWhatsAppEvent('whatsapp.status', {
    id: statusData.id || `WA-${Date.now()}`,
    penerima: statusData.penerima,
    nomor: statusData.nomor,
    status: statusData.status || 'DELIVERED', // 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
    latencyMs: statusData.latencyMs || null,
    latencySec: statusData.latencySec || null,
    waktu: statusData.waktu || new Date().toLocaleTimeString('id-ID'),
    keterangan: statusData.keterangan || 'Status berhasil diperbarui via live gateway'
  });
}

/**
 * 2. Broadcast pesan masuk dari wali santri / kontak WhatsApp
 */
export async function broadcastWhatsAppIncoming(incomingData) {
  return await broadcastWhatsAppEvent('whatsapp.incoming', {
    id: incomingData.id || `IN-${Date.now()}`,
    pengirim: incomingData.pengirim || 'Wali Santri',
    nomor: incomingData.nomor,
    santriNama: incomingData.santriNama || null,
    pesan: incomingData.pesan,
    waktu: incomingData.waktu || new Date().toLocaleTimeString('id-ID'),
    tipe: incomingData.tipe || 'INCOMING_REPLY'
  });
}

/**
 * 3. Broadcast notifikasi live gateway (Smart Gate, Perizinan, Kesehatan)
 */
export async function broadcastWhatsAppNotification(notifData) {
  return await broadcastWhatsAppEvent('whatsapp.notification', {
    id: notifData.id || `NOTIF-${Date.now()}`,
    tipe: notifData.tipe || 'GATE_EXIT',
    penerima: notifData.penerima,
    nomor: notifData.nomor,
    pesan: notifData.pesan,
    status: notifData.status || 'SENT',
    waktu: notifData.waktu || new Date().toLocaleTimeString('id-ID')
  });
}

