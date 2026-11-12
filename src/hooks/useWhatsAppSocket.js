import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

/**
 * ============================================================================
 * SMART RI'AYAH - USE WHATSAPP REALTIME SOCKET HOOK (SUPABASE CHANNEL)
 * Channel: 'whatsapp-room'
 * Mendengarkan dan memancarkan event pesan WhatsApp secara live via Supabase Realtime:
 * - 'whatsapp.status' (DLR laporan pengiriman pesan)
 * - 'whatsapp.incoming' (Pesan masuk dari wali santri)
 * - 'whatsapp.notification' (Live notifikasi gerbang/perizinan)
 * Berjalan langsung di Vercel tanpa perlu server WebSocket eksternal.
 * ============================================================================
 */

export function useWhatsAppSocket(options = {}) {
  const { 
    onStatusUpdate, 
    onIncomingMessage, 
    onNotification,
    autoConnect = true 
  } = options;

  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected'
  const [lastEvent, setLastEvent] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);
  const channelRef = useRef(null);

  const callbacksRef = useRef({ onStatusUpdate, onIncomingMessage, onNotification });
  useEffect(() => {
    callbacksRef.current = { onStatusUpdate, onIncomingMessage, onNotification };
  }, [onStatusUpdate, onIncomingMessage, onNotification]);

  const addEventToHistory = useCallback((eventName, payload) => {
    const eventItem = {
      id: payload?.id || `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      event: eventName,
      timestamp: new Date().toLocaleTimeString('id-ID'),
      data: payload
    };
    setLastEvent(eventItem);
    setEventHistory(prev => [eventItem, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (!autoConnect) return;

    // Inisialisasi Supabase Realtime Channel: 'whatsapp-room'
    const channel = supabase.channel('whatsapp-room', {
      config: {
        broadcast: { self: true, ack: false },
        presence: { key: 'smart-riayah-app' }
      }
    });

    channelRef.current = channel;

    // 1. Event: whatsapp.status
    channel.on('broadcast', { event: 'whatsapp.status' }, ({ payload }) => {
      console.log('⚡ [Supabase Realtime whatsapp.status]:', payload);
      addEventToHistory('whatsapp.status', payload);
      if (callbacksRef.current.onStatusUpdate) {
        callbacksRef.current.onStatusUpdate(payload);
      }
    });

    // 2. Event: whatsapp.incoming
    channel.on('broadcast', { event: 'whatsapp.incoming' }, ({ payload }) => {
      console.log('⚡ [Supabase Realtime whatsapp.incoming]:', payload);
      addEventToHistory('whatsapp.incoming', payload);
      if (callbacksRef.current.onIncomingMessage) {
        callbacksRef.current.onIncomingMessage(payload);
      }
    });

    // 3. Event: whatsapp.notification
    channel.on('broadcast', { event: 'whatsapp.notification' }, ({ payload }) => {
      console.log('⚡ [Supabase Realtime whatsapp.notification]:', payload);
      addEventToHistory('whatsapp.notification', payload);
      if (callbacksRef.current.onNotification) {
        callbacksRef.current.onNotification(payload);
      }
    });

    // Berlangganan channel
    channel.subscribe((status, err) => {
      console.log('📡 [Supabase Realtime whatsapp-room] Status:', status);
      if (status === 'SUBSCRIBED') {
        setConnectionStatus('connected');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setConnectionStatus('disconnected');
        if (err) console.warn('⚠️ [Supabase Realtime Error]:', err);
      } else {
        setConnectionStatus('connecting');
      }
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [autoConnect, addEventToHistory]);

  /**
   * Mengirim event langsung ke Supabase Realtime channel 'whatsapp-room'
   */
  const broadcastEvent = useCallback(async (event, data) => {
    try {
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event,
          payload: data
        });
      }
      return { success: true, event, data };
    } catch (err) {
      console.error('❌ [useWhatsAppSocket broadcastEvent Error]:', err);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Helper simulasi: Pesan masuk dari wali santri
   */
  const simulateIncomingMessage = useCallback(async (customData = {}) => {
    const payload = {
      id: `IN-${Date.now()}`,
      pengirim: customData.pengirim || 'Hj. Siti Aminah (Wali Fatih)',
      nomor: customData.nomor || '0812-9876-5432',
      santriNama: customData.santriNama || 'Muhammad Fatih Robbani',
      pesan: customData.pesan || 'Assalamu’alaikum, terima kasih infonya Ustadz. Ananda sudah tiba di asrama dengan selamat.',
      waktu: new Date().toLocaleTimeString('id-ID'),
      tipe: 'INCOMING_REPLY',
      ...customData
    };

    return await broadcastEvent('whatsapp.incoming', payload);
  }, [broadcastEvent]);

  /**
   * Helper simulasi: Pembaruan status pengiriman (DELIVERED / READ)
   */
  const simulateStatusUpdate = useCallback(async (customData = {}) => {
    const payload = {
      id: customData.id || `WA-${Date.now()}`,
      status: customData.status || 'READ',
      penerima: customData.penerima || 'Wali Santri',
      nomor: customData.nomor || '628813576012',
      waktu: new Date().toLocaleTimeString('id-ID'),
      latencyMs: customData.latencyMs || Math.floor(120 + Math.random() * 200),
      ...customData
    };

    return await broadcastEvent('whatsapp.status', payload);
  }, [broadcastEvent]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    lastEvent,
    eventHistory,
    broadcastEvent,
    simulateIncomingMessage,
    simulateStatusUpdate
  };
}

export default useWhatsAppSocket;
