/**
 * Smart Ri'ayah - Autonomous AI Responder for WhatsApp Gateway
 * Otak AI Otonom yang membalas pesan masuk dari Wali Santri secara instan via Fonnte API
 */

import { createClient } from '@supabase/supabase-js';
import { broadcastToSupabaseRealtime } from './supabaseBroadcaster.js';
import { saveAiDocument } from '../mongo.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null }), eq: () => ({ like: async () => ({}) }) }), delete: () => ({ eq: () => ({ like: async () => ({}) }) }), insert: async () => ({}) }) };

const DEFAULT_FONNTE_TOKEN = (process.env.FONNTE_TOKEN || process.env.VITE_FONNTE_TOKEN || '').trim();

// In-memory set penyimpan nomor HP yang sedang diambil alih manual oleh Admin Ri'ayah
export const manualTakeoverPhones = new Set();

/**
 * Simpan / perbarui status Mode Ambil Alih Manual ke Supabase & In-Memory Cache
 */
export async function setManualTakeover(phone, isManual) {
  const clean = normalizePhone(phone);
  const digits = String(clean).replace(/[^0-9]/g, '');
  if (!digits) return false;
  const last8 = digits.slice(-8);

  if (isManual) {
    manualTakeoverPhones.add(clean);
    try {
      // 1. Bersihkan record lama untuk nomor ini di Supabase messages table
      await supabase
        .from('messages')
        .delete()
        .eq('room_id', 'whatsapp_takeover')
        .like('message_text', `%${last8}%`);

      // 2. Insert record baru sebagai penanda bahwa nomor ini sedang di-takeover manual
      const { error } = await supabase
        .from('messages')
        .insert([{
          room_id: 'whatsapp_takeover',
          sender_email: 'admin@smartriayah.com',
          sender_name: 'Admin Ri\'ayah',
          sender_role: 'admin',
          message_text: clean,
          reaction: 'MANUAL_TAKEOVER',
          is_read: false
        }]);

      if (error) {
        console.warn('⚠️ [Supabase setManualTakeover insert error]:', error.message);
      } else {
        console.log(`✅ [Supabase setManualTakeover SUCCESS]: ${clean} kini dalam MODE AMBIL ALIH MANUAL`);
      }
    } catch (err) {
      console.warn('⚠️ [Supabase setManualTakeover exception]:', err.message);
    }
    return true;
  } else {
    manualTakeoverPhones.delete(clean);
    const alt = clean.startsWith('62') ? '0' + clean.slice(2) : (clean.startsWith('0') ? '62' + clean.slice(1) : clean);
    manualTakeoverPhones.delete(alt);

    try {
      // Hapus status takeover dari Supabase messages table
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', 'whatsapp_takeover')
        .like('message_text', `%${last8}%`);

      if (error) {
        console.warn('⚠️ [Supabase removeManualTakeover error]:', error.message);
      } else {
        console.log(`✅ [Supabase removeManualTakeover SUCCESS]: ${clean} dikembalikan ke MODE OTONOM`);
      }
    } catch (err) {
      console.warn('⚠️ [Supabase removeManualTakeover exception]:', err.message);
    }
    return false;
  }
}

/**
 * Cek apakah nomor sedang dalam Mode Ambil Alih Manual (Cek In-Memory & Supabase)
 */
export async function isPhoneInManualTakeover(phone) {
  const clean = normalizePhone(phone);
  const digits = String(clean).replace(/[^0-9]/g, '');
  if (!digits) return false;
  const last8 = digits.slice(-8);

  // 1. Cek in-memory set (fast path)
  if (manualTakeoverPhones.has(clean)) return true;
  for (const p of manualTakeoverPhones) {
    if (clean.endsWith(p.slice(-8)) || p.endsWith(clean.slice(-8))) {
      return true;
    }
  }

  // 2. Cek Supabase (persistent across all Vercel Serverless Lambdas)
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('message_text, reaction')
      .eq('room_id', 'whatsapp_takeover');

    if (!error && Array.isArray(data) && data.length > 0) {
      const match = data.some(row => {
        const rowDigits = String(row.message_text || '').replace(/[^0-9]/g, '');
        return rowDigits && (rowDigits.endsWith(last8) || digits.endsWith(rowDigits.slice(-8)));
      });

      if (match) {
        console.log(`🔒 [Supabase Verified]: Nomor ${clean} TERBUKTI sedang dalam MODE AMBIL ALIH MANUAL oleh Admin!`);
        manualTakeoverPhones.add(clean);
        return true;
      }
    }
  } catch (err) {
    console.warn('⚠️ [Check Takeover Supabase Error]:', err.message);
  }

  return false;
}

