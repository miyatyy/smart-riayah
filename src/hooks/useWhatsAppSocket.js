import { useState, useEffect, useRef, useCallback } from 'react';
import { getSoketiPusher } from '../utils/soketiClient';
import { soketiConfig } from '../utils/soketiConfig';

/**
 * ============================================================================
 * SMART RI'AYAH - USE WHATSAPP SOCKET HOOK
 * Hook listener WebSocket real-time untuk Soketi & Redis event WhatsApp:
 * - whatsapp.status (DLR / laporan pengiriman pesan)
 * - whatsapp.incoming (Pesan masuk dari wali santri)
 * - whatsapp.notification (Live event alert sistem)
 * ============================================================================
 */

export function useWhatsAppSocket(options = {}) {
  const { 
    onStatusUpdate, 
    onIncomingMessage, 
    onNotification,
    autoConnect = true 
  } = options;

  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected' | 'unavailable'
  const [lastEvent, setLastEvent] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);
  const channelRef = useRef(null);

  // Callback references to avoid re-subscribing on each render
  const callbacksRef = useRef({ onStatusUpdate, onIncomingMessage, onNotification });
  useEffect(() => {
    callbacksRef.current = { onStatusUpdate, onIncomingMessage, onNotification };
  }, [onStatusUpdate, onIncomingMessage, onNotification]);

  const addEventToHistory = useCallback((eventName, payload) => {
    const eventItem = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      event: eventName,
      timestamp: new Date().toLocaleTimeString('id-ID'),
      data: payload
    };
    setLastEvent(eventItem);
    setEventHistory(prev => [eventItem, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (!autoConnect) return;

    const pusher = getSoketiPusher();
    if (!pusher) {
      setConnectionStatus('unavailable');
      return;
    }

    // Bind connection states
    const handleStateChange = (states) => {
      setConnectionStatus(states.current);
    };

    pusher.connection.bind('state_change', handleStateChange);
    setConnectionStatus(pusher.connection.state);

    // Subscribe to WhatsApp channel
    const channel = pusher.subscribe(soketiConfig.channelName);
    channelRef.current = channel;

    // 1. Event: whatsapp.status
    channel.bind('whatsapp.status', (data) => {
      console.log('⚡ [WebSocket whatsapp.status]:', data);
      addEventToHistory('whatsapp.status', data);
      if (callbacksRef.current.onStatusUpdate) {
        callbacksRef.current.onStatusUpdate(data);
      }
    });

    // 2. Event: whatsapp.incoming
    channel.bind('whatsapp.incoming', (data) => {
      console.log('⚡ [WebSocket whatsapp.incoming]:', data);
      addEventToHistory('whatsapp.incoming', data);
      if (callbacksRef.current.onIncomingMessage) {
        callbacksRef.current.onIncomingMessage(data);
      }
    });

    // 3. Event: whatsapp.notification
    channel.bind('whatsapp.notification', (data) => {
      console.log('⚡ [WebSocket whatsapp.notification]:', data);
      addEventToHistory('whatsapp.notification', data);
      if (callbacksRef.current.onNotification) {
        callbacksRef.current.onNotification(data);
      }
    });

    return () => {
      if (channel) {
        channel.unbind_all();
        pusher.unsubscribe(soketiConfig.channelName);
      }
      pusher.connection.unbind('state_change', handleStateChange);
    };
  }, [autoConnect, addEventToHistory]);

  /**
   * Mengirim event melalui backend API WhatsApp Broadcaster
   */
  const broadcastEvent = useCallback(async (event, data) => {
    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          data,
          channel: soketiConfig.channelName
        })
      });
      return await res.json();
    } catch (err) {
      console.warn('⚠️ [useWhatsAppSocket] broadcastEvent gagal kirim ke backend:', err.message);
      // Fallback lokal dispatch jika backend belum aktif
      addEventToHistory(event, data);
      if (event === 'whatsapp.status' && callbacksRef.current.onStatusUpdate) {
        callbacksRef.current.onStatusUpdate(data);
      } else if (event === 'whatsapp.incoming' && callbacksRef.current.onIncomingMessage) {
        callbacksRef.current.onIncomingMessage(data);
      }
      return { success: true, simulated: true };
    }
  }, [addEventToHistory]);

  /**
   * Helper simulasi: Pesan masuk dari wali santri
   */
  const simulateIncomingMessage = useCallback(async (customData = {}) => {
    const payload = {
      id: `IN-${Date.now()}`,
      pengirim: customData.pengirim || 'Hj. Siti Aminah (Wali Fatih)',
      nomor: customData.nomor || '0812-9876-5432',
      santriNama: customData.santriNama || 'Muhammad Fatih Robbani',
      pesan: customData.pesan || 'Assalamu’alaikum, terima kasih infonya Ustadz. Ananda sudah tiba di asrama.',
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
      nomor: customData.nomor || '08813576012',
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

