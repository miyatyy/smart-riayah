// Seed Data untuk Smart Permit & Smart Ri'ayah
// Pesantren Modern Darul Ulum

export const INITIAL_SANTRI = [
  {
    id: "S-101",
    nis: "125456",
    nama: "Ahmad Fauzi",
    kelas: "10-A",
    gender: "L",
    kamar: "Umar bin Khattab 204",
    rfidUid: "04:A1:2B:9C",
    foto: "/images/avatar_santri_putra.jpg",
    wali: {
      nama: "Ibu Fatimah Az-Zahra",
      hubungan: "Ibu Kandung",
      telepon: "0812-3456-7890",
      alamat: "Jl. Melati No. 42, Surabaya"
    },
    saldoRfid: 145000,
    limitJajanHarian: 25000,
    poinDisiplin: 95,
    tahfidzJuz: 4,
    statusAsrama: "DI_ASRAMA", // DI_ASRAMA, DI_LUAR, TERLAMBAT
    penyakitKhusus: "Alergi Kacang & Asma Ringan"
  },
  {
    id: "S-102",
    nis: "125457",
    nama: "Muhammad Rayhan",
    kelas: "11-IPA 1",
    gender: "L",
    kamar: "Abu Bakar 102",
    rfidUid: "04:B2:3C:D1",
    foto: "/images/avatar_santri_putra.jpg",
    wali: {
      nama: "Bapak H. Bambang Sugianto",
      hubungan: "Ayah Kandung",
      telepon: "0813-8877-6655",
      alamat: "Perum Permata Indah B-12, Sidoarjo"
    },
    saldoRfid: 82000,
    limitJajanHarian: 30000,
    poinDisiplin: 88,
    tahfidzJuz: 7,
    statusAsrama: "DI_LUAR",
    penyakitKhusus: "-"
  },
  {
    id: "S-103",
    nis: "125458",
    nama: "Siti Nurhaliza",
    kelas: "10-B (Putri)",
    gender: "P",
    kamar: "Khadijah 105",
    rfidUid: "04:C3:4D:E2",
    foto: "/images/avatar_santri_putri.jpg",
    wali: {
      nama: "Ibu Siti Rohmah",
      hubungan: "Ibu Kandung",
      telepon: "0852-1122-3344",
      alamat: "Jl. Ahmad Yani No. 88, Gresik"
    },
    saldoRfid: 210000,
    limitJajanHarian: 20000,
    poinDisiplin: 100,
    tahfidzJuz: 12,
    statusAsrama: "DI_ASRAMA",
    penyakitKhusus: "Gastritis Kronis (Maag)"
  },
  {
    id: "S-104",
    nis: "125459",
    nama: "Fajar Ramadhan",
    kelas: "12-IPS",
    gender: "L",
    kamar: "Ali bin Abi Thalib 301",
    rfidUid: "04:D4:5E:F3",
    foto: "/images/avatar_santri_putra.jpg",
    wali: {
      nama: "Bapak Hendra Wijaya",
      hubungan: "Ayah Kandung",
      telepon: "0819-9988-7711",
      alamat: "Jl. Basuki Rahmat 15, Malang"
    },
    saldoRfid: 35000,
    limitJajanHarian: 25000,
    poinDisiplin: 55,
    tahfidzJuz: 2,
    statusAsrama: "TERLAMBAT",
    penyakitKhusus: "-"
  },
  {
    id: "S-105",
    nis: "125460",
    nama: "Zulfikar Ali",
    kelas: "11-Keagamaan",
    gender: "L",
    kamar: "Utsman bin Affan 201",
    rfidUid: "04:E5:6F:04",
    foto: "/images/avatar_santri_putra.jpg",
    wali: {
      nama: "Ustadz H. Wahid Hasjim",
      hubungan: "Ayah Kandung",
      telepon: "0812-9900-1122",
      alamat: "Kec. Peterongan, Jombang"
    },
    saldoRfid: 120000,
    limitJajanHarian: 25000,
    poinDisiplin: 90,
    tahfidzJuz: 9,
    statusAsrama: "DI_ASRAMA",
    penyakitKhusus: "-"
  },
  {
    id: "S-106",
    nis: "125461",
    nama: "Aisyah Zahra",
    kelas: "12-IPA (Putri)",
    gender: "P",
    kamar: "Aisyah 202",
    rfidUid: "04:F6:7A:15",
    foto: "/images/avatar_santri_putri.jpg",
    wali: {
      nama: "Ibu Nurul Hidayah",
      hubungan: "Ibu Kandung",
      telepon: "0821-4455-6677",
      alamat: "Jl. Raya Candi 7, Mojokerto"
    },
    saldoRfid: 175000,
    limitJajanHarian: 25000,
    poinDisiplin: 100,
    tahfidzJuz: 15,
    statusAsrama: "DI_ASRAMA",
    penyakitKhusus: "Alergi Debu"
  },
  {
    id: "S-107",
    nis: "46764644",
    nama: "Nurmiyaty",
    kelas: "11-B (Putri)",
    gender: "P",
    kamar: "Umar bin Khattab 204",
    rfidUid: "53:57:98:0F",
    foto: "/images/avatar_santri_putri.jpg",
    wali: {
      nama: "Bapak/Ibu Wali dari Nurmiyaty",
      hubungan: "Wali Santri",
      telepon: "0812-3456-7890",
      alamat: "Surabaya, Jawa Timur"
    },
    saldoRfid: 150000,
    limitJajanHarian: 30000,
    poinDisiplin: 100,
    tahfidzJuz: 8,
    statusAsrama: "DI_ASRAMA",
    penyakitKhusus: "-"
  }
];

