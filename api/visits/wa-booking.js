/**
 * Vercel Serverless Function: /api/visits/wa-booking
 * Endpoint penerima dan parser pesan booking kunjungan via WhatsApp Gateway (Fonnte API)
 * Menerapkan aturan hari:
 * - Senin - Kamis: MANUAL_WEEKDAY (Menunggu Approval Admin Ri'ayah)
 * - Jumat - Minggu: AUTO_WEEKEND (Auto-Approved + Barcode Token Terbit Seketika)
 */

import {
  normalizePhone,
  resolveWaliIdentity,
  isPriorityNurmiyatyPhone,
  saveBookingToSystem,
} from '../../server/whatsapp-gateway/aiAutonomousResponder.js';
import { resolveWaliAddressing } from '../../src/utils/phoneUtils.js';

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
      service: 'Smart Riayah Visit Booking & QR Gate Pass Engine',
      rules: {
        weekday: 'Senin - Kamis (Requires Manual Admin Ri\'ayah Approval)',
        weekend: 'Jumat - Minggu (Auto-Approved Gate Pass with Barcode)'
      },
      timestamp: new Date().toISOString()
    });
  }

  try {
    const payload = req.body || {};
    const messageText = payload.message || payload.text || '';
    const rawSender = payload.sender || payload.phone || payload.target || '';
    const cleanSender = normalizePhone(rawSender);
    const rawSenderName = payload.name || payload.sender_name || '';

    const resolvedIdentity = cleanSender
      ? await resolveWaliIdentity(cleanSender, rawSenderName)
      : null;
    const senderName = resolvedIdentity?.namaWali || (rawSenderName || 'Wali Santri');

    // 1. Ekstraksi Data Booking dari Pesan
    const extracted = parseBookingMessage(messageText, cleanSender || rawSender, senderName, resolvedIdentity);

    // 2. Tentukan Hari Kunjungan & Validasi Weekday vs Weekend
    const targetDate = extracted.tanggal_kunjungan ? new Date(extracted.tanggal_kunjungan) : new Date();
    const dayIndex = isNaN(targetDate.getTime()) ? new Date().getDay() : targetDate.getDay();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariKunjungan = extracted.hari_kunjungan || dayNames[dayIndex];

    const isWeekend = ['Jumat', 'Sabtu', 'Minggu'].includes(hariKunjungan);
    const bookingId = `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const addr = resolveWaliAddressing(extracted.nama_penjenguk, messageText, [], resolvedIdentity);

    let approvalType = 'MANUAL_WEEKDAY';
    let statusKunjungan = 'Menunggu Approval';
    let barcodeToken = null;
    let replyText = '';

    if (isWeekend) {
      // JUMAT, SABTU, MINGGU (Weekend) -> AUTO-APPROVED
      approvalType = 'AUTO_WEEKEND';
      statusKunjungan = 'Disetujui (Siap Datang)';
      barcodeToken = `GP-DU-${extracted.nama_santri.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      replyText = `✅ *[BOOKING KUNJUNGAN DISETUJUI OTOMATIS - WEEKEND]*\n` +
        `Assalamu'alaikum *${addr.panggilan}*.\n\n` +
        `Permohonan sambangan santri *${extracted.nama_santri}* (${extracted.kelas}) pada hari *${hariKunjungan}, ${extracted.tanggal_kunjungan}* pukul *${extracted.jam_kunjungan} - ${extracted.jam_selesai} WIB* telah *DISETUJUI OTOMATIS*.\n\n` +
        `📦 *Titipan Barang:* ${extracted.titipan_barang || '-'} (${extracted.berat_barang_kg || 0} Kg)\n` +
        `🎫 *Barcode Gate Pass:* *${barcodeToken}*\n\n` +
        `Silakan tunjukkan barcode/pesan ini ke Satpam saat tiba di Gerbang Utama Pesantren Modern Darul Ulum.`;
    } else {
      // SENIN, SELASA, RABU, KAMIS (Weekday) -> MANUAL APPROVAL
      approvalType = 'MANUAL_WEEKDAY';
      statusKunjungan = 'Menunggu Approval';
      barcodeToken = null;

      replyText = `⏳ *[PERMOHONAN KUNJUNGAN TERCATAT - HARI KERJA]*\n` +
        `Assalamu'alaikum *${addr.panggilan}*.\n\n` +
        `Permohonan kunjungan santri *${extracted.nama_santri}* untuk hari kerja (*${hariKunjungan}, ${extracted.tanggal_kunjungan}*) telah tercatat dan sedang *MENUNGGU PERSETUJUAN* Admin Ri'ayah.\n\n` +
        `Barcode kunjungan resmi akan dikirimkan ke nomor WhatsApp ini setelah disetujui oleh pengasuhan pondok.`;
    }

    const bookingResult = {
      id: bookingId,
      booking_source: 'WHATSAPP',
      nama_santri: extracted.nama_santri,
      kelas: extracted.kelas,
      asal: extracted.asal,
      tanggal_kunjungan: extracted.tanggal_kunjungan,
      hari_kunjungan: hariKunjungan,
      jam_kunjungan: extracted.jam_kunjungan,
      jam_selesai: extracted.jam_selesai,
      titipan_barang: extracted.titipan_barang,
      berat_barang_kg: extracted.berat_barang_kg,
      nama_penjenguk: extracted.nama_penjenguk,
      status_penjenguk: extracted.status_penjenguk,
      no_wa_penjenguk: cleanSender || normalizePhone(extracted.no_wa_penjenguk || '') || '',
      rfid_uid: extracted.rfid_uid || resolvedIdentity?.rfidUid || null,
      barcode_token: barcodeToken,
      approval_type: approvalType,
      status_kunjungan: statusKunjungan,
      created_at: new Date().toISOString()
    };

    await saveBookingToSystem(bookingResult);

    return res.status(200).json({
      success: true,
      booking: bookingResult,
      replyMessage: replyText,
      isAutoApproved: isWeekend
    });
  } catch (err) {
    console.error('Error in /api/visits/wa-booking:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Parser pintar untuk mengekstrak format booking dari teks WhatsApp
 */
function parseBookingMessage(text, sender, senderName, waliIdentity = null) {
  const clean = text || '';
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const normalizedSender = normalizePhone(sender);

  // Helper regex matcher
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

  let namaSantri = rawMatchedSantri || defaultSantri;

  if (isPriorityNurmiyatyPhone(normalizedSender) && waliIdentity?.santriNama) {
    namaSantri = waliIdentity.santriNama;
  }

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

  const jamMulai = matchField([
    /(?:jam|waktu|pukul)\s*[:=]?\s*([0-9]{1,2}[:.][0-9]{2})/i
  ], '14:00').replace('.', ':');

  const jamSelesai = matchField([
    /(?:s\/d|sampai|-)\s*([0-9]{1,2}[:.][0-9]{2})/i,
    /(?:jam\s*selesai|selesai)\s*[:=]?\s*([0-9]{1,2}[:.][0-9]{2})/i
  ], '15:30').replace('.', ':');

  const titipan = matchField([
    /(?:titipan|barang|titip|bawaan)\s*[:=]\s*([^\n]+)/i
  ], 'Pakaian ganti & Vitamin');

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
    tanggal_kunjungan: tanggal,
    jam_kunjungan: jamMulai,
    jam_selesai: jamSelesai,
    titipan_barang: titipan,
    berat_barang_kg: berat,
    nama_penjenguk: penjenguk,
    status_penjenguk: statusPenjenguk,
    no_wa_penjenguk: normalizedSender,
    rfid_uid: waliIdentity?.rfidUid || null
  };
}

