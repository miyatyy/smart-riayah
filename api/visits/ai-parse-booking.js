/**
 * Vercel Serverless Function: /api/visits/ai-parse-booking
 * Natural Language Booking Parser & Gate Pass Router via DeepSeek AI Engine & Fonnte WhatsApp Gateway
 * 
 * Aturan Hari:
 * - Senin - Kamis (is_weekday = true)  : 'Menunggu Approval' (MANUAL_WEEKDAY) -> Notifikasi WA tunggu persetujuan
 * - Jumat - Minggu (is_weekday = false) : 'Disetujui (Auto-Approved Weekend)' -> Barcode diterbitkan seketika + WA
 */

import { saveAiDocument } from '../../server/mongo.js';
import {
  normalizePhone,
  resolveWaliIdentity,
  isPriorityNurmiyatyPhone,
} from '../../server/whatsapp-gateway/aiAutonomousResponder.js';

const DEFAULT_DEEPSEEK_KEY = (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || '').trim();
const DEFAULT_FONNTE_TOKEN = (process.env.FONNTE_TOKEN || process.env.VITE_FONNTE_TOKEN || '').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      engine: 'DeepSeek Chat (deepseek-chat)',
      endpoint: '/api/visits/ai-parse-booking',
      description: 'AI Natural Language Booking Parser & Smart Gate Pass Router'
    });
  }

  try {
    const payload = req.body || {};
    const messageText = payload.message || payload.text || '';
    const rawSender = payload.sender || payload.phone || payload.target || '';
    const cleanSender = normalizePhone(rawSender);
    const rawSenderName = payload.name || payload.sender_name || '';
    const apiKey = payload.deepseek_api_key || DEFAULT_DEEPSEEK_KEY;
    const fonnteToken = payload.fonnte_token || DEFAULT_FONNTE_TOKEN;

    if (!messageText.trim()) {
      return res.status(400).json({ success: false, error: 'Pesan chat booking kunjungan wajib diisi' });
    }

    // Waktu real-time pondok saat ini & resolusi identitas wali dari database
    const rtc = getRealtimeClockAndCalendar();
    const resolvedIdentity = cleanSender
      ? await resolveWaliIdentity(cleanSender, rawSenderName)
      : null;
    const senderName = resolvedIdentity?.namaWali || (rawSenderName || 'Wali Santri');

    // 1. Panggil DeepSeek AI untuk Ekstraksi 9 Atribut JSON Wajib dengan Injeksi Waktu Real-Time
    let extracted = await callDeepSeekParser(messageText, cleanSender || rawSender, senderName, apiKey, rtc, resolvedIdentity);

    // Fallback regex jika DeepSeek gagal atau respons kosong
    let usedFallbackParser = false;
    if (!extracted || !extracted.nama_santri) {
      extracted = fallbackRegexParser(messageText, cleanSender || rawSender, senderName, rtc, resolvedIdentity);
      usedFallbackParser = true;
    }

    const prioritySender = isPriorityNurmiyatyPhone(cleanSender);
    if (prioritySender && resolvedIdentity) {
      extracted.nama_santri = resolvedIdentity.santriNama;
      extracted.kelas = resolvedIdentity.kelas;
      if (!extracted.nama_penjenguk || /fatimah|wali santri/i.test(extracted.nama_penjenguk)) {
        extracted.nama_penjenguk = resolvedIdentity.namaWali;
      }
    } else {
      if (/ahmad\s+fauzi/i.test(String(extracted.nama_santri || '')) && resolvedIdentity?.santriNama && resolvedIdentity.santriNama !== 'Ananda') {
        extracted.nama_santri = resolvedIdentity.santriNama;
        extracted.kelas = resolvedIdentity.kelas;
      }
      if (/fatimah/i.test(String(extracted.nama_penjenguk || ''))) {
        extracted.nama_penjenguk = senderName;
      }
    }

    // 2. Normalisasi & Validasi Hari Kunjungan (Senin - Minggu)
    const hariKunjunganNormalized = normalizeDayName(extracted.hari_kunjungan, extracted.tanggal_kunjungan, rtc);
    const isWeekday = ['Senin', 'Selasa', 'Rabu', 'Kamis'].includes(hariKunjunganNormalized);
    const cleanSantriName = (extracted.nama_santri || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
    const bookingId = `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    let approvalType = 'MANUAL_WEEKDAY';
    let statusKunjungan = 'Menunggu Approval';
    let barcodeToken = null;
    let replyWaText = '';

    const waktuSekarangStr = `${rtc.namaHari}, ${rtc.tanggalLengkap} • ${rtc.jamMenitDetik} WITA`;

    const hasSalam = /assalamu|aslam|mikum/i.test(messageText);
    const greeting = hasSalam ? `Wa'alaikumsalam Bapak/Ibu *${extracted.nama_penjenguk}*.\n\n` : `Baik Bapak/Ibu *${extracted.nama_penjenguk}*,\n\n`;

    // Validasi Jam Operasional Kunjungan
    let hoursWarning = '';
    const [h, m] = (extracted.jam_kunjungan || '14:00').split(':').map(v => parseInt(v, 10) || 0);
    const timeMinutes = h * 60 + m;

    if (isWeekday) {
      // Weekday (Senin-Kamis): Sesi Sore 14.00 - 16.30 WITA (840 - 990 min)
      if (timeMinutes < 840 || timeMinutes > 990) {
        hoursWarning = `\n\n⚠️ *Catatan Jadwal:* Jam kunjungan yang diajukan (${extracted.jam_kunjungan}) di luar jam sambang hari kerja (14.00–16.30 WITA ba'da KBM). Permohonan diteruskan ke Admin untuk pertimbangan izin khusus.`;
      }

      approvalType = 'MANUAL_WEEKDAY';
      statusKunjungan = 'Menunggu Approval';
      barcodeToken = null;

      replyWaText = `⏳ *[PERMOHONAN KUNJUNGAN TERCATAT - HARI KERJA]*\n` +
        greeting +
        `Permohonan kunjungan Anda pada hari kerja (*${hariKunjunganNormalized}, ${extracted.tanggal_kunjungan}*) telah dicatat oleh sistem Smart Riayah dan sedang *MENUNGGU PERSETUJUAN* Admin Ri'ayah.\n\n` +
        `• Santri: *${extracted.nama_santri}* (${extracted.kelas})\n` +
        `• Jadwal: *${extracted.jam_kunjungan} - ${extracted.jam_selesai} WITA*\n` +
        `• Titipan: *${extracted.titipan_barang || '-'}* (${extracted.berat_barang_kg || 0} Kg)\n\n` +
        `⚖️ *Tata Tertib:* Batas titipan maksimal *5 Kg* (wajib ditimbang di Pos Satpam). E-Barcode resmi akan dikirimkan otomatis ke WhatsApp ini segera setelah disetujui Admin Ri'ayah.` + hoursWarning;
    } else {
      // Weekend (Jumat-Minggu): Sesi 1 (08.30 - 11.30 WITA) & Sesi 2 (13.30 - 16.30 WITA)
      const inSesi1 = timeMinutes >= 510 && timeMinutes <= 690;
      const inSesi2 = timeMinutes >= 810 && timeMinutes <= 990;
      if (!inSesi1 && !inSesi2) {
        hoursWarning = `\n\n⚠️ *Catatan Jadwal:* Jam kunjungan (${extracted.jam_kunjungan}) di luar sesi resmi akhir pekan (Sesi 1: 08.30–11.30 WITA & Sesi 2: 13.30–16.30 WITA). Mohon sesuaikan ketibaan di gerbang.`;
      }

      approvalType = 'AUTO_WEEKEND';
      statusKunjungan = 'Disetujui (Auto-Approved Weekend)';
      barcodeToken = `GP-DU-${cleanSantriName}-${Math.floor(1000 + Math.random() * 9000)}`;
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(barcodeToken)}&format=png`;

      replyWaText = `✅ *[BOOKING KUNJUNGAN DISETUJUI OTOMATIS - WEEKEND]*\n` +
        greeting +
        `Permohonan sambangan santri *${extracted.nama_santri}* (${extracted.kelas}) pada hari *${hariKunjunganNormalized}, ${extracted.tanggal_kunjungan}* pukul *${extracted.jam_kunjungan} - ${extracted.jam_selesai} WITA* telah *DISETUJUI OTOMATIS*.\n\n` +
        `📦 *Titipan Barang:* ${extracted.titipan_barang || '-'} (${extracted.berat_barang_kg || 0} Kg - Batas Max 5 Kg)\n` +
        `🎫 *Kode Gate Pass:* *${barcodeToken}*\n\n` +
        `📷 *Gambar Barcode Gate Pass (Bisa Di-scan):*\n${qrImageUrl}\n\n` +
        `⚖️ *Tata Tertib:* Wajib menunjukkan gambar Barcode ini atau *Tap Kartu RFID* di Pos Jaga Satpam saat tiba di Gerbang Utama. Durasi maksimal kunjungan 90 menit.` + hoursWarning;
    }

    const bookingRecord = {
      id: bookingId,
      booking_source: 'WHATSAPP_AI_DEEPSEEK',
      nama_santri: extracted.nama_santri,
      kelas: extracted.kelas,
      asal: extracted.asal,
      tanggal_kunjungan: extracted.tanggal_kunjungan || rtc.ymd,
      hari_kunjungan: hariKunjunganNormalized,
      jam_kunjungan: extracted.jam_kunjungan || '14:00',
      jam_selesai: extracted.jam_selesai || '15:30',
      titipan_barang: extracted.titipan_barang || '-',
      berat_barang_kg: extracted.berat_barang_kg || 0,
      nama_penjenguk: extracted.nama_penjenguk,
      status_penjenguk: extracted.status_penjenguk || 'Wali Santri',
      no_wa_penjenguk: cleanSender || normalizePhone(extracted.no_wa_penjenguk || '') || '',
      rfid_uid: resolvedIdentity?.rfidUid || null,
      barcode_token: barcodeToken,
      approval_type: approvalType,
      status_kunjungan: statusKunjungan,
      is_weekday: isWeekday,
      waktu_chat_masuk: waktuSekarangStr,
      waktu_disetujui: isWeekday ? null : waktuSekarangStr,
      jam_masuk_aktual: null,
      jam_keluar_aktual: null,
      created_at: new Date().toISOString()
    };

    // 3. Kirim WhatsApp Auto-Reply via Fonnte jika nomor tujuan tersedia
    let waSendResult = null;
    const targetWa = normalizePhone(bookingRecord.no_wa_penjenguk || '');
    if (targetWa && fonnteToken) {
      try {
        const qrUrlForFonnte = barcodeToken ? `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(barcodeToken)}&format=png` : null;
        const fonntePayload = {
          target: targetWa,
          message: replyWaText
        };
        if (qrUrlForFonnte && !isWeekday) {
          fonntePayload.url = qrUrlForFonnte;
        }

        const fonnteRes = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            'Authorization': fonnteToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fonntePayload)
        });
        waSendResult = await fonnteRes.json().catch(() => ({}));
      } catch (waErr) {
        console.warn('Fonnte send error:', waErr.message);
      }
    }

    // 4. Simpan log hasil AI Visit Parser ke MongoDB
    await saveAiDocument('ai_whatsapp_bookings', {
      id: `AI-BOOK-${bookingRecord.id}`,
      bookingId: bookingRecord.id,
      santriNama: bookingRecord.nama_santri,
      rfid_uid: bookingRecord.rfid_uid,
      sender: targetWa || cleanSender || rawSender || '',
      senderName,
      prompt: messageText,
      replyMessage: replyWaText,
      ai_engine: usedFallbackParser ? 'REGEX_FALLBACK' : 'DeepSeek Chat (deepseek-chat)',
      is_weekday: isWeekday,
      barcode_token: barcodeToken,
      status_kunjungan: statusKunjungan,
      booking: bookingRecord,
      created_at: new Date().toISOString()
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      ai_engine: usedFallbackParser ? 'Regex Fallback Engine' : 'DeepSeek Chat (deepseek-chat)',
      is_weekday: isWeekday,
      booking: bookingRecord,
      replyMessage: replyWaText,
      waSendResult: waSendResult
    });

  } catch (err) {
    console.error('Error in /api/visits/ai-parse-booking:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Helper Deteksi Waktu Real-Time & Kalender 7 Hari untuk Injeksi System Prompt DeepSeek
 */
function getRealtimeClockAndCalendar() {
  const now = new Date();
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayIndex = now.getDay();
  const namaHari = dayNames[dayIndex];
  const tanggalLengkap = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const ymd = now.toISOString().slice(0, 10);
  const jamMenitDetik = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace('.', ':');
  const isWeekday = dayIndex >= 1 && dayIndex <= 4;

  const next7Days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dIndex = d.getDay();
    const dName = dayNames[dIndex];
    const dYmd = d.toISOString().slice(0, 10);
    const dWeekday = dIndex >= 1 && dIndex <= 4;
    next7Days.push(`  - [${i === 0 ? 'Hari ini / Sekarang' : (i === 1 ? 'Besok' : (i === 2 ? 'Lusa' : `${dName} depan`))}] -> Hari: ${dName}, Tanggal: ${dYmd} (${dWeekday ? 'SENIN–KAMIS (Butuh Approval Admin)' : 'WEEKEND (Auto-Approved Barcode)'})`);
  }

  return {
    namaHari,
    tanggalLengkap,
    ymd,
    jamMenitDetik,
    isWeekday,
    calendarText: next7Days.join('\n')
  };
}

/**
 * Panggil DeepSeek API dengan structured JSON output & injeksi waktu real-time
 */
async function callDeepSeekParser(message, sender, senderName, apiKey, rtc = getRealtimeClockAndCalendar(), waliIdentity = null) {
  try {
    const waliContextSection = waliIdentity
      ? `\nDATA TERDAFTAR DI PONDOK UNTUK NOMOR INI:\n- Nama Wali: ${waliIdentity.namaWali}\n- Nama Santri: ${waliIdentity.santriNama}\n- Kelas: ${waliIdentity.kelas}\n- UID RFID: ${waliIdentity.rfidUid || '-'}\nGunakan data di atas jika pesan wali tidak menyebut eksplisit, dan JANGAN PERNAH memakai nama placeholder "Ibu Fatimah" atau "Ahmad Fauzi".\n`
      : `\nATURAN: JANGAN PERNAH mengarang atau memakai nama placeholder "Ibu Fatimah" atau "Ahmad Fauzi" jika tidak tertulis di pesan wali.\n`;

    const systemPrompt = `Anda adalah AI Asisten Cerdas Pondok Pesantren Modern Darul Ulum untuk memproses pendaftaran booking kunjungan/sambangan wali santri dari chat WhatsApp.

WAKTU SISTEM PONDOK REAL-TIME SAAT INI:
- Hari & Tanggal Sekarang: ${rtc.namaHari}, ${rtc.tanggalLengkap} (Format YMD: ${rtc.ymd})
- Jam Sistem Presisi: ${rtc.jamMenitDetik} WITA/WIB
- Status Hari Ini: ${rtc.isWeekday ? 'HARI KERJA (SENIN–KAMIS) • Wajib Approval Admin' : 'AKHIR PEKAN (JUMAT–MINGGU) • Auto-Approved'}
${waliContextSection}
REFERENSI KALENDER 7 HARI KE DEPAN DARI WAKTU SEKARANG:
${rtc.calendarText}

PANDUAN RESOLUSI WAKTU & TANGGAL OLEH AI:
1. Jika wali menulis kata relatif seperti "sekarang", "hari ini", "siang ini", "sore ini", "malam ini", otomatis tetapkan:
   - "hari_kunjungan": "${rtc.namaHari}"
   - "tanggal_kunjungan": "${rtc.ymd}"
2. Jika wali menulis "besok", "lusa", atau menyebutkan nama hari (misal "hari Sabtu", "Minggu", "Selasa depan"), WAJIB mencocokkan tanggal YYYY-MM-DD secara presisi dari referensi kalender 7 hari di atas.
3. Jika wali tidak menyebutkan "jam_selesai", otomatis hitung jam_selesai = jam_kunjungan + 90 menit (contoh: jika mulai 14:00, jam_selesai menjadi "15:30").
4. Aturan Hari (is_weekday):
   - true jika tanggal_kunjungan jatuh pada hari Senin, Selasa, Rabu, atau Kamis (butuh approval admin).
   - false jika tanggal_kunjungan jatuh pada hari Jumat, Sabtu, atau Minggu (auto-approved).

Ekstrak seluruh informasi ke dalam format JSON yang valid dengan atribut wajib:
1. "nama_santri": string nama santri yang dijenguk.
2. "kelas": string kelas / kamar santri (misal: "10-A (Umar 204)").
3. "asal": string kota / daerah asal santri / wali (misal: "Surabaya", "Gresik", "Sidoarjo").
4. "hari_kunjungan": string hari kunjungan ("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu").
5. "tanggal_kunjungan": string format "YYYY-MM-DD".
6. "jam_kunjungan": string format "HH:mm" (waktu mulai berkunjung, default "14:00").
7. "jam_selesai": string format "HH:mm" (waktu selesai berkunjung, misal "15:30").
8. "titipan_barang": string deskripsi barang bawaan/titipan (misal: "Pakaian ganti, madu, vitamin").
9. "berat_barang_kg": number berat barang dalam Kg (misal 2.0).
10. "nama_penjenguk": string nama wali atau penjenguk.
11. "status_penjenguk": string salah satu dari "Wali Santri", "Keluarga", "Kerabat", atau "Lainnya".
12. "is_weekday": boolean.

Wajib menghasilkan output HANYA berupa JSON object murni.`;

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Pesan Wali Santri: "${message}"\nPengirim WA: ${sender || '-'}\nNama Pengirim: ${senderName || '-'}` }
        ],
        temperature: 0.1
      })
    });

    if (!res.ok) {
      console.warn('DeepSeek HTTP status not OK:', res.status);
      return null;
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (err) {
    console.warn('DeepSeek API parse error:', err.message);
    return null;
  }
}