export const INITIAL_PERMITS = [
  {
    id: "PRM-2026-001",
    santriId: "S-101", // Ahmad Fauzi
    kategori: "Pesiar",
    keperluan: "Membeli perlengkapan kitab kuning dan keperluan mandi di Swalayan Barokah",
    penjemput: "Paman Ridwan (Keluarga)",
    waktuKeluarRencana: "2026-10-14T16:30",
    batasKembali: "2026-10-14T20:30",
    status: "PENDING", // PENDING -> APPROVED -> ACTIVE -> OVERDUE -> COMPLETED
    musyrifPenyetuju: null,
    waktuApproval: null,
    waktuKeluarAktual: null,
    waktuKembaliAktual: null,
    tokenIzin: "DU-PERMIT-101-7789",
    catatanMusyrif: ""
  },
  {
    id: "PRM-2026-002",
    santriId: "S-102", // Muhammad Rayhan
    kategori: "Pulang Bermalam",
    keperluan: "Menghadiri walimatul 'ursy kakak kandung di Sidoarjo",
    penjemput: "Bapak H. Bambang (Ayah)",
    waktuKeluarRencana: "2026-10-14T08:00",
    batasKembali: "2026-10-14T21:00",
    status: "ACTIVE",
    musyrifPenyetuju: "Ust. M. Syukron, M.Pd.",
    waktuApproval: "2026-10-14T07:30",
    waktuKeluarAktual: "2026-10-14T08:14",
    waktuKembaliAktual: null,
    tokenIzin: "DU-PERMIT-102-3312",
    catatanMusyrif: "Harap kembali tepat waktu sebelum bel tidur asrama berbunyi."
  },
  {
    id: "PRM-2026-003",
    santriId: "S-104", // Fajar Ramadhan (OVERDUE)
    kategori: "Pesiar",
    keperluan: "Servis laptop untuk tugas akhir madrasah di Plasa IT",
    penjemput: "Mandiri (Jalan Kaki/Angkutan)",
    waktuKeluarRencana: "2026-10-14T10:00",
    batasKembali: "2026-10-14T14:00", // Waktu lampau
    status: "OVERDUE",
    musyrifPenyetuju: "Ust. Ahmad Dahlan, S.Pd.I",
    waktuApproval: "2026-10-14T09:45",
    waktuKeluarAktual: "2026-10-14T10:08",
    waktuKembaliAktual: null,
    tokenIzin: "DU-PERMIT-104-9901",
    catatanMusyrif: "Maksimal jam 14.00 WIB."
  },
  {
    id: "PRM-2026-004",
    santriId: "S-105", // Zulfikar Ali (APPROVED - siap tap gerbang)
    kategori: "Pesiar",
    keperluan: "Mewakili pondok seleksi Lomba MQK Tingkat Kabupaten di Kemenag",
    penjemput: "Ust. Kholil (Pendamping Pondok)",
    waktuKeluarRencana: "2026-10-14T17:00",
    batasKembali: "2026-10-14T22:00",
    status: "APPROVED",
    musyrifPenyetuju: "Ust. M. Syukron, M.Pd.",
    waktuApproval: "2026-10-14T14:15",
    waktuKeluarAktual: null,
    waktuKembaliAktual: null,
    tokenIzin: "DU-PERMIT-105-4421",
    catatanMusyrif: "Semoga barokah dan meraih juara."
  },
  {
    id: "PRM-2026-005",
    santriId: "S-103", // Siti Nurhaliza (COMPLETED)
    kategori: "Berobat",
    keperluan: "Pemeriksaan berkala dokter spesialis di RS Nahdlatul Ulama",
    penjemput: "Ambulans Poskestren & Ibu Siti Rohmah",
    waktuKeluarRencana: "2026-10-13T09:00",
    batasKembali: "2026-10-13T13:00",
    status: "COMPLETED",
    musyrifPenyetuju: "Usth. Hj. Maryam, Lc.",
    waktuApproval: "2026-10-13T08:30",
    waktuKeluarAktual: "2026-10-13T09:05",
    waktuKembaliAktual: "2026-10-13T12:48",
    tokenIzin: "DU-PERMIT-103-1102",
    catatanMusyrif: "Sudah kembali dalam kondisi sehat."
  },
  {
    id: "PRM-2026-006",
    santriId: "S-107", // nurmiyaty
    kategori: "Pesiar",
    keperluan: "Membeli kitab & perlengkapan santri",
    penjemput: "Keluarga / Wali",
    waktuKeluarRencana: "2026-10-15T11:00",
    batasKembali: "2026-10-15T14:40",
    status: "APPROVED",
    musyrifPenyetuju: "Ust. M. Syukron, M.Pd.",
    waktuApproval: "2026-10-15T11:15",
    waktuKeluarAktual: null,
    waktuKembaliAktual: null,
    tokenIzin: "DU-46764644-1598",
    catatanMusyrif: "Izin disetujui, harap kembali sebelum batas waktu 14:40 WIB."
  }
];

