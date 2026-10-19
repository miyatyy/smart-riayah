// DeepSeek AI Integration Service
// Smart Riayah - AI Agent & Character Evaluation Engine for All Roles & Wali Santri
// Official Endpoint: https://api.deepseek.com/chat/completions

export const DEFAULT_DEEPSEEK_TOKEN = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
export const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
export const DEFAULT_MODEL = 'deepseek-chat';
export const REASONER_MODEL = 'deepseek-reasoner';

export const ROLE_PERSPECTIVES = {
  parent: {
    title: 'Wali Santri',
    subtitle: 'Evaluasi Karakter, Kesejahteraan & Nasihat Sayang',
    focus: 'Pendampingan orang tua, shalat masjid, tahfidz Al-Qur\'an, batasan jajan kantin, dan saran percakapan menenangkan saat menelepon.'
  },
  musyrif: {
    title: 'Musyrif Asrama',
    subtitle: 'Kedisiplinan Shalat Subuh, Pembinaan Kamar & Izin Pesiar',
    focus: 'Kedisiplinan shalat fardhu di masjid terutama Subuh, keterlambatan bangun, kepatuhan kamar, pertimbangan kelayakan izin pesiar/pulang, dan bimbingan ta\'dib.'
  },
  admin_riayah: {
    title: 'Admin Ri\'ayah',
    subtitle: 'Audit Kepatuhan Sistem, Tata Tertib & RFID POS',
    focus: 'Kepatuhan aturan pondok, konsistensi tap turnstile gerbang & kantin, kontrol limit transaksi RFID, status administrasi santri.'
  },
  poskestren: {
    title: 'Petugas Poskestren (Klinik)',
    subtitle: 'Korelasi Pola Aktivitas, Pola Makan & Rekam Medis',
    focus: 'Hubungan antara kelelahan fisik, kehadiran shalat subuh, pola konsumsi kantin dengan riwayat keluhan medis (maag, flu, demam), dan saran istirahat.'
  },
  security: {
    title: 'Komandan Keamanan & Gerbang',
    subtitle: 'Pola Waktu Keluar Masuk, Jam Malam & Anti-Bypass',
    focus: 'Pola waktu tap gerbang keluar/masuk, risiko overstay/terlambat izin, kepatuhan jam malam, dan instruksi kewaspadaan pos satpam.'
  },
  kyai: {
    title: 'Pimpinan Pesantren (Mudir / Kyai)',
    subtitle: 'Executive Decision Support & Indeks Karakter Holistik',
    focus: 'Penilaian holistik adab santri (Mumtaz/Jayyid/Ta\'dib), akselerasi tahfidz Al-Qur\'an, kemandirian finansial, dan proyeksi kaderisasi santri teladan.'
  },
  superadmin: {
    title: 'Super Admin Developer',
    subtitle: 'Diagnostik AI, Audit Engine & Token Analytics',
    focus: 'Analisis menyeluruh sistem cerdas, metrik latensi, validasi model DeepSeek, dan sintesis data santri secara agregat.'
  }
};

/**
 * Test DeepSeek API connectivity and token validity
 */
export async function testDeepSeekConnection(token = DEFAULT_DEEPSEEK_TOKEN, model = DEFAULT_MODEL) {
  const startTime = Date.now();
  const activeToken = (token || DEFAULT_DEEPSEEK_TOKEN).trim();

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'You are a test ping agent. Reply with OK.' },
          { role: 'user', content: 'Ping' }
        ],
        max_tokens: 5,
        temperature: 0.1
      })
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        status: response.status,
        error: `DeepSeek API HTTP ${response.status}: ${errorBody}`,
        latencyMs
      };
    }

    const data = await response.json();
    return {
      success: true,
      model: data.model || model || DEFAULT_MODEL,
      latencyMs,
      message: 'Koneksi ke DeepSeek AI Berhasil & Token Aktif!'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Gagal menghubungi server DeepSeek API.',
      latencyMs: Date.now() - startTime
    };
  }
}

/**
 * Generate intelligent santri activity & character evaluation using DeepSeek AI
 * Supports role perspectives: 'parent' | 'musyrif' | 'admin_riayah' | 'poskestren' | 'security' | 'kyai' | 'superadmin'
 */
