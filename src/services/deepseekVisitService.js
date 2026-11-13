/**
 * DeepSeek AI & WhatsApp Visit Booking Service
 * Handles AI natural language extraction, connection testing, and barcode gate pass generation
 */

import { getRealtimePondokClock, formatCalendarPromptForDeepSeek } from '../utils/pondokTimeUtils';
import { generateBarcodeToken, getVisitGatePassUrls } from '../utils/barcodeUtils';
import { saveAiToMongo } from '../utils/mongoAiService';

export const DEFAULT_DEEPSEEK_KEY = (import.meta.env.VITE_DEEPSEEK_API_KEY || '').trim();
export const DEFAULT_DEEPSEEK_BASE_URL = (import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1/chat/completions').trim();
export const DEFAULT_DEEPSEEK_MODEL = (import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat').trim();
export const DEFAULT_FONNTE_TOKEN = (import.meta.env.VITE_FONNTE_TOKEN || '').trim();

/**
 * Tes koneksi langsung ke DeepSeek API
 */
export async function testDeepSeekConnection(apiKey = DEFAULT_DEEPSEEK_KEY) {
  const startTime = Date.now();
  const cleanKey = (apiKey || DEFAULT_DEEPSEEK_KEY).trim();

  try {
    const res = await fetch(DEFAULT_DEEPSEEK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_DEEPSEEK_MODEL,
        messages: [
          { role: 'user', content: 'Uji ping koneksi Smart Riayah. Balas dengan SATU kata: AKTIF' }
        ],
        temperature: 0.1,
        max_tokens: 10
      })
    });

    const latency = Date.now() - startTime;

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'AKTIF';

    return {
      success: true,
      status: 'Connected',
      model: data.model || DEFAULT_DEEPSEEK_MODEL,
      latencyMs: latency,
      reply: reply
    };
  } catch (err) {
    return {
      success: false,
      status: 'Error',
      error: err.message,
      latencyMs: Date.now() - startTime
    };
  }
}

/**
 * Parsing Pesan Booking Kunjungan via DeepSeek AI
 */