export const INITIAL_GATE_LOGS = [
  {
    id: "LOG-9001",
    timestamp: "2026-10-14T08:14:22",
    santriId: "S-102",
    santriNama: "Muhammad Rayhan",
    rfidUid: "04:B2:3C:D1",
    gateId: "GATE-01 (Main Exit)",
    tipe: "TAP_KELUAR",
    status: "VERIFIED",
    remarks: "Izin Pulang Bermalam Valid (DU-PERMIT-102-3312)",
    snapshotUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "LOG-9002",
    timestamp: "2026-10-14T10:08:45",
    santriId: "S-104",
    santriNama: "Fajar Ramadhan",
    rfidUid: "04:D4:5E:F3",
    gateId: "GATE-01 (Main Exit)",
    tipe: "TAP_KELUAR",
    status: "VERIFIED",
    remarks: "Izin Pesiar Valid (DU-PERMIT-104-9901)",
    snapshotUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80"
  },
  {
    id: "LOG-9003",
    timestamp: "2026-10-14T11:45:10",
    santriId: "S-101",
    santriNama: "Ahmad Fauzi",
    rfidUid: "04:A1:2B:9C",
    gateId: "GATE-01 (Main Exit)",
    tipe: "ILLEGAL_ATTEMPT",
    status: "DENIED",
    remarks: "ANTI-BYPASS LOCK: Mencoba tap keluar saat izin masih berstatus PENDING",
    snapshotUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80"
  }
];

export const INITIAL_DISCIPLINE = [
  {
    id: "DISC-01",
    santriId: "S-104", // Fajar Ramadhan
    tanggal: "2026-10-14 14:05",
    jenis: "PELANGGARAN", // PELANGGARAN / REWARD
    kategori: "Keterlambatan Smart Gate (Overdue)",
    poin: -15,
    deskripsi: "[AUTO-SYSTEM] Terdeteksi melebihi batas waktu izin pesiar Smart Gate lebih dari 30 menit.",
    pencatat: "IoT Smart Gate Auto-Audit Daemon"
  },
  {
    id: "DISC-02",
    santriId: "S-101", // Ahmad Fauzi
    tanggal: "2026-10-12 19:30",
    jenis: "REWARD",
    kategori: "Prestasi / Adab",
    poin: +10,
    deskripsi: "Juara 1 Musabaqah Qira'atil Kutub (MQK) Fathul Qorib tingkat asrama.",
    pencatat: "Ust. M. Syukron, M.Pd."
  },
  {
    id: "DISC-03",
    santriId: "S-104", // Fajar
    tanggal: "2026-10-10 05:15",
    jenis: "PELANGGARAN",
    kategori: "Kedisiplinan Shalat",
    poin: -10,
    deskripsi: "Masbuk Shalat Subuh berjamaah di Masjid Jami' 2 kali berturut-turut.",
    pencatat: "Ust. Ahmad Dahlan, S.Pd.I"
  },
  {
    id: "DISC-04",
    santriId: "S-103", // Siti Nurhaliza
    tanggal: "2026-10-08 20:00",
    jenis: "REWARD",
    kategori: "Hafalan Al-Qur'an",
    poin: +15,
    deskripsi: "Khatam Tasmi' 5 Juz sekali duduk dengan predikat Mumtaz.",
    pencatat: "Usth. Hj. Maryam, Lc."
  }
];