// Database referensi cepat Wali & Santri Pesantren Darul Ulum
const KNOWN_WALI_MAP = {
  '6285960213654': {
    namaWali: 'Ibu Fatimah Az-Zahra',
    santriNama: 'Ahmad Fauzi',
    nis: '2024001',
    kelas: '10-A (Unggulan Tahfizh)',
    kamar: 'Kamar Umar bin Khattab 204 Lt. 2',
    saldoRfid: 'Rp 85.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '96/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Aktif Mengikuti Halaqah & Sholat Berjamaah)',
    izinTerakhir: 'Tertib / Tidak ada pelanggaran'
  },
  '085960213654': {
    namaWali: 'Ibu Fatimah Az-Zahra',
    santriNama: 'Ahmad Fauzi',
    nis: '2024001',
    kelas: '10-A (Unggulan Tahfizh)',
    kamar: 'Kamar Umar bin Khattab 204 Lt. 2',
    saldoRfid: 'Rp 85.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '96/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Aktif Mengikuti Halaqah & Sholat Berjamaah)',
    izinTerakhir: 'Tertib / Tidak ada pelanggaran'
  },
  '08813576012': {
    namaWali: 'Ibu Fatimah Az-Zahra',
    santriNama: 'Ahmad Fauzi',
    nis: '2024001',
    kelas: '10-A (Unggulan Tahfizh)',
    kamar: 'Kamar Umar bin Khattab 204 Lt. 2',
    saldoRfid: 'Rp 85.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '96/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Aktif Mengikuti Halaqah & Sholat Berjamaah)',
    izinTerakhir: 'Tertib / Tidak ada pelanggaran'
  },
  '628813576012': {
    namaWali: 'Ibu Fatimah Az-Zahra',
    santriNama: 'Ahmad Fauzi',
    nis: '2024001',
    kelas: '10-A (Unggulan Tahfizh)',
    kamar: 'Kamar Umar bin Khattab 204 Lt. 2',
    saldoRfid: 'Rp 85.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '96/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Aktif Mengikuti Halaqah & Sholat Berjamaah)',
    izinTerakhir: 'Tertib / Tidak ada pelanggaran'
  },
  '08124455890': {
    namaWali: 'Bpk. Hendra Gunawan',
    santriNama: 'Muhammad Rayhan',
    nis: '2024002',
    kelas: '11-B (IPA)',
    kamar: 'Kamar Abu Bakar 102 Lt. 1',
    saldoRfid: 'Rp 45.000',
    limitHarian: 'Rp 20.000',
    poinDisiplin: '88/100 (Jayyid Jiddan)',
    statusAsrama: 'Sedang Izin Pulang (Batas Kembali: Ahad 17.00 WIB)',
    izinTerakhir: 'Izin Sakit / Rawat Jalan'
  },
  '628124455890': {
    namaWali: 'Bpk. Hendra Gunawan',
    santriNama: 'Muhammad Rayhan',
    nis: '2024002',
    kelas: '11-B (IPA)',
    kamar: 'Kamar Abu Bakar 102 Lt. 1',
    saldoRfid: 'Rp 45.000',
    limitHarian: 'Rp 20.000',
    poinDisiplin: '88/100 (Jayyid Jiddan)',
    statusAsrama: 'Sedang Izin Pulang (Batas Kembali: Ahad 17.00 WIB)',
    izinTerakhir: 'Izin Sakit / Rawat Jalan'
  },
  '08567890123': {
    namaWali: 'Ibu Siti Khadijah',
    santriNama: 'Aisyah Putri',
    nis: '2024003',
    kelas: '10-C (Putri)',
    kamar: 'Kamar Khadijah 105 Lt. 1',
    saldoRfid: 'Rp 65.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '94/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Kondisi Sehat di Asrama Putri)',
    izinTerakhir: 'Tertib / Izin Sambangan Keluarga'
  },
  '628567890123': {
    namaWali: 'Ibu Siti Khadijah',
    santriNama: 'Aisyah Putri',
    nis: '2024003',
    kelas: '10-C (Putri)',
    kamar: 'Kamar Khadijah 105 Lt. 1',
    saldoRfid: 'Rp 65.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '94/100 (Mumtaz)',
    statusAsrama: 'Di Asrama (Kondisi Sehat di Asrama Putri)',
    izinTerakhir: 'Tertib / Izin Sambangan Keluarga'
  }
};

/**
 * Normalisasi nomor HP Indonesia
 */
export function normalizePhone(raw) {
  let clean = String(raw || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('08')) {
    clean = '628' + clean.slice(2);
  } else if (clean.startsWith('8')) {
    clean = '628' + clean.slice(1);
  }
  return clean;
}

/**
 * Cari data Santri & Wali real-time dari Supabase (Mendukung update ganti nomor dari Tabel RFID)
 */
