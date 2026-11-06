/**
 * Smart Ri'ayah - Real-Time Pondok Clock & Calendar Engine
 * Utility Waktu Terpusat untuk Deteksi Hari, Jam, Tanggal Real-Time & Resolusi Kalender DeepSeek AI
 */

const NAMA_HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Mengambil waktu sistem pondok saat ini secara presisi (WITA / Jam Lokal)
 */
export function getRealtimePondokClock(dateObj = new Date()) {
  const d = dateObj instanceof Date && !isNaN(dateObj) ? dateObj : new Date();
  
  const dayIndex = d.getDay();
  const namaHari = NAMA_HARI_ID[dayIndex];
  
  // Format Tanggal
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const tanggalYmd = `${yyyy}-${mm}-${dd}`;

  const tanggalLengkap = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Format Jam
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const jamMenitDetik = `${hh}:${min}:${ss}`;
  const jamMenit = `${hh}:${min}`;

  // Hari Kerja (Senin–Kamis): dayIndex 1, 2, 3, 4
  // Weekend / Akhir Pekan (Jumat–Minggu): dayIndex 0, 5, 6
  const isWeekday = dayIndex >= 1 && dayIndex <= 4;
  const isWeekendNow = dayIndex === 0 || dayIndex === 5 || dayIndex === 6;

  return {
    timestamp_iso: d.toISOString(),
    timestamp_ms: d.getTime(),
    tanggal_lengkap: tanggalLengkap,
    tanggal_ymd: tanggalYmd,
    nama_hari: namaHari,
    jam_menit_detik: jamMenitDetik,
    jam_menit: jamMenit,
    day_index: dayIndex,
    is_weekday: isWeekday,
    is_weekend_now: isWeekendNow,
    mode_hari_ini: isWeekday ? 'WEEKDAY_APPROVAL' : 'WEEKEND_AUTO_APPROVE',
    deskripsi_mode: isWeekday
      ? "HARI KERJA (SENIN–KAMIS) — Booking WA Wajib Approval Admin Ri'ayah & Wajib Scan Barcode WA"
      : "AKHIR PEKAN (JUMAT–MINGGU) — Auto-Approval Booking WA Aktif"
  };
}

/**
 * Menghasilkan referensi kalender 7 hari ke depan dari tanggal sekarang
 * Digunakan untuk injeksi System Prompt ke DeepSeek AI agar tanggal relatif (besok, lusa, dll) tepat 100%
 */
export function getNext7DaysReference(baseDate = new Date()) {
  const list = [];
  const base = new Date(baseDate);

  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);

    const dayIndex = d.getDay();
    const namaHari = NAMA_HARI_ID[dayIndex];
    const ymd = d.toISOString().slice(0, 10);
    const isWeekday = dayIndex >= 1 && dayIndex <= 4;

    list.push({
      offset_days: i,
      label_relatif: i === 0 ? 'Hari ini / Sekarang' : (i === 1 ? 'Besok' : (i === 2 ? 'Lusa' : `${namaHari} depan`)),
      nama_hari: namaHari,
      tanggal_ymd: ymd,
      tanggal_lengkap: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      is_weekday: isWeekday,
      aturan: isWeekday ? 'MANUAL_WEEKDAY (Menunggu Approval Admin Ri\'ayah)' : 'AUTO_WEEKEND (Disetujui Otomatis + Barcode Langsung)'
    });
  }

  return list;
}

/**
 * Format string referensi 7 hari untuk System Prompt DeepSeek
 */
export function formatCalendarPromptForDeepSeek(clock = getRealtimePondokClock()) {
  const ref7Days = getNext7DaysReference(new Date(clock.timestamp_iso));
  
  const calendarLines = ref7Days.map(item => 
    `- [${item.label_relatif}] -> Hari: ${item.nama_hari}, Tanggal: ${item.tanggal_ymd} (${item.aturan})`
  ).join('\n');

  return `WAKTU SISTEM PONDOK REAL-TIME SAAT INI:
- Hari & Tanggal: ${clock.nama_hari}, ${clock.tanggal_lengkap} (Format YMD: ${clock.tanggal_ymd})
- Jam Sistem: ${clock.jam_menit_detik} WIB/WITA
- Status Hari Ini: ${clock.deskripsi_mode}

REFERENSI KALENDER 7 HARI KE DEPAN:
${calendarLines}

PANDUAN RESOLUSI WAKTU RELATIF OLEH AI:
1. Jika wali menulis "sekarang", "hari ini", "siang ini", "malam ini", otomatis gunakan: hari_kunjungan = "${clock.nama_hari}", tanggal_kunjungan = "${clock.tanggal_ymd}".
2. Jika wali menulis "besok", "lusa", atau menyebut nama hari (misal "Sabtu", "Senin depan"), cocokkan secara persis dengan daftar referensi kalender di atas.
3. Jika jam_selesai tidak disebutkan, otomatis set jam_selesai = jam_kunjungan + 60 hingga 90 menit (contoh: jika jam 14:00, set jam_selesai "15:30").
4. Cek apakah tanggal_kunjungan jatuh pada hari Senin–Kamis (is_weekday: true) atau Jumat–Minggu (is_weekday: false).`;
}