export const INITIAL_MUTABAAH = [
  {
    santriId: "S-101",
    tanggal: "2026-10-14",
    subuh: "BERJAMAAH_MASJID", // BERJAMAAH_MASJID, MUNFARID, MASBUK, GHAIB
    dzuhur: "BERJAMAAH_MASJID",
    ashar: "BERJAMAAH_MASJID",
    maghrib: "BERJAMAAH_MASJID",
    isya: "BERJAMAAH_MASJID",
    dhuha: true,
    qiyamullail: true,
    tahfidz: {
      surah: "An-Nisa'",
      ayat: "1-14",
      juz: 4,
      predikat: "MUMTAZ",
      murojaah: "Juz 1-3 Lancar",
      ustadz: "Ust. Hafizhuddin"
    }
  },
  {
    santriId: "S-103",
    tanggal: "2026-10-14",
    subuh: "BERJAMAAH_MASJID",
    dzuhur: "BERJAMAAH_MASJID",
    ashar: "BERJAMAAH_MASJID",
    maghrib: "BERJAMAAH_MASJID",
    isya: "BERJAMAAH_MASJID",
    dhuha: true,
    qiyamullail: true,
    tahfidz: {
      surah: "Yusuf",
      ayat: "53-111",
      juz: 12,
      predikat: "MUMTAZ",
      murojaah: "Juz 10-11 Mutqin",
      ustadz: "Usth. Fatimah, S.Th.I"
    }
  }
];

export const INITIAL_MEDICAL_RECORDS = [
  {
    id: "MED-001",
    santriId: "S-101",
    tanggal: "2026-10-13 10:15",
    keluhan: "Batuk berdahak, sesak nafas ringan setelah kegiatan kerja bakti",
    diagnosa: "Bronkitis Alergika & Asma Eksaserbasi Ringan",
    tindakan: "Nebulisasi Ventolin 1 respule + Paracetamol 500mg",
    statusIstirahat: "ISTIRAHAT_ASRAMA",
    durasiIstirahat: "1 Hari (13-14 Okt)",
    butuhRujukanRs: false,
    petugasKlinik: "dr. Nurul Aini (Dokter Poskestren)"
  },
  {
    id: "MED-002",
    santriId: "S-103",
    tanggal: "2026-10-12 14:00",
    keluhan: "Nyeri ulu hati hebat, mual dan muntah 3x",
    diagnosa: "Gastritis Akut Erosif",
    tindakan: "Injeksi Ondansetron & Antasida Suspensi",
    statusIstirahat: "RUJUKAN_RS",
    durasiIstirahat: "2 Hari",
    butuhRujukanRs: true,
    rsRujukan: "RS Nahdlatul Ulama Jombang",
    petugasKlinik: "dr. Nurul Aini (Dokter Poskestren)"
  }
];