export async function generateDeepSeekSantriAnalysis({
  santri,
  month = '2026-10',
  totals,
  prayerBreakdown,
  weeklyData,
  role = 'parent',
  medicalNotes = '',
  permitsNotes = '',
  token = DEFAULT_DEEPSEEK_TOKEN,
  model = DEFAULT_MODEL
}) {
  const activeToken = (token || DEFAULT_DEEPSEEK_TOKEN).trim();
  const startTime = Date.now();
  const perspective = ROLE_PERSPECTIVES[role] || ROLE_PERSPECTIVES.parent;

  const systemPrompt = `Anda adalah "Smart Riayah AI Agent" - agen kecerdasan buatan terpadu untuk Pesantren Modern Darul Ulum, didukung oleh DeepSeek AI.
Anda bertugas menganalisis data rekam jejak diagram aktivitas harian santri (kehadiran shalat 5 waktu di Masjid Jami' via RFID tap turnstile, capaian setoran tahfidz Al-Qur'an, dan transaksi Smart POS kantin/laundry vs limit uang saku orang tua).

PERSPEKTIF EVALUASI ANDA SAAT INI ADALAH UNTUK ROLE: "${perspective.title.toUpperCase()}" (${perspective.subtitle}).
Fokus analisis khusus role ini: ${perspective.focus}

PENTING: Output Anda HARUS berupa format JSON murni TANPA markdown formatting di luar blok JSON.
Struktur JSON yang WAJIB dipatuhi:
{
  "harmonyScore": <integer antara 40 sampai 99>,
  "category": "<String, misal: 'MUMTAZ (Teladan & Sangat Disiplin)' atau 'JAYYID JIDDAN (Baik & Berkembang)' atau 'TA'DIB (Perlu Pembinaan Khusus)'>",
  "narrativeSummary": "<String 2-3 kalimat komprehensif, disesuaikan dengan bahasa dan kepentingan role ${perspective.title}>",
  "pillars": {
    "spiritual": {
      "score": <integer 0-100>,
      "label": "<String pendek, misal: 'Sangat Istiqomah'>",
      "summary": "<String 1-2 kalimat analisis kehadiran sholat fardhu di masjid & subuh>"
    },
    "quran": {
      "score": <integer 0-100>,
      "label": "<String pendek, misal: 'Progresif Mutqin'>",
      "summary": "<String 1-2 kalimat analisis progres juz dan kelancaran halaqah>"
    },
    "finansial": {
      "score": <integer 0-100>,
      "label": "<String pendek, misal: 'Sangat Hemat & Terarah'>",
      "summary": "<String 1-2 kalimat analisis belanja kantin terhadap limit harian ortu>"
    }
  },
  "roleSpecificInsight": {
    "badge": "<String label pendek untuk role ini, misal: 'Rekomendasi Musyrif' atau 'Saran Wali Santri' atau 'Indeks Medis'>",
    "highlight": "<String 1-2 kalimat temuan kunci paling esensial untuk role ${perspective.title}>",
    "actionVerdict": "<String status aksi, misal: 'IZIN LAYAK DIBERIKAN' / 'PERLU PENDAMPINGAN SUBUH' / 'APRESIASI TELADAN' / 'MONITOR POLA KANTIN'>"
  },
  "recommendations": [
    {
      "title": "<Judul rekomendasi 1 spesifik untuk role ${perspective.title}>",
      "desc": "<Deskripsi saran praktis langkah nyata yang harus dilakukan>"
    },
    {
      "title": "<Judul rekomendasi 2 spesifik untuk role ${perspective.title}>",
      "desc": "<Deskripsi saran praktis>"
    },
    {
      "title": "<Judul rekomendasi 3 spesifik untuk role ${perspective.title}>",
      "desc": "<Deskripsi saran praktis>"
    }
  ]
}`;

  const weeklySummary = Array.isArray(weeklyData)
    ? weeklyData.map(w => `${w.minggu} (${w.periode}): Masjid ${w.mesjid}/${w.mesjidTarget} waktu, Tahfidz ${w.tahfidz}/${w.tahfidzTarget} sesi, Belanja ${w.belanja}x (Rp ${w.totalBelanjaRp.toLocaleString('id-ID')})`).join(' | ')
    : 'Data mingguan standar';

  const userPrompt = `Lakukan evaluasi cerdas otomatis terhadap diagram daily activity santri berikut untuk periode ${month}:
PROFIL SANTRI:
- Nama: ${santri.nama} (NIS: ${santri.nis}, Kelas: ${santri.kelas}, Kamar: ${santri.kamar})
- Poin Induk Ri'ayah (Disiplin): ${santri.poinDisiplin} / 100
- Status Keberadaan: ${santri.statusAsrama}
- Saldo Kartu RFID: Rp ${santri.saldoRfid.toLocaleString('id-ID')}
- Limit Jajan Harian dari Orang Tua: Rp ${santri.limitJajanHarian.toLocaleString('id-ID')}/hari
- Catatan Riwayat Kesehatan / Penyakit Khusus: ${santri.penyakitKhusus || '-'} ${medicalNotes ? `| Keluhan Terakhir: ${medicalNotes}` : ''}
${permitsNotes ? `- Status Izin Terkini: ${permitsNotes}` : ''}

REKAP HASIL DIAGRAM DAILY ACTIVITY:
- Kehadiran Shalat di Masjid Jami': ${totals?.mesjidTaps || 140} kali (${totals?.mesjidPct || 95}%)
- Distribusi Sholat 5 Waktu di Masjid: Subuh: ${prayerBreakdown?.[0]?.hadir || 30}/30, Dzuhur: ${prayerBreakdown?.[1]?.hadir || 29}/30, Ashar: ${prayerBreakdown?.[2]?.hadir || 29}/30, Maghrib: ${prayerBreakdown?.[3]?.hadir || 30}/30, Isya: ${prayerBreakdown?.[4]?.hadir || 29}/30
- Capaian Tahfidz Al-Qur'an: Juz ${santri.tahfidzJuz} (Total ${totals?.tahfidzSessions || 28} sesi muroja'ah/ziyadah)
- Belanja Kantin Smart POS: Total Rp ${(totals?.belanjaNominal || 280000).toLocaleString('id-ID')} (${totals?.belanjaTrx || 28} transaksi, rata-rata Rp ${(totals?.avgBelanjaPerHari || 9500).toLocaleString('id-ID')}/hari)
- Rincian Tren Mingguan: ${weeklySummary}

Buatkan evaluasi mendalam, skor harmoni karakter, analisis 3 pilar, dan 3 rekomendasi actionable yang relevan untuk role "${perspective.title}" dalam format JSON yang ditentukan.`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.warn('DeepSeek API Error Response:', response.status, errText);
      return {
        success: false,
        error: `DeepSeek API Error (HTTP ${response.status})`,
        latencyMs
      };
    }

    const jsonRes = await response.json();
    const rawContent = jsonRes.choices?.[0]?.message?.content || '';

    const cleanJsonStr = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsedData = JSON.parse(cleanJsonStr);

    return {
      success: true,
      source: 'DEEPSEEK_LIVE',
      model: jsonRes.model || model,
      latencyMs,
      data: parsedData,
      tokensUsed: jsonRes.usage
    };
  } catch (err) {
    console.error('DeepSeek generation failed:', err);
    return {
      success: false,
      error: err.message || 'Gagal memproses data via DeepSeek AI.',
      latencyMs: Date.now() - startTime
    };
  }
}

