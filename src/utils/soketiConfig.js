/**
 * ============================================================================
 * SMART RI'AYAH - SOKETI WEBSOCKET CONFIGURATION (MODULAR)
 * Konfigurasi koneksi WebSocket client (Pusher Protocol) ke Soketi server.
 * ============================================================================
 */

export const soketiConfig = {
  appKey: import.meta.env.VITE_SOKETI_APP_KEY || 'smart-riayah-key',
  wsHost: import.meta.env.VITE_SOKETI_HOST || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'),
  wsPort: parseInt(import.meta.env.VITE_SOKETI_PORT || '6001', 10),
  forceTLS: import.meta.env.VITE_SOKETI_USE_TLS === 'true' || false,
  enabledTransports: ['ws', 'wss'],
  cluster: 'mt1',
  channelName: 'whatsapp-channel'
};