export const INITIAL_ROOMS = [
  {
    id: "RM-204",
    namaGedung: "Asrama Putra Umar bin Khattab",
    kategoriGedung: "PUTRA",
    nomorKamar: "Kamar 204",
    lantai: 2,
    kapasitas: 10,
    terisi: 8,
    ketuaKamar: "Ahmad Fauzi",
    skorKerapianTerakhir: 94,
    jadwalPiketHariIni: "Ahmad Fauzi & Danial Hakim",
    catatanInspeksi: "Kamar rapi, lemari seragam tertata rapi, sajadah terlipat wangi."
  },
  {
    id: "RM-102",
    namaGedung: "Asrama Putra Abu Bakar",
    kategoriGedung: "PUTRA",
    nomorKamar: "Kamar 102",
    lantai: 1,
    kapasitas: 8,
    terisi: 7,
    ketuaKamar: "Muhammad Rayhan",
    skorKerapianTerakhir: 88,
    jadwalPiketHariIni: "Rayhan & Ilham",
    catatanInspeksi: "Rak sandal luar perlu ditata ulang."
  },
  {
    id: "RM-105",
    namaGedung: "Asrama Putri Khadijah",
    kategoriGedung: "PUTRI",
    nomorKamar: "Kamar 105",
    lantai: 1,
    kapasitas: 8,
    terisi: 6,
    ketuaKamar: "Siti Nurhaliza",
    skorKerapianTerakhir: 98,
    jadwalPiketHariIni: "Siti Nurhaliza & Fatimah K.",
    catatanInspeksi: "Sangat bersih, wangi melati, sanitasi wastafel prima."
  },
  {
    id: "RM-101",
    namaGedung: "Asrama Putri Siti Aisyah",
    kategoriGedung: "PUTRI",
    nomorKamar: "Kamar 101",
    lantai: 1,
    kapasitas: 8,
    terisi: 4,
    ketuaKamar: "Siti Maryam",
    skorKerapianTerakhir: 95,
    jadwalPiketHariIni: "Siti Maryam & Anisa",
    catatanInspeksi: "Kamar baru renovasi, fasilitas tempat tidur dan loker baru siap pakai."
  },
  {
    id: "RM-202",
    namaGedung: "Asrama Putri Siti Aisyah",
    kategoriGedung: "PUTRI",
    nomorKamar: "Kamar 202",
    lantai: 2,
    kapasitas: 10,
    terisi: 5,
    ketuaKamar: "Aisyah Zahra",
    skorKerapianTerakhir: 96,
    jadwalPiketHariIni: "Aisyah Zahra & Zahirah",
    catatanInspeksi: "Kamar rapi, mukena bersih di gantungan."
  }
];

export const INITIAL_RFID_TRANSACTIONS = [
  {
    id: "TRX-POS-101",
    santriId: "S-101",
    tanggal: "2026-10-14 12:45",
    tipe: "KANTIN_POS",
    nominal: 12000,
    merchant: "Kantin Sehat Darul Ulum (IdeaPOS)",
    keterangan: "Nasi Ayam Geprek + Jus Jeruk",
    saldoAkhir: 145000
  },
  {
    id: "TRX-POS-102",
    santriId: "S-101",
    tanggal: "2026-10-13 16:30",
    tipe: "LAUNDRY",
    nominal: 15000,
    merchant: "Unit Laundry Berkah Pondok",
    keterangan: "Cuci Setrika Kiloan 2.5 Kg (RFID Weighing Log)",
    saldoAkhir: 157000
  },
  {
    id: "TRX-POS-103",
    santriId: "S-102",
    tanggal: "2026-10-13 10:00",
    tipe: "PERPUSTAKAAN",
    nominal: 0,
    merchant: "Perpustakaan Digital Pondok",
    keterangan: "Peminjaman Buku: Terjemah Ihya' Ulumuddin Jilid 2 (Jatuh Tempo: 20 Okt)",
    saldoAkhir: 82000
  }
];

export const INITIAL_WHATSAPP_LOGS = [
  {
    id: "WA-001",
    waktu: "10:08 WIB",
    penerima: "Bapak Hendra Wijaya (Wali Fajar Ramadhan)",
    nomor: "0819-9988-7711",
    tipe: "GATE_EXIT",
    pesan: "Assalamu'alaikum Bapak Hendra, ananda Fajar Ramadhan (Kls 12-IPS) telah melewati Smart Gate keluar pada pukul 10:08 WIB (Keperluan: Servis laptop). Batas kembali ke pondok: 14:00 WIB. Terima kasih."
  },
  {
    id: "WA-002",
    waktu: "14:15 WIB",
    penerima: "Bapak Hendra Wijaya (Wali Fajar Ramadhan)",
    nomor: "0819-9988-7711",
    tipe: "OVERDUE_ALERT",
    pesan: "PERINGATAN SISTEM: Assalamu'alaikum Bapak Hendra, ananda Fajar Ramadhan terdeteksi BELUM KEMBALI ke pondok melewati batas waktu (14:00 WIB). Mohon bantu konfirmasi keberadaan ananda. Petugas Keamanan: 0811-2233-4455."
  },
  {
    id: "WA-003",
    waktu: "12:50 WIB",
    penerima: "Ibu Fatimah Az-Zahra (Wali Ahmad Fauzi)",
    nomor: "0812-3456-7890",
    tipe: "CASHLESS_NOTIF",
    pesan: "Laporan Transaksi Smart Card: Ananda Ahmad Fauzi baru saja bertransaksi di Kantin Sehat Darul Ulum sebesar Rp 12.000. Sisa saldo RFID: Rp 145.000."
  }
];

