// Data & Generator Log Aktivitas Santri Terpadu
// Smart Riayah - Pesantren Modern Darul Ulum

export const MONTH_OPTIONS = [
  { value: '2026-10', label: 'Oktober 2026 (Bulan Berjalan)', daysInMonth: 31, current: true },
  { value: '2026-09', label: 'September 2026', daysInMonth: 30, current: false },
  { value: '2026-08', label: 'Agustus 2026', daysInMonth: 31, current: false }
];

// Helper to generate dynamic monthly chart & log data per santri
export const getSantriActivityAnalytics = (santri, month = '2026-10') => {
  if (!santri) return null;

  const isHighAchiever = santri.poinDisiplin >= 90;
  const isModerate = santri.poinDisiplin >= 75 && santri.poinDisiplin < 90;
  const isNeedsGuidance = santri.poinDisiplin < 75;

  // Multiplier based on discipline
  const factor = isHighAchiever ? 1.0 : isModerate ? 0.88 : 0.65;

  // 1. Data Diagram Vertikal Mingguan untuk Bulan Terpilih
  const weeklyData = [
    {
      minggu: 'Minggu 1',
      periode: '1 - 7 ' + (month === '2026-10' ? 'Okt' : month === '2026-09' ? 'Sep' : 'Agu'),
      mesjid: Math.round(33 * factor),
      mesjidTarget: 35,
      tahfidz: Math.round(6 * factor),
      tahfidzTarget: 6,
      belanja: Math.round(8 * (isNeedsGuidance ? 1.4 : 1.0)),
      totalBelanjaRp: Math.round((isNeedsGuidance ? 85000 : 54000) * (month === '2026-10' ? 1.0 : 0.95))
    },
    {
      minggu: 'Minggu 2',
      periode: '8 - 14 ' + (month === '2026-10' ? 'Okt' : month === '2026-09' ? 'Sep' : 'Agu'),
      mesjid: Math.round(34 * factor),
      mesjidTarget: 35,
      tahfidz: Math.round(7 * factor),
      tahfidzTarget: 6,
      belanja: Math.round(7 * (isNeedsGuidance ? 1.3 : 1.0)),
      totalBelanjaRp: Math.round((isNeedsGuidance ? 92000 : 62000) * (month === '2026-10' ? 1.0 : 0.9))
    },
    {
      minggu: 'Minggu 3',
      periode: '15 - 21 ' + (month === '2026-10' ? 'Okt' : month === '2026-09' ? 'Sep' : 'Agu'),
      mesjid: Math.round(32 * factor),
      mesjidTarget: 35,
      tahfidz: Math.round(6 * factor),
      tahfidzTarget: 6,
      belanja: Math.round(9 * (isNeedsGuidance ? 1.5 : 1.0)),
      totalBelanjaRp: Math.round((isNeedsGuidance ? 98000 : 58000) * (month === '2026-10' ? 0.9 : 1.0))
    },
    {
      minggu: 'Minggu 4',
      periode: '22 - 28 ' + (month === '2026-10' ? 'Okt' : month === '2026-09' ? 'Sep' : 'Agu'),
      mesjid: Math.round(35 * factor),
      mesjidTarget: 35,
      tahfidz: Math.round(7 * factor),
      tahfidzTarget: 6,
      belanja: Math.round(6 * (isNeedsGuidance ? 1.2 : 1.0)),
      totalBelanjaRp: Math.round((isNeedsGuidance ? 78000 : 51000) * (month === '2026-10' ? 0.85 : 0.95))
    }
  ];

  // 2. Data Tren Komparasi Vertikal 4 Bulan Terakhir
  const monthlyTrendData = [
    {
      bulan: 'Juli',
      mesjid: Math.round(130 * factor),
      tahfidz: Math.round(24 * factor),
      belanjaTrx: isNeedsGuidance ? 38 : 28,
      skorKarakter: Math.min(100, Math.round(santri.poinDisiplin * 0.94))
    },
    {
      bulan: 'Agustus',
      mesjid: Math.round(135 * factor),
      tahfidz: Math.round(26 * factor),
      belanjaTrx: isNeedsGuidance ? 42 : 30,
      skorKarakter: Math.min(100, Math.round(santri.poinDisiplin * 0.97))
    },
    {
      bulan: 'September',
      mesjid: Math.round(138 * factor),
      tahfidz: Math.round(27 * factor),
      belanjaTrx: isNeedsGuidance ? 36 : 29,
      skorKarakter: Math.min(100, Math.round(santri.poinDisiplin * 0.99))
    },
    {
      bulan: 'Oktober (Aktif)',
      mesjid: Math.round(142 * factor),
      tahfidz: Math.round(28 * factor),
      belanjaTrx: isNeedsGuidance ? 34 : 26,
      skorKarakter: santri.poinDisiplin
    }
  ];

  // 3. Distribusi Shalat 5 Waktu di Masjid Jami' (Diagram Vertikal Shalat)
  const prayerBreakdown = [
    { waktu: 'Subuh', hadir: Math.round(30 * factor), total: 30, pct: Math.round(factor * 100) },
    { waktu: 'Dzuhur', hadir: Math.round(29 * factor), total: 30, pct: Math.round(factor * 96) },
    { waktu: 'Ashar', hadir: Math.round(29 * factor), total: 30, pct: Math.round(factor * 96) },
    { waktu: 'Maghrib', hadir: Math.round(30 * factor), total: 30, pct: Math.round(factor * 100) },
    { waktu: 'Isya', hadir: Math.round(29 * factor), total: 30, pct: Math.round(factor * 97) }
  ];

  // Metrics totals for current selected month
  const totalMesjidTaps = weeklyData.reduce((acc, w) => acc + w.mesjid, 0);
  const totalTahfidzSessions = weeklyData.reduce((acc, w) => acc + w.tahfidz, 0);
  const totalBelanjaTrx = weeklyData.reduce((acc, w) => acc + w.belanja, 0);
  const totalBelanjaNominal = weeklyData.reduce((acc, w) => acc + w.totalBelanjaRp, 0);
  const avgBelanjaPerHari = Math.round(totalBelanjaNominal / 30);

  // 4. Detailed Chronological Activity Log (Masjid, Quran, Belanja, Gate)
  const activityLogs = [
    {
      id: `act-1-${santri.id}`,
      kategori: 'MESJID',
      label: 'Shalat Maghrib Berjamaah',
      detail: 'Tap RFID Gate Pintu Utama Masjid Jami’ Darul Ulum',
      waktu: 'Hari ini, 17:58 WIB',
      timestamp: '2026-10-14 17:58',
      status: 'TEPAT_WAKTU',
      statusLabel: 'Shaf Pertama',
      poin: '+2 Poin Adab',
      icon: 'mesjid',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    },
    {
      id: `act-2-${santri.id}`,
      kategori: 'KANTIN',
      label: 'Kantin Sehat - Smart POS Tap',
      detail: 'Makan Sore Sehat: Nasi Ayam Bakar Madu + Susu Kurma',
      waktu: 'Hari ini, 16:45 WIB',
      timestamp: '2026-10-14 16:45',
      status: 'TRANSAKSI_SUKSES',
      statusLabel: '-Rp 15.000',
      poin: 'Saldo Sisa: Rp ' + (santri.saldoRfid).toLocaleString('id-ID'),
      icon: 'belanja',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-300'
    },
    {
      id: `act-3-${santri.id}`,
      kategori: 'TAHFIDZ',
      label: `Setoran Ziyadah Juz ${santri.tahfidzJuz}`,
      detail: isNeedsGuidance
        ? 'Muroja’ah Surat Pendek & Tajwid Dasar bersama Ustadz Pendamping'
        : `Ziyadah Surah An-Nisa Ayat 1-14 (Kelancaran: Mutqin, Makhraj: Mumtaz)`,
      waktu: 'Hari ini, 15:40 WIB',
      timestamp: '2026-10-14 15:40',
      status: isNeedsGuidance ? 'MAQBUL' : 'MUMTAZ',
      statusLabel: isNeedsGuidance ? 'Perlu Murojaah' : 'Nilai A+ (Mumtaz)',
      poin: '+5 Poin Prestasi',
      icon: 'quran',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300'
    },
    {
      id: `act-4-${santri.id}`,
      kategori: 'MESJID',
      label: 'Shalat Ashar Berjamaah',
      detail: 'Presensi Otomatis Turnstile Mesjid Sektor Santri',
      waktu: 'Hari ini, 15:05 WIB',
      timestamp: '2026-10-14 15:05',
      status: 'TEPAT_WAKTU',
      statusLabel: 'Berjamaah',
      poin: '+2 Poin Adab',
      icon: 'mesjid',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    },
    {
      id: `act-5-${santri.id}`,
      kategori: 'MESJID',
      label: 'Shalat Dzuhur Berjamaah',
      detail: 'Presensi Otomatis Turnstile Mesjid Sektor Santri',
      waktu: 'Hari ini, 11:55 WIB',
      timestamp: '2026-10-14 11:55',
      status: 'TEPAT_WAKTU',
      statusLabel: 'Berjamaah',
      poin: '+2 Poin Adab',
      icon: 'mesjid',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    },
    {
      id: `act-6-${santri.id}`,
      kategori: 'KANTIN',
      label: 'Koperasi & Laundry Asrama',
      detail: 'Cuci Setrika Seragam Pramuka & Jubah Putih (RFID Weighing Log 2.0 Kg)',
      waktu: 'Kemarin, 16:30 WIB',
      timestamp: '2026-10-13 16:30',
      status: 'TRANSAKSI_SUKSES',
      statusLabel: '-Rp 12.000',
      poin: 'Status: Selesai Dicuci',
      icon: 'belanja',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-300'
    },
    {
      id: `act-7-${santri.id}`,
      kategori: 'MESJID',
      label: 'Shalat Subuh & Kuliah Fajar',
      detail: 'Tap RFID Gerbang Masjid + Kajian Kitab Ta’lim Muta’allim',
      waktu: 'Kemarin, 04:18 WIB',
      timestamp: '2026-10-13 04:18',
      status: 'TEPAT_WAKTU',
      statusLabel: 'Istiqomah',
      poin: '+3 Poin Adab',
      icon: 'mesjid',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    },
    {
      id: `act-8-${santri.id}`,
      kategori: 'GATE',
      label: santri.statusAsrama === 'TERLAMBAT' ? 'Smart Gate: Peringatan Terlambat' : 'Smart Gate: Tap Izin Pesiar Resmi',
      detail: santri.statusAsrama === 'TERLAMBAT'
        ? 'Peringatan Sistem: Belum tap gate kembali melewati batas waktu izin'
        : 'Verifikasi Tap Out Turnstile Gerbang Utama Asrama',
      waktu: '12 Okt 2026, 14:00 WIB',
      timestamp: '2026-10-12 14:00',
      status: santri.statusAsrama === 'TERLAMBAT' ? 'OVERDUE' : 'TERVERIFIKASI',
      statusLabel: santri.statusAsrama === 'TERLAMBAT' ? 'Overdue Gate' : 'Izin Sah Disetujui',
      poin: santri.statusAsrama === 'TERLAMBAT' ? '-10 Poin Gerbang' : 'Gate Aman',
      icon: 'gate',
      badgeColor: santri.statusAsrama === 'TERLAMBAT' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-purple-100 text-purple-800 border-purple-300'
    }
  ];

  // 5. Kesimpulan & Analisis AI (Smart Character AI Engine)
  const aiHarmonyScore = isHighAchiever ? 96 : isModerate ? 86 : 64;
  const aiCategory = isHighAchiever
    ? 'MUMTAZ (Teladan & Sangat Disiplin)'
    : isModerate
    ? 'JAYYID JIDDAN (Baik & Berkembang)'
    : 'TA’DIB (Perlu Pembinaan Khusus)';

  let aiNarrativeSummary = '';
  let aiPillars = {};
  let aiActionableRecommendations = [];

  if (isHighAchiever) {
    aiNarrativeSummary = `Alhamdulillah, ananda ${santri.nama} menunjukkan konsistensi karakter luar biasa bulan ${month === '2026-10' ? 'Oktober' : 'ini'}. Kehadiran shalat fardhu di Masjid Jami’ tercatat prima (95%+), ritme hafalan Al-Qur’an Juz ${santri.tahfidzJuz} berjalan mutqin dengan predikat MUMTAZ, dan penggunaan saldo RFID kantin sangat bijak (rata-rata Rp ${avgBelanjaPerHari.toLocaleString('id-ID')}/hari, jauh di bawah limit Rp ${santri.limitJajanHarian.toLocaleString('id-ID')}). Tidak ada catatan pelanggaran gerbang asrama.`;

    aiPillars = {
      spiritual: {
        score: 97,
        label: 'Sangat Istiqomah',
        summary: 'Shalat Subuh dan Maghrib 100% di masjid jami’. Disiplin hadir sebelum iqamah berkumandang.'
      },
      quran: {
        score: 95,
        label: 'Progresif Mutqin',
        summary: `Hafalan Juz ${santri.tahfidzJuz} berjalan lancar. Rutin muroja’ah halaqah maghrib bersama musyrif.`
      },
      finansial: {
        score: 94,
        label: 'Sangat Hemat & Terarah',
        summary: `Rata-rata belanja Rp ${avgBelanjaPerHari.toLocaleString('id-ID')}/hari. Dominan untuk makanan bernutrisi dan laundry seragam.`
      }
    };

    aiActionableRecommendations = [
      {
        title: 'Beri Apresiasi Saat Menjenguk/Telepon',
        desc: `Puji ananda atas capaian hafalan Juz ${santri.tahfidzJuz} dan ketertiban sholat masjid. Pengakuan orang tua memperkuat motivasi intrinsik santri.`
      },
      {
        title: 'Pertahankan Limit Belanja Harian',
        desc: `Limit saat ini (Rp ${santri.limitJajanHarian.toLocaleString('id-ID')}/hari) sudah sangat proporsional dan membentuk kebiasaan finansial yang bijaksana.`
      },
      {
        title: 'Perhatian Kesehatan Rutin',
        desc: santri.penyakitKhusus !== '-'
          ? `Perhatikan kondisi ${santri.penyakitKhusus} saat pergantian cuaca asrama, pastikan vitamin diminum teratur.`
          : 'Kondisi fisik ananda prima dan aktif mengikuti kegiatan asrama.'
      }
    ];
  } else if (isModerate) {
    aiNarrativeSummary = `Ananda ${santri.nama} memiliki perkembangan yang positif dan stabil di Pondok. Shalat berjamaah di masjid berjalan teratur dengan sedikit catatan masbuk pada shalat Subuh tertentu. Setoran tahfidz menunjukkan kemauan kuat mencapai Juz ${santri.tahfidzJuz}, dan pengelolaan uang saku berada dalam batas aman yang ditetapkan orang tua.`;

    aiPillars = {
      spiritual: {
        score: 87,
        label: 'Konsisten & Cukup Baik',
        summary: 'Kehadiran shalat fardhu di masjid mencapai 88%. Disarankan bangun lebih awal saat qiyamullail.'
      },
      quran: {
        score: 86,
        label: 'Terus Bertambah',
        summary: `Target Juz ${santri.tahfidzJuz} sedang dalam tahap pemantapan kelancaran ayat-ayat panjang.`
      },
      finansial: {
        score: 85,
        label: 'Terkendali Baik',
        summary: `Pengeluaran rata-rata Rp ${avgBelanjaPerHari.toLocaleString('id-ID')}/hari. Masih dalam batas aman limit harian.`
      }
    };

    aiActionableRecommendations = [
      {
        title: 'Motivasi Bangun Subuh Lebih Awal',
        desc: 'Ingatkan ananda untuk tidak tidur larut malam agar sholat Subuh di masjid bisa shaf awal tanpa tergesa-gesa.'
      },
      {
        title: 'Dukungan Muroja’ah Al-Qur’an',
        desc: 'Tanyakan surah apa yang sedang dihafal saat ananda menelepon, agar ananda merasa proses hafalannya selalu didampingi keluarga.'
      },
      {
        title: 'Edukasi Manajemen Waktu',
        desc: 'Apresiasi kedisiplinan ananda dan dorong untuk aktif memanfaatkan perpustakaan pondok di akhir pekan.'
      }
    ];
  } else {
    // Needs Guidance (e.g. Fajar Ramadhan)
    aiNarrativeSummary = `Perhatian Orang Tua Diperlukan: Ananda ${santri.nama} memerlukan pendampingan bersama antara asrama dan wali santri. Terpantau beberapa kali masbuk shalat Subuh di asrama, ritme setoran Al-Qur’an mengalami jeda, dan terdapat riwayat keterlambatan tap gerbang asrama. Belanja kantin mendekati batas maksimum limit harian.`;

    aiPillars = {
      spiritual: {
        score: 62,
        label: 'Perlu Pendampingan',
        summary: 'Kehadiran masjid 65%. Sering terlambat bangun subuh dan perlu pembinaan khusus dari Musyrif.'
      },
      quran: {
        score: 60,
        label: 'Butuh Motivasi Tambahan',
        summary: 'Setoran ziyadah tersendat pada Juz 2. Perlu bimbingan privat tahsin dan muroja’ah harian.'
      },
      finansial: {
        score: 70,
        label: 'Perlu Pengawasan Jajan',
        summary: `Belanja harian tinggi (Rp ${avgBelanjaPerHari.toLocaleString('id-ID')}/hari) dan didominasi makanan ringan/jajan luar.`
      }
    };

    aiActionableRecommendations = [
      {
        title: 'Komunikasi Santun & Penuh Kasih Sayang',
        desc: 'Hubungi ananda di akhir pekan dengan pendekatan kasih sayang. Dengarkan apakah ada kendala teman sebaya atau beban pelajaran di asrama.'
      },
      {
        title: 'Pertimbangkan Penyesuaian Batas Jajan',
        desc: `Batas jajan dapat diturunkan sementara ke Rp 20.000/hari agar ananda fokus pada makanan sehat asrama dan membatasi jajan berlebih.`
      },
      {
        title: 'Konsultasi Bersama Musyrif Kamar',
        desc: 'Lakukan panggilan koordinasi dengan Musyrif kamar santri untuk memonitor bangun pagi dan jadwal belajar malam ananda.'
      }
    ];
  }

  return {
    month,
    santri,
    weeklyData,
    monthlyTrendData,
    prayerBreakdown,
    totals: {
      mesjidTaps: totalMesjidTaps,
      mesjidPct: Math.round((totalMesjidTaps / (weeklyData.length * 35)) * 100),
      tahfidzSessions: totalTahfidzSessions,
      belanjaTrx: totalBelanjaTrx,
      belanjaNominal: totalBelanjaNominal,
      avgBelanjaPerHari: avgBelanjaPerHari
    },
    activityLogs,
    aiAnalysis: {
      harmonyScore: aiHarmonyScore,
      category: aiCategory,
      narrativeSummary: aiNarrativeSummary,
      pillars: aiPillars,
      recommendations: aiActionableRecommendations,
      lastAnalyzed: 'Real-time AI Engine (Sinkronisasi IoT Gate, Mutaba’ah & POS Kantin)'
    }
  };
};