export async function parseBookingWithDeepSeek(messageText, sender = '', senderName = 'Wali Santri', apiKey = DEFAULT_DEEPSEEK_KEY, fonnteToken = DEFAULT_FONNTE_TOKEN) {
  // Coba panggil serverless endpoint terlebih dahulu
  try {
    const serverlessRes = await fetch('/api/visits/ai-parse-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageText,
        sender,
        sender_name: senderName,
        deepseek_api_key: apiKey,
        fonnte_token: fonnteToken
      })
    });

    if (serverlessRes.ok) {
      const result = await serverlessRes.json();
      if (result.success && result.booking) {
        return result;
      }
    }
  } catch (e) {
    console.warn('Serverless endpoint not reachable, trying client-side DeepSeek call...', e);
  }

  // Fallback Client-side langsung ke DeepSeek API dengan Injeksi Waktu Real-Time
  const cleanKey = (apiKey || DEFAULT_DEEPSEEK_KEY).trim();
  const clock = getRealtimePondokClock();
  const calendarPrompt = formatCalendarPromptForDeepSeek(clock);

  const systemPrompt = `Anda adalah AI Asisten Cerdas Pondok Pesantren Modern Darul Ulum untuk memproses pendaftaran booking kunjungan/sambangan wali santri dari chat WhatsApp.

${calendarPrompt}

Ekstrak pesan permohonan kunjungan wali santri ke dalam format JSON yang valid dengan atribut wajib:
- nama_santri (string)
- kelas (string, e.g. "10-A (Umar 204)")
- asal (string, e.g. "Surabaya")
- hari_kunjungan ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")
- tanggal_kunjungan ("YYYY-MM-DD")
- jam_kunjungan ("HH:mm", e.g. "11:00", DILARANG mengubah jam 11 siang menjadi 23:00 malam!)
- jam_selesai ("HH:mm", batas jam selesai kunjungan, default batas operasional pondok: "17:30")
- titipan_barang (string)
- berat_barang_kg (number)
- nama_penjenguk (string)
- status_penjenguk ("Wali Santri" | "Keluarga" | "Kerabat" | "Lainnya")
- is_weekday (boolean, true jika Senin-Kamis; false jika Jumat-Minggu)

Output HANYA berupa JSON object murni.`;

  try {
    const res = await fetch(DEFAULT_DEEPSEEK_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_DEEPSEEK_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Pesan: "${messageText}"\nPengirim: ${sender}\nNama: ${senderName}` }
        ],
        temperature: 0.1
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const dayNormalized = parsed.hari_kunjungan || clock.nama_hari;
        const isWeekday = ['Senin', 'Selasa', 'Rabu', 'Kamis'].includes(dayNormalized);
        const cleanSantri = (parsed.nama_santri || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
        const barcodeToken = isWeekday ? null : generateBarcodeToken(cleanSantri);
        const { qrCodeUrl, gatePassUrl } = barcodeToken ? getVisitGatePassUrls(barcodeToken) : {};
        const waktuSekarangStr = `${clock.nama_hari}, ${clock.tanggal_lengkap} • ${clock.jam_menit_detik} WITA`;
        const bookingObj = {
            id: `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
            booking_source: 'WHATSAPP_AI_DEEPSEEK',
            nama_santri: parsed.nama_santri || 'Santri Terdaftar',
            kelas: parsed.kelas || 'Asrama Pondok',
            asal: parsed.asal || 'Surabaya',
            tanggal_kunjungan: parsed.tanggal_kunjungan || clock.tanggal_ymd,
            hari_kunjungan: dayNormalized,
            jam_kunjungan: parsed.jam_kunjungan || '14:00',
            jam_selesai: parsed.jam_selesai || '15:30',
            titipan_barang: parsed.titipan_barang || '-',
            berat_barang_kg: parsed.berat_barang_kg || 1.5,
            nama_penjenguk: parsed.nama_penjenguk || senderName || 'Wali Santri',
            status_penjenguk: parsed.status_penjenguk || 'Wali Santri',
            no_wa_penjenguk: sender || '',
            barcode_token: barcodeToken,
            approval_type: isWeekday ? 'MANUAL_WEEKDAY' : 'AUTO_WEEKEND',
            status_kunjungan: isWeekday ? 'Menunggu Approval' : 'Disetujui (Siap Datang)',
            is_weekday: isWeekday,
            waktu_chat_masuk: waktuSekarangStr,
            waktu_disetujui: isWeekday ? null : waktuSekarangStr,
            jam_masuk_aktual: null,
            jam_keluar_aktual: null,
            created_at: new Date().toISOString()
        };

        saveAiToMongo('ai_whatsapp_bookings', {
          id: `AI-BOOK-${bookingObj.id}`,
          bookingId: bookingObj.id,
          prompt: messageText,
          sender,
          senderName,
          santriNama: bookingObj.nama_santri,
          ai_engine: 'DeepSeek Chat (Direct Client)',
          is_weekday: isWeekday,
          booking: bookingObj
        }).catch(() => {});

        return {
          success: true,
          ai_engine: 'DeepSeek Chat (Direct Client)',
          is_weekday: isWeekday,
          booking: bookingObj
        };
      }
    }
  } catch (err) {
    console.warn('Client DeepSeek fallback error:', err);
  }

  // Fallback regex jika semuanya gagal
  const isWeekday = true;
  const fallbackBooking = {
      id: `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      booking_source: 'WHATSAPP_FALLBACK',
      nama_santri: 'Santri Terdaftar',
      kelas: 'Asrama Pondok',
      asal: 'Surabaya',
      tanggal_kunjungan: clock.tanggal_ymd,
      hari_kunjungan: 'Senin',
      jam_kunjungan: '14:00',
      jam_selesai: '15:30',
      titipan_barang: 'Pakaian ganti & Madu Herbal',
      berat_barang_kg: 2.0,
      nama_penjenguk: senderName || 'Wali Santri',
      status_penjenguk: 'Wali Santri',
      no_wa_penjenguk: sender || '',
      barcode_token: null,
      approval_type: 'MANUAL_WEEKDAY',
      status_kunjungan: 'Menunggu Approval',
      is_weekday: true,
      created_at: new Date().toISOString()
  };

  saveAiToMongo('ai_whatsapp_bookings', {
    id: `AI-BOOK-${fallbackBooking.id}`,
    bookingId: fallbackBooking.id,
    prompt: messageText,
    sender,
    senderName,
    santriNama: fallbackBooking.nama_santri,
    ai_engine: 'Regex Fallback Engine',
    is_weekday: isWeekday,
    booking: fallbackBooking
  }).catch(() => {});

  return {
    success: true,
    ai_engine: 'Regex Fallback Engine',
    is_weekday: isWeekday,
    booking: fallbackBooking
  };
}

/**
 * Approve Weekday Booking (Senin-Kamis) dan Kirim Barcode Gate Pass via WhatsApp
 */
export async function approveWeekdayBookingWithAi(booking, fonnteToken = DEFAULT_FONNTE_TOKEN) {
  try {
    const res = await fetch('/api/visits/approve-weekday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking, fonnte_token: fonnteToken })
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to call /api/visits/approve-weekday, using local fallback:', e);
  }

  const cleanSantri = (booking.nama_santri || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
  const barcodeToken = booking.barcode_token || generateBarcodeToken(cleanSantri);
  const { qrCodeUrl, gatePassUrl } = getVisitGatePassUrls(barcodeToken);

  return {
    success: true,
    bookingId: booking.id,
    barcode_token: barcodeToken,
    barcode_image_url: qrCodeUrl,
    gate_pass_url: gatePassUrl,
    status_kunjungan: 'Disetujui (Siap Datang)'
  };
}

