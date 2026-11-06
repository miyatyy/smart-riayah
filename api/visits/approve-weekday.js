/**
 * Vercel Serverless Function: /api/visits/approve-weekday
 * Generator Barcode Gate Pass & Notifikasi WhatsApp Persetujuan Kunjungan Senin-Kamis oleh Admin Ri'ayah
 */

const DEFAULT_FONNTE_TOKEN = process.env.FONNTE_TOKEN || '8UN12iqFjKNBYdds8FCG';

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
      service: 'Smart Riayah Weekday Visit Approval & Barcode Dispatcher'
    });
  }

  try {
    const payload = req.body || {};
    const booking = payload.booking || payload;
    const bookingId = booking.id || payload.bookingId;
    const fonnteToken = payload.fonnte_token || DEFAULT_FONNTE_TOKEN;

    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'bookingId wajib disertakan' });
    }

    const cleanSantriName = (booking.nama_santri || 'Santri').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
    const barcodeToken = booking.barcode_token || `GP-DU-${cleanSantriName}-${Math.floor(1000 + Math.random() * 9000)}`;

    const approvalWaText = `🎉 *[PERMOHONAN KUNJUNGAN DISETUJUI ADMIN RI'AYAH]*\n` +
      `Assalamu'alaikum Wr. Wb. Bapak/Ibu *${booking.nama_penjenguk || 'Wali Santri'}*.\n\n` +
      `Permohonan kunjungan ananda *${booking.nama_santri}* (${booking.kelas || 'Pondok'}) untuk hari *${booking.hari_kunjungan || 'Senin–Kamis'}, ${booking.tanggal_kunjungan}* pukul *${booking.jam_kunjungan} - ${booking.jam_selesai || '15:30'} WIB* telah *DISETUJUI* oleh Admin Ri'ayah Pondok.\n\n` +
      `📦 *Titipan Barang:* ${booking.titipan_barang || '-'} (${booking.berat_barang_kg || 0} Kg)\n` +
      `🎫 *Barcode Gate Pass Resmi:* *${barcodeToken}*\n\n` +
      `Silakan tunjukkan Barcode ini kepada Satpam di Pos Gerbang untuk verifikasi check-in masuk pondok.`;

    let fonnteResult = null;
    const targetWa = booking.no_wa_penjenguk;
    if (targetWa && fonnteToken) {
      try {
        const fRes = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            'Authorization': fonnteToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            target: targetWa,
            message: approvalWaText
          })
        });
        fonnteResult = await fRes.json().catch(() => ({}));
      } catch (fErr) {
        console.warn('Fonnte send error on approval:', fErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      bookingId: bookingId,
      barcode_token: barcodeToken,
      status_kunjungan: 'Disetujui (Siap Datang)',
      approval_message: approvalWaText,
      fonnteResult: fonnteResult
    });

  } catch (err) {
    console.error('Error in /api/visits/approve-weekday:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