export async function findLiveSantriByPhone(cleanPhone) {
  try {
    const digits = String(cleanPhone || '').replace(/[^0-9]/g, '');
    if (digits.length >= 7) {
      const last8 = digits.slice(-8);

      const { data, error } = await supabase
        .from('santri')
        .select('*');

      if (!error && Array.isArray(data)) {
        const matched = data.find(s => {
          const sWaliDigits = String(s.no_wali || '').replace(/[^0-9]/g, '');
          return sWaliDigits && (sWaliDigits.endsWith(last8) || digits.endsWith(sWaliDigits.slice(-8)));
        });

        if (matched) {
          console.log(`🎯 [Supabase Match]: Nomor ${cleanPhone} teridentifikasi sebagai Wali dari Santri ${matched.nama_lengkap}`);
          return {
            namaWali: matched.nama_wali || 'Bapak/Ibu Wali Santri',
            santriNama: matched.nama_lengkap,
            nis: matched.nis || '-',
            kelas: matched.kelas || 'Santri Darul Ulum',
            kamar: matched.kamar || 'Asrama Darul Ulum',
            saldoRfid: `Rp ${Number(matched.saldo_rfid || matched.saldo_awal || 0).toLocaleString('id-ID')}`,
            limitHarian: `Rp ${Number(matched.limit_jajan_harian || 25000).toLocaleString('id-ID')}`,
            poinDisiplin: `${matched.poin_disiplin || 100}/100 (Mumtaz)`,
            statusAsrama: matched.status_asrama === 'DI_ASRAMA' ? 'Di Asrama (Aktif Sholat Berjamaah & Halaqah)' : (matched.status_asrama || 'Di Lingkungan Pondok'),
            izinTerakhir: 'Tertib di Asrama'
          };
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ [findLiveSantriByPhone error]:', err.message);
  }
  return null;
}

/**
 * Helper salam natural: Hanya menjawab salam jika lawan bicara mengucap salam
 */
function getNaturalGreeting(incomingText, name = '') {
  const text = String(incomingText || '').toLowerCase();
  const hasSalam =
    text.includes('assalamu') ||
    text.includes('aslam') ||
    text.includes('ass ') ||
    text.includes('mikum') ||
    text.includes('kumsalam');

  const targetName = name && name !== 'Wali Santri' ? name : 'Bapak/Ibu';

  if (hasSalam) {
    return `Wa'alaikumsalam ${targetName}. `;
  }
  if (text.includes('pagi')) return `Selamat pagi ${targetName}. `;
  if (text.includes('siang')) return `Selamat siang ${targetName}. `;
  if (text.includes('sore')) return `Selamat sore ${targetName}. `;
  if (text.includes('malam')) return `Selamat malam ${targetName}. `;

  return `Halo ${targetName}, `;
}

/**
 * Helper waktu pondok real-time (WITA / Asia/Makassar) untuk backend
 */
function getRealtimePondokClockBackend() {
  const d = new Date();
  const namaHariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayIndex = d.getDay();
  const namaHari = namaHariArr[dayIndex];
  const ymd = d.toISOString().slice(0, 10);
  const tglLengkap = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const jamMenit = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  const jamMenitDetik = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const isWeekday = dayIndex >= 1 && dayIndex <= 4; // Senin - Kamis

  const refDays = [];
  for (let i = 0; i < 7; i++) {
    const cd = new Date(d);
    cd.setDate(d.getDate() + i);
    const cdDay = namaHariArr[cd.getDay()];
    const cdYmd = cd.toISOString().slice(0, 10);
    const cdIsWeekday = cd.getDay() >= 1 && cd.getDay() <= 4;
    refDays.push({
      offset: i,
      label: i === 0 ? 'Hari ini' : (i === 1 ? 'Besok' : (i === 2 ? 'Lusa' : `${cdDay} depan`)),
      hari: cdDay,
      tanggal: cdYmd,
      is_weekday: cdIsWeekday,
      rule: cdIsWeekday ? 'Wajib Approval Admin Ri\'ayah' : 'Auto-Approved (Langsung Terbit Barcode)'
    });
  }

  return {
    dayIndex,
    namaHari,
    ymd,
    tglLengkap,
    jamMenit,
    jamMenitDetik,
    isWeekday,
    refDays
  };
}

/**
 * Ambil riwayat chat terakhir untuk nomor HP ini agar percakapan berkesinambungan (multi-turn context)
 */
export async function getRecentChatHistory(cleanPhone) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('sender_role, message_text, created_at')
      .eq('room_id', `wa_${cleanPhone}`)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!error && Array.isArray(data)) {
      return data.reverse().map(m => ({
        role: m.sender_role === 'user' ? 'user' : 'assistant',
        content: m.message_text
      }));
    }
  } catch (e) {
    console.warn('getRecentChatHistory error:', e.message);
  }
  return [];
}

/**
 * Simpan pesan chat ke tabel messages Supabase
 */
export async function recordChatMessage(cleanPhone, role, text, senderName) {
  try {
    await supabase.from('messages').insert([{
      room_id: `wa_${cleanPhone}`,
      sender_email: role === 'user' ? `${cleanPhone}@whatsapp.user` : 'ai@smartriayah.com',
      sender_name: senderName || (role === 'user' ? 'Wali Santri' : 'Smart Riayah AI'),
      sender_role: role,
      message_text: text,
      is_read: true
    }]);
  } catch (e) {
    console.warn('recordChatMessage error:', e.message);
  }
}

/**
 * Simpan booking kunjungan ke antrean dan broadcast ke Supabase Realtime
 */
