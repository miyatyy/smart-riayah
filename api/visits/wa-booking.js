/**
 * Vercel Serverless Function: /api/visits/wa-booking
 * Endpoint penerima dan parser pesan booking kunjungan via WhatsApp Gateway (Fonnte API)
 * Menerapkan aturan hari:
 * - Senin - Kamis: MANUAL_WEEKDAY (Menunggu Approval Admin Ri'ayah)
 * - Jumat - Minggu: AUTO_WEEKEND (Auto-Approved + Barcode Token Terbit Seketika)
 */

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
    const sender = payload.sender || payload.phone || payload.target || '';
    const senderName = payload.name || payload.sender_name || 'Wali Santri';

    // 1. Ekstraksi Data Booking dari Pesan
    const extracted = parseBookingMessage(messageText, sender, senderName);

    // 2. Tentukan Hari Kunjungan & Validasi Weekday vs Weekend
    const targetDate = extracted.tanggal_kunjungan ? new Date(extracted.tanggal_kunjungan) : new Date();
    const dayIndex = isNaN(targetDate.getTime()) ? new Date().getDay() : targetDate.getDay();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariKunjungan = extracted.hari_kunjungan || dayNames[dayIndex];

    const isWeekend = ['Jumat', 'Sabtu', 'Minggu'].includes(hariKunjungan);
    const bookingId = `VST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

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
        `Assalamu'alaikum Wr. Wb. Bapak/Ibu *${extracted.nama_penjenguk}*.\n\n` +
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
        `Assalamu'alaikum Wr. Wb. Bapak/Ibu *${extracted.nama_penjenguk}*.\n\n` +
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
      no_wa_penjenguk: sender || extracted.no_wa_penjenguk,
      rfid_uid: extracted.rfid_uid || null,
      barcode_token: barcodeToken,
      approval_type: approvalType,
      status_kunjungan: statusKunjungan,
      created_at: new Date().toISOString()
    };

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
function parseBookingMessage(text, sender, senderName) {
  const clean = text || '';
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);

  // Helper regex matcher
  const matchField = (patterns, fallback = '') => {
    for (const pat of patterns) {
      const match = clean.match(pat);
      if (match && match[1]) return match[1].trim();
    }
    return fallback;
  };

  const namaSantri = matchField([
    /(?:nama\s*santri|santri|ananda)\s*[:=]\s*([^\n,]+)/i,
    /(?:menjenguk|sambang|jenguk)\s+([a-zA-Z\s]{3,30})/i
  ], 'Ahmad Fauzi');

  const kelas = matchField([
    /(?:kelas|kamar|asrama)\s*[:=]\s*([^\n,]+)/i
  ], '10-A (Umar bin Khattab 204)');

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

  const penjenguk = matchField([
    /(?:nama\s*penjenguk|penjenguk|wali|orang\s*tua)\s*[:=]\s*([^\n,]+)/i
  ], senderName || 'Ibu Fatimah Az-Zahra');

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
    no_wa_penjenguk: sender
  };
}