/**
 * Menghitung hitung mundur (Live Countdown) sisa waktu berkunjung
 */
export function calculateVisitCountdown(jamSelesaiStr, tanggalYmdStr) {
  if (!jamSelesaiStr) return null;

  try {
    const now = new Date();
    const [h, m] = jamSelesaiStr.split(':').map(val => parseInt(val, 10));
    
    // Default hari ini jika tanggalYmdStr kosong
    let target = new Date();
    if (tanggalYmdStr) {
      const [tY, tM, tD] = tanggalYmdStr.split('-').map(Number);
      target = new Date(tY, tM - 1, tD);
    }
    target.setHours(h || 0, m || 0, 0, 0);

    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) {
      const overstayMinutes = Math.floor(Math.abs(diffMs) / 60000);
      return {
        isOverstay: true,
        remainingText: `Lewat ${overstayMinutes} mnt`,
        totalSeconds: 0,
        diffMs
      };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let text = '';
    if (hours > 0) text += `${hours}j `;
    text += `${minutes}m ${seconds}d`;

    return {
      isOverstay: false,
      remainingText: text,
      totalSeconds,
      diffMs
    };
  } catch (err) {
    return null;
  }
}

/**
 * Validasi apakah jam kunjungan sesuai dengan jadwal operasional pondok
 * - Weekend (Jumat, Sabtu, Minggu): Sesi Pagi (08.30–11.30 WITA) & Sesi Sore (13.30–16.30 WITA)
 * - Weekday (Senin–Kamis): Sesi Sore (14.00–16.30 WITA)
 */
export function checkVisitingHoursValidity(hariName, jamKunjunganStr) {
  const isWeekend = ['Jumat', 'Sabtu', 'Minggu'].includes(hariName);
  if (!jamKunjunganStr) {
    return { isValid: true, sesi: isWeekend ? 'Sesi Bebas Weekend' : 'Sesi Sore Weekday' };
  }

  const [h, m] = jamKunjunganStr.split(':').map(v => parseInt(v, 10) || 0);
  const timeMinutes = h * 60 + m;

  if (isWeekend) {
    // Sesi Pagi: 08:30 (510 min) - 11:30 (690 min)
    // Sesi Sore: 13:30 (810 min) - 16:30 (990 min)
    const inSesi1 = timeMinutes >= 510 && timeMinutes <= 690;
    const inSesi2 = timeMinutes >= 810 && timeMinutes <= 990;
    if (inSesi1 || inSesi2) {
      return { 
        isValid: true, 
        sesi: inSesi1 ? 'Sesi Pagi (08.30–11.30 WITA)' : 'Sesi Sore (13.30–16.30 WITA)' 
      };
    }
    return {
      isValid: false,
      reason: 'Waktu kunjungan di luar jam operasional akhir pekan (Weekend). Jadwal resmi kunjungan: Sesi Pagi (08.30–11.30 WITA) & Sesi Sore (13.30–16.30 WITA).'
    };
  } else {
    // Weekday: Sesi Sore 14:00 (840 min) - 16:30 (990 min)
    const inWeekdaySesi = timeMinutes >= 840 && timeMinutes <= 990;
    if (inWeekdaySesi) {
      return { 
        isValid: true, 
        sesi: 'Sesi Sore (14.00–16.30 WITA - Ba\'da KBM)' 
      };
    }
    return {
      isValid: false,
      reason: 'Waktu kunjungan di luar jam operasional hari kerja (Senin–Kamis). Santri sedang mengikuti Kegiatan Belajar Mengajar (KBM). Jadwal kunjungan hari kerja yang diizinkan: Sesi Sore pukul 14.00–16.30 WITA.'
    };
  }
}