export async function saveBookingToSystem(bookingData) {
  try {
    await broadcastToSupabaseRealtime('whatsapp.visit_booking', bookingData);

    await supabase.from('messages').insert([{
      room_id: 'visit_bookings_log',
      sender_email: 'ai@smartriayah.com',
      sender_name: 'Smart Riayah AI Gate Pass',
      sender_role: 'system',
      message_text: JSON.stringify(bookingData),
      reaction: bookingData.is_weekday ? 'VISIT_MANUAL_WEEKDAY' : 'VISIT_AUTO_WEEKEND',
      is_read: false
    }]);

    console.log(`🎫 [Visit Booking Saved]: ${bookingData.id} for ${bookingData.nama_santri} (${bookingData.hari_kunjungan}) - ${bookingData.status_kunjungan}`);

    // Simpan juga data booking AI ke MongoDB collection 'ai_whatsapp_bookings'
    await saveAiDocument('ai_whatsapp_bookings', {
      id: `AI-BOOK-${bookingData.id}`,
      bookingId: bookingData.id,
      santriNama: bookingData.nama_santri,
      sender: bookingData.no_wa_penjenguk,
      senderName: bookingData.nama_penjenguk,
      ai_engine: bookingData.booking_source || 'AI_AUTONOMOUS_RESPONDER',
      is_weekday: bookingData.is_weekday,
      barcode_token: bookingData.barcode_token,
      status_kunjungan: bookingData.status_kunjungan,
      booking: bookingData
    }).catch(() => {});

    return true;
  } catch (err) {
    console.error('❌ [saveBookingToSystem Error]:', err.message);
    return false;
  }
}

/**
 * Otak AI Otonom: Menganalisis pesan dan menghasilkan balasan islami, natural & cerdas
 */