/**
 * Interactive Conversational AI Agent for Smart Riayah
 * Allows any role to chat directly with DeepSeek about santri daily activities, charts, and recommendations
 */
export async function chatWithDeepSeekAgent({
  messages,
  santri,
  role = 'parent',
  token = DEFAULT_DEEPSEEK_TOKEN,
  model = DEFAULT_MODEL
}) {
  const activeToken = (token || DEFAULT_DEEPSEEK_TOKEN).trim();
  const startTime = Date.now();
  const perspective = ROLE_PERSPECTIVES[role] || ROLE_PERSPECTIVES.parent;

  const systemContext = `Anda adalah "Smart Riayah AI Agent" yang ramah, bijaksana, dan tanggap, didukung oleh DeepSeek AI.
Anda melayani pengguna dengan role: "${perspective.title}" (${perspective.subtitle}).
Pesantren: Pesantren Modern Darul Ulum.

DATA SANTRI YANG SEDANG DIBAHAS:
- Nama: ${santri?.nama || 'Ahmad Fauzi'} (NIS: ${santri?.nis || '125456'}, Kelas: ${santri?.kelas || '3-Aliyah (KMI)'}, Kamar: ${santri?.kamar || 'Umar bin Khattab 204'})
- Poin Induk Kedisiplinan: ${santri?.poinDisiplin || 96}/100
- Status Keberadaan: ${santri?.statusAsrama || 'DI_ASRAMA'}
- Saldo Kartu RFID: Rp ${(santri?.saldoRfid || 75000).toLocaleString('id-ID')} (Limit Jajan Harian: Rp ${(santri?.limitJajanHarian || 30000).toLocaleString('id-ID')}/hari)
- Hafalan Al-Qur'an: Juz ${santri?.tahfidzJuz || 12}
- Riwayat Kesehatan Khusus: ${santri?.penyakitKhusus || '-'}
- Wali Santri: ${santri?.wali?.nama || 'Ibu Fatimah'} (${santri?.wali?.telepon || '08813576012'})

INSTRUKSI INTERAKSI:
1. Jawab pertanyaan pengguna dengan sopan, cerdas, solutif, bernuansa nilai kepesantrenan santun.
2. Hubungkan jawaban dengan diagram daily activity santri (kehadiran sholat 5 waktu di masjid, setoran quran, jajan kantin, dan kepatuhan gerbang asrama).
3. Buat jawaban padat, jelas, dan actionable dengan formatting markdown yang rapi (gunakan bold, bullet points, atau tips praktis).
4. Jika ditanya draf pesan WhatsApp untuk wali santri atau santri, sertakan salam islami hangat yang siap salin kirim.`;

  try {
    const formattedMessages = [
      { role: 'system', content: systemContext },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: formattedMessages,
        temperature: 0.5,
        max_tokens: 800
      })
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `DeepSeek API Error (HTTP ${response.status}): ${errText}`,
        latencyMs
      };
    }

    const jsonRes = await response.json();
    const reply = jsonRes.choices?.[0]?.message?.content || '';

    return {
      success: true,
      reply,
      model: jsonRes.model || model,
      latencyMs,
      tokensUsed: jsonRes.usage
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Gagal berkomunikasi dengan AI Agent.',
      latencyMs: Date.now() - startTime
    };
  }
}
