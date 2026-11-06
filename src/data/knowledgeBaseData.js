/**
 * Smart Ri'ayah - Pre-seeded Official Knowledge Base
 * 10 Peraturan Resmi Pondok Pesantren Modern Darul Ulum
 */

import { getRealtimePondokClock } from '../utils/pondokTimeUtils';

export const OFFICIAL_TOPIC_GROUPS = [
  'Booking Flow',
  'Policy & Boundaries',
  'Customer Support',
  'Order Flow',
  'Customer FAQ',
  'Business Foundation',
  'Pricing'
];

export const INITIAL_KNOWLEDGE_BASE = [
  {
    id: 'kb-1',
    priority: 10,
    topicGroup: 'Booking Flow',
    category: 'booking',
    title: 'Jadwal Kunjungan Aktif & Jam Operasional Pondok',
    content: `Jadwal resmi kunjungan/sambangan wali santri di Pesantren Modern Darul Ulum:
• Jumat, Sabtu, Minggu (Weekend):
  - Sesi Pagi: 08.30 – 11.30 WITA
  - Sesi Sore: 13.30 – 16.30 WITA
  (Status: Auto-Approved / Tiket E-Barcode WA langsung terbit otomatis).
• Senin – Kamis (Hari Kerja):
  - Sesi Sore: 14.00 – 16.30 WITA (Di luar jam KBM santri)
  (Status: Wajib Approval Admin Ri'ayah terlebih dahulu sebelum E-Barcode WA diterbitkan).
• Durasi maksimal kunjungan: 90 menit per sesi.
• Seluruh aktivitas kunjungan ditutup sementara saat berkumandang adzan untuk shalat fardhu berjamaah di Masjid Jami' Pesantren.`,
    snippet: 'Weekend (Jumat–Minggu) 08.30–11.30 & 13.30–16.30 WITA (Auto-Approve). Weekday 14.00–16.30 WITA (Wajib Approval Admin). Durasi max 90 menit...',
    quality: '98/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-2',
    priority: 15,
    topicGroup: 'Booking Flow',
    category: 'booking',
    title: 'Prosedur Booking Kunjungan via WhatsApp & Barcode Gate Pass',
    content: `Prosedur pemesanan izin kunjungan santri:
1. Wali santri mengirimkan pesan booking melalui WhatsApp Gateway dengan mencantumkan nama santri, kelas, asal, hari & jam kunjungan, jam selesai, barang titipan, berat (Kg), nama penjenguk, dan status hubungan.
2. Untuk kunjungan akhir pekan (Jumat–Minggu), sistem AI langsung menerbitkan kode E-Barcode resmi (contoh: GP-DU-AHMAD-7788).
3. Untuk kunjungan hari kerja (Senin–Kamis), permohonan masuk ke antrean verifikasi Admin Ri'ayah. Setelah disetujui, E-Barcode dikirimkan otomatis ke WhatsApp wali.
4. Saat tiba di pesantren, tunjukkan tiket E-Barcode kepada Satpam di Pos Jaga Gerbang Utama atau lakukan Tap Kartu RFID santri untuk membuka turnstile gate.`,
    snippet: 'Kirim chat WA booking -> AI verifikasi jadwal -> Terbit E-Barcode Gate Pass -> Scan di Pos Satpam / Tap RFID...',
    quality: '96/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-3',
    priority: 20,
    topicGroup: 'Policy & Boundaries',
    category: 'policy',
    title: 'Aturan Titipan Barang Makanan & Batas Berat Maksimal (5 Kg)',
    content: `Ketentuan titipan barang & makanan santri:
1. Setiap barang bawaan dan titipan makanan wajib diperiksa dan ditimbang oleh petugas Satpam di Pos Jaga Gerbang Utama.
2. Batas berat maksimal barang titipan adalah 5 Kg per santri per sesi kunjungan untuk mencegah penumpukan barang di asrama.
3. Makanan basah atau cepat basi wajib dihabiskan pada hari kunjungan yang sama dan tidak boleh disimpan di lemari kamar asrama.
4. Makanan kering/snack wajib disimpan di dalam toples tertutup rapat berlabel nama dan kelas santri.`,
    snippet: 'Barang titipan wajib ditimbang di Pos Satpam, maksimal 5 Kg per santri. Makanan basah wajib dihabiskan di hari yang sama...',
    quality: '95/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-4',
    priority: 25,
    topicGroup: 'Policy & Boundaries',
    category: 'policy',
    title: 'Daftar Barang Terlarang (Prohibited Items) di Lingkungan Pesantren',
    content: `Demi menjaga kekhusyukan ibadah, kedisiplinan, dan fokus tholabul 'ilmi, dilarang keras membawa atau menitipkan barang-barang berikut:
• Barang Elektronik Pribadi: Smartphone, tablet, laptop, smartwatch, MP3 player, modem/WiFi portable, konsol game portabel.
• Produk Terlarang: Rokok konvensional, rokok elektrik (vape/pods), korek gas, miras, senjata tajam, obat-obatan tanpa resep dokter pondok.
• Busana & Penampilan: Celana jeans ketat/sobek, kaos bergambar tidak senonoh, perhiasan emas mencolok untuk santri putra.
• Alat Listrik: Pemanas air (water heater immersion), teko listrik, setrika tanpa izin asrama.
Barang temuan akan disita permanen oleh Bagian Keamanan (OSIS & Musyrif).`,
    snippet: 'Dilarang membawa HP/gadget, rokok/vape, celana jeans, pakaian non-syar\'i, dan alat pemanas listrik tanpa izin...',
    quality: '97/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-5',
    priority: 30,
    topicGroup: 'Policy & Boundaries',
    category: 'policy',
    title: 'Adab Kunjungan, Busana Penjenguk & Pemisahan Area Putra-Putri',
    content: `Tata tertib penjenguk santri:
1. Wajib mengenakan busana muslim/muslimah yang sopan, rapi, dan menutup aurat (pria memakai baju koko/kemeja dan celana panjang rapi; wanita mengenakan gamis/rok panjang dan jilbab syar'i).
2. Dilarang keras merokok di seluruh lingkungan pondok pesantren.
3. Pertemuan kunjungan hanya diperbolehkan di area umum: Gazebo Kunjungan, Aula Pertemuan Ma'had, dan Taman Terbuka Hijau.
4. Penjenguk DILARANG KERAS memasuki kamar tidur atau kawasan asrama santri.
5. Area kunjungan santri putra dan santriwati putri dipisahkan secara ketat demi menjaga adab dan kenyamanan bersama.`,
    snippet: 'Wajib busana muslim/muslimah sopan. Dilarang merokok, dilarang masuk kamar tidur asrama, area putra & putri terpisah...',
    quality: '96/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-6',
    priority: 35,
    topicGroup: 'Customer Support',
    category: 'service',
    title: 'Kebijakan Steril HP & Prosedur Menanyakan Kelakuan Santri',
    content: `Kebijakan komunikasi dan pemantauan perkembangan santri:
1. Pesantren Modern Darul Ulum menerapkan kebijakan bebas gadget (steril HP) 100% untuk seluruh santri.
2. Wali santri dapat menanyakan kabar, adab harian, kesehatan, dan capaian hafalan Al-Qur'an melalui WhatsApp Gateway resmi Smart Riayah.
3. Alur pencatatan: Pengurus asrama/OSIS mencatat mutaba'ah harian -> diverifikasi oleh Admin Ri'ayah -> disinkronkan ke WhatsApp Gateway.
4. Jika ada kebutuhan mendesak berbicara langsung dengan pengasuh, ketik 'bicara dengan admin' untuk dialihkan ke sesi konsultasi langsung dengan Ustadz Musyrif.`,
    snippet: 'Santri steril HP 100%. Pantau akhlak & tahfizh via WhatsApp Gateway Smart Riayah. Alur berjenjang OSIS -> Musyrif -> Wali...',
    quality: '94/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-7',
    priority: 40,
    topicGroup: 'Order Flow',
    category: 'service',
    title: 'Penggunaan Kartu Smart RFID & Prosedur Kartu Hilang (Revoke)',
    content: `Fungsi & Prosedur Kartu Pintar RFID Santri:
1. Kartu RFID 13.56 MHz berfungsi sebagai: (a) Kartu Identitas Santri, (b) Kunci pembuka IoT Smart Gate Turnstile, (c) Dompet nontunai (cashless) kantin & laundry, (d) Presensi shalat berjamaah.
2. Jika kartu santri hilang atau rusak, wali santri atau santri dapat segera melapor ke Admin Ri'ayah.
3. Admin akan langsung menonaktifkan UID kartu lama (Blacklist/Revoke status) sehingga tidak dapat disalahgunakan di gerbang maupun kantin.
4. Kartu baru akan diterbitkan dengan saldo dompet dan poin kedisiplinan yang otomatis ditransfer utuh tanpa berkurang.`,
    snippet: 'Kartu RFID multifungsi: Gate Pass, Cashless Kantin, ID Card. Jika hilang, lapor admin untuk revoke instan & saldo tetap aman...',
    quality: '95/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-8',
    priority: 45,
    topicGroup: 'Customer FAQ',
    category: 'faq',
    title: 'Prosedur Izin Pulang Bermalam & Kepulangan Darurat Santri',
    content: `Ketentuan perizinan keluar pondok (DU-PERMIT):
1. Izin Pulang Bermalam hanya diberikan untuk: (a) Libur resmi kalender pesantren, (b) Acara keluarga inti (pernikahan saudara kandung, walimah haji), (c) Kondisi duka cita keluarga inti.
2. Permohonan izin diajukan via aplikasi minimal H-1 sebelum jadwal penjemputan.
3. Penjemput wajib orang tua kandung atau wali yang terdaftar di sistem.
4. Santri wajib melakukan tap kartu RFID di Smart Gate saat keluar dan saat kembali masuk asrama untuk memvalidasi jam ketibaan agar tidak terkena potongan poin keterlambatan.`,
    snippet: 'Izin pulang diajukan H-1 untuk acara keluarga inti / libur resmi. Penjemput wajib wali terdaftar. Wajib Tap RFID saat keluar-masuk...',
    quality: '93/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-9',
    priority: 50,
    topicGroup: 'Business Foundation',
    category: 'business profile',
    title: 'Profil Layanan Smart Riayah Pondok Pesantren Modern Darul Ulum',
    content: `Pondok Pesantren Modern Darul Ulum:
• Lembaga pendidikan Islam terpadu yang memadukan kurikulum kepesantrenan (KMI), kurikulum nasional, tahfizh Al-Qur'an 30 Juz, penguasaan Bahasa Arab & Inggris aktif, serta pembinaan karakter beradab.
• Dilengkapi sistem ekosistem IoT Smart Riayah: turnstile gate otomatis, pemantauan CCTV Poskestren, dompet jajan cashless, dan integrasi WhatsApp Gateway AI 24/7 untuk menghubungkan wali santri dengan pengasuhan pondok.`,
    snippet: 'Profil Pesantren Modern Darul Ulum: Kurikulum terpadu KMI, Tahfizh 30 Juz, Bahasa Internasional, dan IoT Smart Riayah terpadu...',
    quality: '99/100',
    status: 'Active',
    security: 'Security Approved'
  },
  {
    id: 'kb-10',
    priority: 55,
    topicGroup: 'Pricing',
    category: 'payment',
    title: 'Informasi Administrasi Syahriah & Batas Uang Tunai Santri',
    content: `Ketentuan administrasi keuangan santri:
1. Iuran bulanan pondok (Syahriah) jatuh tempo setiap tanggal 10 setiap bulan, dibayarkan melalui nomor Virtual Account (VA) resmi masing-masing santri.
2. Santri TIDAK DIPERBOLEHKAN memegang uang tunai (cash) lebih dari Rp 50.000 di dalam asrama untuk mencegah risiko kehilangan.
3. Semua transaksi belanja santri di kantin, minimarket ma'had, dan laundry dilakukan secara cashless menggunakan kartu RFID.
4. Batas maksimal pembelanjaan harian (Daily Spend Limit) default adalah Rp 25.000 per hari, dapat disesuaikan oleh wali santri via dashboard.`,
    snippet: 'Syahriah jatuh tempo tgl 10 via VA. Santri dilarang pegang uang tunai > Rp 50.000. Belanja wajib via kartu RFID (limit Rp 25.000/hari)...',
    quality: '94/100',
    status: 'Active',
    security: 'Security Approved'
  }
];