/**
 * Normalisasi Nama Hari
 */
function normalizeDayName(hariStr, tanggalStr) {
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  if (hariStr) {
    const clean = hariStr.trim().toLowerCase();
    if (clean === 'ahad') return 'Minggu';
    if (clean === "jum'at") return 'Jumat';
    for (const d of dayNames) {
      if (d.toLowerCase() === clean) return d;
    }
  }
  if (tanggalStr) {
    const d = new Date(tanggalStr);
    if (!isNaN(d.getTime())) {
      return dayNames[d.getDay()];
    }
  }
  return dayNames[new Date().getDay()];
}

/**
 * Regex Fallback Parser jika API eksternal offline
 */
function fallbackRegexParser(text, sender, senderName, rtc = getRealtimeClockAndCalendar(), waliIdentity = null) {
  const clean = text || '';
  const defaultDate = rtc?.ymd || new Date().toISOString().slice(0, 10);

  const matchField = (patterns, fallback = '') => {
    for (const pat of patterns) {
      const match = clean.match(pat);
      if (match && match[1]) return match[1].trim();
    }
    return fallback;
  };

  const defaultSantri =
    waliIdentity?.santriNama && waliIdentity.santriNama !== 'Ananda'
      ? waliIdentity.santriNama
      : 'Santri Terdaftar';
  const defaultKelas = waliIdentity?.kelas || 'Asrama Pondok';
  const defaultWali = waliIdentity?.namaWali || (senderName || 'Wali Santri');

  const rawMatchedSantri = matchField([
    /(?:nama\s*santri|santri|ananda)\s*[:=]\s*([^\n,]+)/i,
    /(?:menjenguk|sambang|jenguk)\s+(?:ananda\s+)?(?!(?:hari|tgl|tanggal|jam|pukul|besok|lusa|nanti|pagi|siang|sore|malam|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad|pada|ke|di)\b)([a-zA-Z]+(?:\s+(?!(?:hari|tgl|tanggal|jam|pukul|kelas|kamar|besok|lusa|senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad|bawa|dari|pada)\b)[a-zA-Z]+){0,2})/i
  ], '');

  const namaSantri = rawMatchedSantri || defaultSantri;

  const kelas = matchField([
    /(?:kelas|kamar|asrama)\s*[:=]\s*([^\n,]+)/i
  ], defaultKelas);

  const asal = matchField([
    /(?:asal|kota|daerah)\s*[:=]\s*([^\n,]+)/i
  ], 'Surabaya');

  const tanggal = matchField([
    /(?:tanggal|tgl|hari\/tgl)\s*[:=]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
    /(?:tanggal|tgl)\s*[:=]\s*([^\n,]+)/i
  ], defaultDate);

  const hariKunjungan = matchField([
    /(?:hari)\s*[:=]?\s*(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|ahad)/i,
    /(?:hari)\s*[:=]\s*([a-zA-Z]+)/i
  ], rtc?.namaHari || 'Senin');

  const jamMulai = matchField([
    /(?:jam|waktu|pukul)\s*[:=]?\s*([0-9]{1,2}[:.][0-9]{2})/i
  ], '14:00').replace('.', ':');

  const jamSelesai = matchField([
    /(?:s\/d|sampai|-)\s*([0-9]{1,2}[:.][0-9]{2})/i,
    /(?:jam\s*selesai|selesai)\s*[:=]?\s*([0-9]{1,2}[:.][0-9]{2})/i
  ], '15:30').replace('.', ':');

  const titipan = matchField([
    /(?:titipan|barang|titip|bawaan)\s*[:=]\s*([^\n]+)/i
  ], 'Pakaian ganti & Madu Herbal');

  const beratStr = matchField([
    /(?:berat|kg)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kg)?/i,
    /([0-9]+(?:[.,][0-9]+)?)\s*kg/i
  ], '2.0').replace(',', '.');
  const berat = parseFloat(beratStr) || 2.0;

  let penjenguk = matchField([
    /(?:nama\s*penjenguk|penjenguk|wali|orang\s*tua)\s*[:=]\s*([^\n,]+)/i
  ], defaultWali);

  if (/fatimah/i.test(penjenguk)) {
    penjenguk = defaultWali;
  }

  const statusPenjenguk = matchField([
    /(?:status\s*penjenguk|status|hubungan)\s*[:=]\s*([^\n,]+)/i
  ], 'Wali Santri');

  return {
    nama_santri: namaSantri,
    kelas: kelas,
    asal: asal,
    hari_kunjungan: hariKunjungan,
    tanggal_kunjungan: tanggal,
    jam_kunjungan: jamMulai,
    jam_selesai: jamSelesai,
    titipan_barang: titipan,
    berat_barang_kg: berat,
    nama_penjenguk: penjenguk,
    status_penjenguk: statusPenjenguk,
    no_wa_penjenguk: normalizePhone(sender)
  };
}