export const INITIAL_ACCOUNTS = [
  {
    id: "ACC-01",
    role: "superadmin",
    roleName: "Super Admin (Developer)",
    email: "superadmin@gmail.com",
    password: "superadmin01",
    nama: "Ust. Eng. Al-Fatih, M.T.",
    jabatan: "Lead System Architect & IoT Developer",
    avatar: "/images/avatar_santri_putra.jpg",
    badge: "Developer Console",
    description: "Hak akses penuh bypass, diagnostik hardware ESP32-S3 & manajemen database."
  },
  {
    id: "ACC-02",
    role: "admin_riayah",
    roleName: "Admin Ri'ayah",
    email: "adminriayah@gmail.com",
    password: "riayah01",
    nama: "Ust. Drs. H. Mustofa",
    jabatan: "Kepala Biro Asrama & Setting Builder",
    avatar: "/images/avatar_santri_putra.jpg",
    badge: "Setting Builder",
    description: "Tata kelola kapasitas kamar asrama, pendaftaran santri baru & penggantian kartu RFID."
  },
  {
    id: "ACC-03",
    role: "parent",
    roleName: "Orang Tua / Wali Santri",
    email: "walisantri@gmail.com",
    password: "walisantri01",
    nama: "Ibu Fatimah Az-Zahra",
    jabatan: "Wali Santri dari Ahmad Fauzi (Kls 10-A)",
    avatar: "/images/avatar_santri_putri.jpg",
    badge: "Portal Wali Santri",
    description: "Pengajuan izin digital santri, pantau mutaba'ah ibadah & saldo transaksi cashless."
  },
  {
    id: "ACC-04",
    role: "musyrif",
    roleName: "Musyrif / Musyrifah",
    email: "Musyrif@gmail.com",
    password: "musyrif01",
    nama: "Ust. M. Syukron, M.Pd.",
    jabatan: "Koordinator Musyrif Pengasuhan Santri",
    avatar: "/images/avatar_santri_putra.jpg",
    badge: "Otorisasi Izin",
    description: "Verifikasi dan persetujuan surat izin santri serta catatan poin kedisiplinan Ri'ayah."
  },
  {
    id: "ACC-05",
    role: "security",
    roleName: "Pos Satpam (Keamanan)",
    email: "satpam@gmail.com",
    password: "satpam01",
    nama: "Komandan Sutrisno",
    jabatan: "Kepala Regu Pos Keamanan Gerbang Utama",
    avatar: "/images/avatar_santri_putra.jpg",
    badge: "Command Center Gate",
    description: "Monitoring IoT Turnstile Gate, verifikasi tap RFID RC522 & anti-bypass lock."
  },
  {
    id: "ACC-06",
    role: "poskestren",
    roleName: "Medis UKS / Poskestren",
    email: "poskestren@gmail.com",
    password: "poskestren01",
    nama: "dr. Nurul Aini",
    jabatan: "Dokter Penanggung Jawab Poskestren",
    avatar: "/images/avatar_santri_putri.jpg",
    badge: "Rekam Medis & UKS",
    description: "Pemeriksaan kesehatan, rekam medis santri, obat asrama & rujukan rumah sakit."
  },
  {
    id: "ACC-07",
    role: "kyai",
    roleName: "Pimpinan Pondok (Mudir)",
    email: "mudir@gmail.com",
    password: "mudir01",
    nama: "K.H. Ahmad Dahlan, Lc., M.A.",
    jabatan: "Mudir Ma'had & Pengasuh Pesantren",
    avatar: "/images/avatar_santri_putra.jpg",
    badge: "Executive Analytics",
    description: "Pengambilan keputusan strategis, analisis tren perizinan, dan rapor kepribadian."
  }
];

export const INITIAL_BLACKLIST = [
  {
    id: "BLK-001",
    uid: "04:99:88:77",
    santriId: "S-104",
    santriNama: "Fajar Ramadhan",
    reason: "Kartu lama dilaporkan hilang di lapangan olahraga",
    date: "2026-10-10 14:20",
    status: "REVOKED"
  }
];