/**
 * Format balasan otomatis WhatsApp resmi saat wali santri bertanya jadwal/aturan kunjungan
 */
export function buildVisitingHoursAndRulesReply(senderName = 'Bapak/Ibu Wali Santri') {
  const clock = getRealtimePondokClock();
  const waktuStr = `${clock.nama_hari}, ${clock.tanggal_lengkap} • ${clock.jam_menit_detik} WITA`;

  return `🕌 *INFORMASI JADWAL KUNJUNGAN AKTIF & TATA TERTIB PONDOK*
🕒 *Waktu Sistem Pondok Saat Ini:* ${waktuStr}

📅 *1. JADWAL KUNJUNGAN AKTIF:*
• *Jumat – Minggu (Weekend):*
  - Sesi Pagi: *08.30 – 11.30 WITA*
  - Sesi Sore: *13.30 – 16.30 WITA*
  *(✅ Auto-Approval: Tiket E-Barcode WA langsung terbit otomatis)*
• *Senin – Kamis (Hari Kerja):*
  - Sesi Sore: *14.00 – 16.30 WITA* (Setelah jam KBM santri)
  *(⏳ Wajib Approval Admin Ri'ayah sebelum E-Barcode dikirim ke WA)*

⚖️ *2. PERATURAN PENTING KUNJUNGAN & TITIPAN BARANG:*
• Durasi kunjungan maksimal *90 menit* per sesi.
• Barang/makanan titipan wajib ditimbang di Pos Satpam (Maksimal *5 Kg*) dan bebas dari barang terlarang (HP/gadget, rokok/vape, alat masak listrik).
• Penjenguk wajib berbusana muslim/muslimah sopan dan hanya bertemu di Aula/Gazebo Kunjungan (dilarang masuk asrama tidur).
• Wajib menunjukkan *E-Barcode Kunjungan dari WhatsApp ini* atau *Tap Kartu RFID* di Pos Jaga Satpam saat tiba.

---
📝 *FORMAT BOOKING KUNJUNGAN CEPAT:*
Silakan balas pesan ini dengan menyebutkan data berikut (bisa diketik bebas):
_Nama Santri/Wati, Kelas, Asal, Hari & Jam Kunjungan, Jam Selesai, Titipan Barang, Berat Barang (Kg), Nama Penjenguk, dan Status Penjenguk (Wali/Keluarga)._`;
}

