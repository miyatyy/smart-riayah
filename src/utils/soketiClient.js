import Pusher from 'pusher-js';
import { soketiConfig } from './soketiConfig';

/**
 * ============================================================================
 * SMART RI'AYAH - SOKETI PUSHER WEBSOCKET CLIENT
 * Mengelola instance singleton WebSocket Pusher-JS yang tersambung ke Soketi.
 * ============================================================================
 */

let pusherInstance = null;

export function getSoketiPusher() {
  if (typeof window === 'undefined') return null;

  if (!pusherInstance) {
    try {
      pusherInstance = new Pusher(soketiConfig.appKey, {
        wsHost: soketiConfig.wsHost,
        wsPort: soketiConfig.wsPort,
        forceTLS: soketiConfig.forceTLS,
        disableStats: true,
        enabledTransports: soketiConfig.enabledTransports,
        cluster: soketiConfig.cluster
      });

      pusherInstance.connection.bind('connected', () => {
        console.log(`🟢 [Soketi WebSocket] Terhubung ke ws://${soketiConfig.wsHost}:${soketiConfig.wsPort}`);
      });

      pusherInstance.connection.bind('disconnected', () => {
        console.info('🟡 [Soketi WebSocket] Terputus (Disconnected)');
      });

      pusherInstance.connection.bind('failed', () => {
        console.warn('⚠️ [Soketi WebSocket] Koneksi gagal (Offline / Soketi belum dijalankan)');
      });
    } catch (err) {
      console.warn('⚠️ [Soketi WebSocket] Inisialisasi error:', err.message);
    }
  }

  return pusherInstance;
}

export function disconnectSoketi() {
  if (pusherInstance) {
    try {
      pusherInstance.disconnect();
      pusherInstance = null;
    } catch (e) {}
  }
}