export async function generateAutonomousReply(senderPhone, incomingText, senderName = 'Wali Santri') {
  const cleanPhone = normalizePhone(senderPhone);

  // 1. Cek live database Supabase terlebih dahulu
  const liveWali = await findLiveSantriByPhone(cleanPhone);

  const waliData = liveWali || KNOWN_WALI_MAP[cleanPhone] || KNOWN_WALI_MAP[senderPhone] || {
    namaWali: senderName || 'Bapak/Ibu Wali Santri',
    santriNama: 'Ananda',
    nis: '-',
    kelas: 'Santri Darul Ulum',
    kamar: 'Asrama Pesantren',
    saldoRfid: 'Rp 75.000',
    limitHarian: 'Rp 25.000',
    poinDisiplin: '95/100',
    statusAsrama: 'Di Lingkungan Pondok',
    izinTerakhir: 'Tertib'
  };

  const textLower = String(incomingText || '').toLowerCase();
  const naturalGreeting = getNaturalGreeting(incomingText, waliData.namaWali);
  const rtc = getRealtimePondokClockBackend();

  // ─── INTENT PRIORITAS TERTINGGI: CLOSINGAN / WALI INGIN BICARA DENGAN ADMIN ───
  const isAdminRequest =
    textLower.includes('bicara sama admin') ||
    textLower.includes('bicara dengan admin') ||
    textLower.includes('ngomong sama admin') ||
    textLower.includes('ngomong dengan admin') ||
    textLower.includes('hubungkan ke admin') ||
    textLower.includes('hubungi admin') ||
    textLower.includes('panggil admin') ||
    textLower.includes('minta nomor admin') ||
    textLower.includes('kontak admin') ||
    textLower.includes('bicara ustadz') ||
    textLower.includes('bicara dengan ustadz') ||
    textLower.includes('ngomong sama ustadz') ||
    textLower.includes('pengasuh pondok') ||
    textLower.includes('apakah ini dengan admin') ||
    textLower.includes('apakah ini admin') ||
    textLower.includes('apakah dengan admin') ||
    textLower.includes('ini admin kah') ||
    textLower.includes('apakah admin') ||
    textLower.includes('mau admin') ||
    textLower.includes('bisa bicara langsung') ||
    textLower.includes('bicara langsung');

  if (isAdminRequest) {
    console.log(`🔔 [Smart Handoff Triggered]: Wali ${cleanPhone} meminta bicara dengan Admin! Mengalihkan ke Mode Manual.`);

    await setManualTakeover(cleanPhone, true);

    try {
      await broadcastToSupabaseRealtime('whatsapp.takeover', {
        phone: cleanPhone,
        isManual: true,
        reason: 'WALI_REQUESTED_ADMIN',
        senderName: waliData.namaWali,
        admin: 'Ust. Drs. H. Mustofa',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Takeover broadcast warning:', e.message);
    }

    const handoffReply = `${naturalGreeting}percakapan ini sekarang kami alihkan langsung ke *Admin Ri'ayah / Ustadz Musyrif Asrama* ya.\n\nUstadz akan segera membaca dan membalas pesan Bapak/Ibu secara langsung di sini. Mohon ditunggu sebentar ya Bapak/Ibu. 🙏`;
    await recordChatMessage(cleanPhone, 'user', incomingText, waliData.namaWali);
    await recordChatMessage(cleanPhone, 'assistant', handoffReply, 'Smart Ri\'ayah AI');
    await saveAiDocument('ai_chat_logs', {
      channel: String(senderPhone).startsWith('TG-') ? 'Telegram' : 'WhatsApp',
      senderPhone: cleanPhone,
      senderName: waliData.namaWali,
      santriNama: waliData.santriNama,
      engine: 'SMART_HANDOFF_TRIGGER',
      intent: 'ADMIN_HANDOFF',
      prompt: incomingText,
      reply: handoffReply
    }).catch(() => {});
    return handoffReply;
  }

  // Rekam pesan masuk pengguna ke riwayat
  await recordChatMessage(cleanPhone, 'user', incomingText, waliData.namaWali);

  // Ambil riwayat chat sebelumnya agar percakapan nyambung
  const recentHistory = await getRecentChatHistory(cleanPhone);

  // 1. Coba gunakan DeepSeek AI jika token tersedia
  const deepseekKey = (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '').trim();
  if (deepseekKey) {
    try {
      const systemPrompt = `Anda adalah pengasuh/ustadz ramah dan cerdas di Pesantren Modern Darul Ulum yang membalas pesan WhatsApp wali santri.

WAKTU SISTEM PONDOK REAL-TIME SAAT INI:
- Hari & Tanggal: ${rtc.namaHari}, ${rtc.tglLengkap} (Format YMD: ${rtc.ymd})
- Jam: ${rtc.jamMenit} WITA
- Referensi Kalender 7 Hari Ke Depan:
${rtc.refDays.map(r => `  * [${r.label}] -> ${r.hari}, ${r.tanggal} (${r.rule})`).join('\n')}

DATA SANTRI DI SISTEM:
- Wali: ${waliData.namaWali} (No. WA: ${cleanPhone})
- Santri Terdaftar: ${waliData.santriNama} (${waliData.kelas}, ${waliData.kamar})
- Status Asrama: ${waliData.statusAsrama}, Saldo RFID: ${waliData.saldoRfid}

PANDUAN KOMUNIKASI & ALUR BOOKING KUNJUNGAN:
1. BAHASA HARUS NATURAL, SANTUN, DAN NYAMBUNG:
   - Jawab secara luwes, bersahabat, dan langsung ke inti pertanyaan orang tua.
   - JANGAN PERNAH membuat daftar menu nomor (1, 2, 3...) atau format kaku robotik.
   - JANGAN menyemburkan template panjang atau brosur peraturan. Percakapan harus santai dan mengalir.

2. MENJAWAB SALAM SEPERLUNYA:
   - Jawab salam ("Wa'alaikumsalam...") HANYA JIKA orang tua memang mengucap salam.
   - Jika orang tua TIDAK mengucap salam (misal hanya bilang "mau jenguk anak", "bisa nengok gak", atau "halo"), JANGAN menjawab dengan salam panjang "Wa'alaikumsalam Warahmatullahi Wabarakatuh". Gunakan sapaan wajar ("Halo Bapak/Ibu", "Iya Bapak/Ibu", dll).

3. ALUR PENGUMPULAN DATA BOOKING KUNJUNGAN SECARA BERTAHAP:
   - Jika orang tua bilang ingin menjenguk/nengok anak:
     a) Jika belum jelas nama santrinya: tanyakan secara santai atas nama santri siapa dan kelas berapa, serta rencana berkunjung hari apa dan jam berapa. (Jika di data sistem sudah terdaftar ananda ${waliData.santriNama}, Anda boleh langsung mengonfirmasi dengan ramah: "Bisa Bapak/Ibu. Mau menjenguk ananda ${waliData.santriNama} ya? Rencana berkunjung hari apa dan jam berapa?").
     b) Jika nama santri sudah ada tapi belum menyebutkan hari/jam: tanyakan rencana berkunjung hari apa dan jam berapa, serta apakah ada titipan barang/makanan yang mau dibawa.
     c) Jika data kunjungan SUDAH LENGKAP (ada nama santri, hari/tanggal, dan perkiraan jam):
        - Cek hari kunjungannya:
          * JIKA SENIN, SELASA, RABU, atau KAMIS (HARI KERJA / WEEKDAY):
            Kunjungan hari kerja membutuhkan persetujuan Admin Ri'ayah.
            Beri tahu bahwa permohonan kunjungan di hari kerja sudah dicatat dan sedang diteruskan ke Admin Ri'ayah untuk persetujuan. Barcode kunjungan resmi akan dikirim otomatis ke WhatsApp ini segera setelah disetujui. Ingatkan titipan barang maksimal 5 Kg.
          * JIKA JUMAT, SABTU, atau MINGGU (AKHIR PEKAN / WEEKEND):
            Kunjungan akhir pekan LANGSUNG DISETUJUI OTOMATIS (Auto-Approved)!
            Beri tahu bahwa kunjungan sudah langsung disetujui otomatis. Berikan kode Barcode Gate Pass (contoh format: GP-DU-[NAMA]-[4 ANGKA]). Beritahu untuk menunjukkan pesan/barcode ke satpam di pos gerbang dan titipan maks 5 Kg.
        - PENTING: Saat data booking kunjungan berhasil difinalkan, sertakan DI BARIS TERAKHIR tag JSON penanda booking berikut:
          <!--BOOKING_DATA:{"nama_santri":"...","kelas":"...","hari_kunjungan":"...","tanggal_kunjungan":"YYYY-MM-DD","jam_kunjungan":"HH:mm","jam_selesai":"HH:mm","titipan_barang":"...","berat_barang_kg":...,"nama_penjenguk":"...","is_weekday":true/false,"barcode_token":"..."}-->

4. PERTANYAAN LAIN (KABAR, SALDO, KESEHATAN, IZIN):
   - Jawab secara wajar dan to the point sesuai data santri yang ada.`;

      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.slice(-4),
        { role: 'user', content: incomingText }
      ];

      const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messagesPayload,
          temperature: 0.3,
          max_tokens: 350
        })
      });

      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        let reply = dsJson.choices?.[0]?.message?.content?.trim();

        if (reply) {
          // Deteksi apakah DeepSeek menyertakan tag data booking
          const bookingMatch = reply.match(/<!--BOOKING_DATA:(.*?)-->/s);
          if (bookingMatch && bookingMatch[1]) {
            try {
              const bData = JSON.parse(bookingMatch[1]);
              const cleanSantri = (bData.nama_santri || waliData.santriNama || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
              const isWkday = Boolean(bData.is_weekday);
              const barcode = bData.barcode_token || (isWkday ? null : `GP-DU-${cleanSantri}-${Math.floor(1000 + Math.random() * 9000)}`);

              const bookingRecord = {
                id: `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
                booking_source: 'WHATSAPP_AI_NATURAL',
                nama_santri: bData.nama_santri || waliData.santriNama,
                kelas: bData.kelas || waliData.kelas,
                asal: 'Surabaya',
                tanggal_kunjungan: bData.tanggal_kunjungan || rtc.ymd,
                hari_kunjungan: bData.hari_kunjungan || rtc.namaHari,
                jam_kunjungan: bData.jam_kunjungan || '14:00',
                jam_selesai: bData.jam_selesai || '15:30',
                titipan_barang: bData.titipan_barang || '-',
                berat_barang_kg: Number(bData.berat_barang_kg) || 0,
                nama_penjenguk: bData.nama_penjenguk || waliData.namaWali,
                status_penjenguk: 'Wali Santri',
                no_wa_penjenguk: cleanPhone,
                barcode_token: barcode,
                approval_type: isWkday ? 'MANUAL_WEEKDAY' : 'AUTO_WEEKEND',
                status_kunjungan: isWkday ? 'Menunggu Approval' : 'Disetujui (Auto-Approved Weekend)',
                is_weekday: isWkday,
                waktu_chat_masuk: `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
                waktu_disetujui: isWkday ? null : `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
                created_at: new Date().toISOString()
              };

              // Simpan ke sistem booking & broadcast ke dashboard
              await saveBookingToSystem(bookingRecord);
            } catch (pErr) {
              console.warn('Booking JSON parse error:', pErr.message);
            }

            // Bersihkan tag booking agar WhatsApp hanya menerima pesan percakapan yang bersih
            reply = reply.replace(/<!--BOOKING_DATA:(.*?)-->/s, '').trim();
          }

          // Rekam balasan asisten ke database chat & MongoDB AI Logs
          await recordChatMessage(cleanPhone, 'assistant', reply, 'Smart Ri\'ayah AI');
          await saveAiDocument('ai_chat_logs', {
            channel: String(senderPhone).startsWith('TG-') ? 'Telegram' : 'WhatsApp',
            senderPhone: cleanPhone,
            senderName: waliData.namaWali,
            santriNama: waliData.santriNama,
            engine: 'DEEPSEEK_AI',
            model: 'deepseek-chat',
            tokensUsed: dsJson.usage || null,
            prompt: incomingText,
            reply
          }).catch(() => {});
          return reply;
        }
      }
    } catch (llmErr) {
      console.warn('⚠️ [AI Otonom] DeepSeek AI offline/fallback ke Smart Local Reasoning:', llmErr.message);
    }
  }

  // ─── 2. SMART LOCAL REASONING ENGINE (FALLBACK NATURAL BERBASIS KONTEKS) ───
  const saveLocalAiReply = async (replyText, intentName) => {
    await recordChatMessage(cleanPhone, 'assistant', replyText, 'Smart Ri\'ayah AI');
    await saveAiDocument('ai_chat_logs', {
      channel: String(senderPhone).startsWith('TG-') ? 'Telegram' : 'WhatsApp',
      senderPhone: cleanPhone,
      senderName: waliData.namaWali,
      santriNama: waliData.santriNama,
      engine: 'SMART_LOCAL_REASONING',
      intent: intentName,
      prompt: incomingText,
      reply: replyText
    }).catch(() => {});
    return replyText;
  };

  // A. INTENT KUNJUNGAN / SAMBANGAN / JENGUK
  const isVisiting =
    textLower.includes('jenguk') ||
    textLower.includes('kunjung') ||
    textLower.includes('sambang') ||
    textLower.includes('besuk') ||
    textLower.includes('tengok') ||
    textLower.includes('ketemu');

  if (isVisiting) {
    const hasDayMention =
      textLower.includes('senin') ||
      textLower.includes('selasa') ||
      textLower.includes('rabu') ||
      textLower.includes('kamis') ||
      textLower.includes('jumat') ||
      textLower.includes('sabtu') ||
      textLower.includes('minggu') ||
      textLower.includes('besok') ||
      textLower.includes('lusa') ||
      textLower.includes('hari ini');

    const hasTimeMention =
      textLower.includes('jam') ||
      textLower.includes('pukul') ||
      textLower.includes('siang') ||
      textLower.includes('pagi') ||
      textLower.includes('sore') ||
      /\d{1,2}[:.]\d{2}/.test(textLower);

    // KASUS 1: Baru bilang mau jenguk (belum ada rincian waktu/anak)
    if (!hasDayMention && !hasTimeMention) {
      if (waliData.santriNama && waliData.santriNama !== 'Ananda') {
        const reply = `${naturalGreeting}bisa Bapak/Ibu. Mau menjenguk ananda *${waliData.santriNama}* ya? Rencananya mau datang hari apa dan perkiraan jam berapa?`;
        return await saveLocalAiReply(reply, 'VISIT_ASK_SCHEDULE');
      }
      const reply = `${naturalGreeting}bisa Bapak/Ibu. Mau menjenguk ananda atas nama siapa dan kelas berapa ya? Rencananya mau berkunjung hari apa dan jam berapa?`;
      return await saveLocalAiReply(reply, 'VISIT_ASK_IDENTITY');
    }

    // KASUS 2: Sudah sebut hari/waktu kunjungan -> Kumpulkan data dan masukkan ke sistem booking!
    let targetDayName = 'Minggu';
    let targetYmd = rtc.ymd;
    let isWeekdayBooking = false;

    if (textLower.includes('senin')) { targetDayName = 'Senin'; isWeekdayBooking = true; }
    else if (textLower.includes('selasa')) { targetDayName = 'Selasa'; isWeekdayBooking = true; }
    else if (textLower.includes('rabu')) { targetDayName = 'Rabu'; isWeekdayBooking = true; }
    else if (textLower.includes('kamis')) { targetDayName = 'Kamis'; isWeekdayBooking = true; }
    else if (textLower.includes('jumat')) { targetDayName = 'Jumat'; isWeekdayBooking = false; }
    else if (textLower.includes('sabtu')) { targetDayName = 'Sabtu'; isWeekdayBooking = false; }
    else if (textLower.includes('minggu')) { targetDayName = 'Minggu'; isWeekdayBooking = false; }
    else if (textLower.includes('besok')) {
      const matchBesok = rtc.refDays.find(r => r.offset === 1);
      if (matchBesok) {
        targetDayName = matchBesok.hari;
        targetYmd = matchBesok.tanggal;
        isWeekdayBooking = matchBesok.is_weekday;
      }
    } else {
      targetDayName = rtc.namaHari;
      targetYmd = rtc.ymd;
      isWeekdayBooking = rtc.isWeekday;
    }

    const matchedRef = rtc.refDays.find(r => r.hari.toLowerCase() === targetDayName.toLowerCase());
    if (matchedRef) {
      targetYmd = matchedRef.tanggal;
    }

    const targetSantriName = waliData.santriNama !== 'Ananda' ? waliData.santriNama : 'Santri';
    const cleanSantriName = targetSantriName.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
    const barcode = isWeekdayBooking ? null : `GP-DU-${cleanSantriName}-${Math.floor(1000 + Math.random() * 9000)}`;

    const bookingRecord = {
      id: `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      booking_source: 'WHATSAPP_LOCAL_NATURAL',
      nama_santri: targetSantriName,
      kelas: waliData.kelas,
      asal: 'Surabaya',
      tanggal_kunjungan: targetYmd,
      hari_kunjungan: targetDayName,
      jam_kunjungan: '14:00',
      jam_selesai: '15:30',
      titipan_barang: textLower.includes('makan') ? 'Makanan / Snack' : (textLower.includes('baju') ? 'Pakaian & Perlengkapan' : '-'),
      berat_barang_kg: 2,
      nama_penjenguk: waliData.namaWali,
      status_penjenguk: 'Wali Santri',
      no_wa_penjenguk: cleanPhone,
      barcode_token: barcode,
      approval_type: isWeekdayBooking ? 'MANUAL_WEEKDAY' : 'AUTO_WEEKEND',
      status_kunjungan: isWeekdayBooking ? 'Menunggu Approval' : 'Disetujui (Auto-Approved Weekend)',
      is_weekday: isWeekdayBooking,
      waktu_chat_masuk: `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
      waktu_disetujui: isWeekdayBooking ? null : `${rtc.namaHari}, ${rtc.tglLengkap} • ${rtc.jamMenitDetik} WITA`,
      created_at: new Date().toISOString()
    };

    // Masukkan data booking ke sistem
    await saveBookingToSystem(bookingRecord);

    let reply = '';
    if (isWeekdayBooking) {
      reply = `${naturalGreeting}jadwal kunjungan untuk ananda *${targetSantriName}* pada hari *${targetDayName}* sudah kami catat di sistem ya.\n\nKarena kunjungannya di hari kerja (${targetDayName}), permohonan ini kami teruskan dulu ke Admin Ri'ayah untuk persetujuan. Barcode kunjungannya akan langsung dikirimkan ke WhatsApp ini begitu disetujui ya Bapak/Ibu.\n\nSebagai catatan, barang atau makanan titipan maksimal 5 Kg ya.`;
    } else {
      reply = `${naturalGreeting}kunjungan untuk ananda *${targetSantriName}* pada hari *${targetDayName}* sudah *langsung disetujui otomatis* di sistem pondok.\n\n🎫 *Barcode Gate Pass Anda:* *${barcode}*\n\nNanti pas tiba di gerbang, tinggal perlihatkan pesan barcode ini ke petugas satpam di pos jaga ya. Titipan barang maksimal 5 Kg. Semoga perjalanannya lancar ya Bapak/Ibu.`;
    }

    return await saveLocalAiReply(reply, isWeekdayBooking ? 'VISIT_BOOKING_WEEKDAY' : 'VISIT_BOOKING_WEEKEND');
  }

  // B. TOPIK SALDO RFID / DOMPET PINTAR
  if (textLower.includes('saldo') || textLower.includes('uang') || textLower.includes('dompet') || textLower.includes('jajan') || textLower.includes('rfid') || textLower.includes('topup') || textLower.includes('top up')) {
    const reply = `${naturalGreeting}alhamdulillah sisa saldo kartu RFID ananda *${waliData.santriNama}* saat ini *${waliData.saldoRfid}* dengan limit jajan ${waliData.limitHarian} per hari.\n\nAda yang perlu kami bantu untuk pengisian saldo atau kebutuhan ananda?`;
    return await saveLocalAiReply(reply, 'QUERY_SALDO_RFID');
  }

  // C. TOPIK KABAR / KONDISI SANTRI
  if (textLower.includes('kabar') || textLower.includes('sehat') || textLower.includes('kondisi') || textLower.includes('kegiatan') || textLower.includes('sholat') || textLower.includes('shalat') || textLower.includes('anak saya')) {
    const reply = `${naturalGreeting}alhamdulillah ananda *${waliData.santriNama}* saat ini dalam kondisi sehat wal'afiat di asrama (${waliData.kamar}). Aktivitas mengaji, sholat berjamaah, dan sekolah berjalan dengan baik.\n\nAda pesan khusus yang ingin disampaikan untuk ananda?`;
    return await saveLocalAiReply(reply, 'QUERY_KABAR_SANTRI');
  }

  // D. TOPIK KESEHATAN / SAKIT / UKS / POSKESTREN
  if (textLower.includes('sakit') || textLower.includes('demam') || textLower.includes('obat') || textLower.includes('uks') || textLower.includes('poskestren') || textLower.includes('klinik') || textLower.includes('dokter')) {
    const reply = `${naturalGreeting}alhamdulillah ananda *${waliData.santriNama}* terpantau sehat di pondok. Petugas kesehatan Poskestren juga siaga 24 jam mendampingi santri. Apakah ananda sempat mengeluhkan sesuatu saat menelepon?`;
    return await saveLocalAiReply(reply, 'QUERY_KESEHATAN');
  }

  // E. TOPIK PERIZINAN & PULANG
  if (textLower.includes('izin') || textLower.includes('pulang') || textLower.includes('libur') || textLower.includes('perpanjang') || textLower.includes('pesiar') || textLower.includes('keluar')) {
    const reply = `${naturalGreeting}untuk perizinan ananda *${waliData.santriNama}*, permohonan dapat diajukan via aplikasi Smart Ri'ayah minimal H-1 ya. Status izin ananda saat ini: *${waliData.izinTerakhir}*. Ada izin apa yang ingin diajukan untuk ananda?`;
    return await saveLocalAiReply(reply, 'QUERY_PERIZINAN');
  }

  // F. SAPAAN UMUM / DEFAULT
  const reply = `${naturalGreeting}ada yang bisa kami bantu terkait ananda *${waliData.santriNama}* di Pesantren Modern Darul Ulum? Silakan disampaikan ya Bapak/Ibu. 🙏`;
  return await saveLocalAiReply(reply, 'GENERAL_GREETING');
}

/**
 * Mengirim pesan balasan otomatis via Fonnte REST API (/send)
 */
export async function sendFonnteAutoReply(targetPhone, replyText, customToken = null) {
  const token = customToken || process.env.FONNTE_TOKEN || DEFAULT_FONNTE_TOKEN;
  const cleanTarget = normalizePhone(targetPhone);

  try {
    const formData = new FormData();
    formData.append('target', cleanTarget);
    formData.append('message', replyText);
    formData.append('countryCode', '62');
    formData.append('preview', 'false');

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    const isSuccess = response.ok && (data.status === true || data.status === 'true' || Boolean(data.id));

    console.log(`🤖 [AI Otonom Dispatched to ${cleanTarget}]:`, isSuccess ? 'SUCCESS' : 'FAILED', data);
    return { success: isSuccess, data };
  } catch (err) {
    console.error('❌ [AI Otonom Dispatch Error]:', err.message);
    return { success: false, error: err.message };
  }
}
