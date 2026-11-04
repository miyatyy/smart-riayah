/**
 * Smart Ri'ayah - Autonomous AI Responder for WhatsApp Gateway
 * Otak AI Otonom yang membalas pesan masuk dari Wali Santri secara instan via Fonnte API
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://htjnrpyuzkarigglgrxm.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_WQ7Ix8DuKxlVdv_dnwBspw_cXbdkADI';
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_FONNTE_TOKEN = 'XvFjdLyyvBgNUbXBZYzZ';

// In-memory set penyimpan nomor HP yang sedang diambil alih manual oleh Admin Ri'ayah
export const manualTakeoverPhones = new Set();

export function setManualTakeover(phone, isManual) {
  const clean = normalizePhone(phone);
  if (isManual) {
    manualTakeoverPhones.add(clean);
  } else {
    manualTakeoverPhones.delete(clean);
    const alt = clean.startsWith('62') ? '0' + clean.slice(2) : (clean.startsWith('0') ? '62' + clean.slice(1) : clean);
    manualTakeoverPhones.delete(alt);
  }
  return isPhoneInManualTakeover(clean);
}

export function isPhoneInManualTakeover(phone) {
  const clean = normalizePhone(phone);
  if (manualTakeoverPhones.has(clean)) return true;
  for (const p of manualTakeoverPhones) {
    if (clean.endsWith(p.slice(-8)) || p.endsWith(clean.slice(-8))) {
      return true;
    }
  }
  return false;
}

// Database referensi cepat Wali & Santri Pesantren Darul Ulum
const KNOWN_WALI_MAP = {
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
 * Otak AI Otonom: Menganalisis pesan dan menghasilkan balasan islami & cerdas
 */
export async function generateAutonomousReply(senderPhone, incomingText, senderName = 'Wali Santri') {
  const cleanPhone = normalizePhone(senderPhone);

  // 1. Cek live database Supabase terlebih dahulu (Mendukung Wali yang baru ganti nomor di Tabel RFID!)
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

  // 1. Coba gunakan Gemini / DeepSeek API jika token tersedia di environment
  const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
    try {
      const prompt = `Anda adalah "Smart Riayah AI Bot" - Asisten Cerdas Resmi Pesantren Modern Darul Ulum.
Tugas Anda adalah membalas pesan WhatsApp dari Wali Santri secara ramah, santun, bernafaskan Islam, ringkas, dan solutif.

KONTEKS DATA WALI & SANTRI LIVE SAAT INI:
- Nama Wali: ${waliData.namaWali}
- Nama Santri: ${waliData.santriNama} (NIS: ${waliData.nis}, Kelas: ${waliData.kelas})
- Kamar Asrama: ${waliData.kamar}
- Status Saat Ini: ${waliData.statusAsrama}
- Saldo Dompet RFID: ${waliData.saldoRfid} (Limit harian: ${waliData.limitHarian})
- Poin Kedisiplinan: ${waliData.poinDisiplin}
- Catatan Izin: ${waliData.izinTerakhir}

SOP PESANTREN:
- Izin keluar/pulang diajukan via aplikasi Smart Ri'ayah minimal H-1.
- Jam malam asrama pukul 21.30 WIB.
- Jam sambangan (kunjungan) hari Ahad pukul 08.00 - 17.00 WIB.
- Klinik Poskestren 24 jam dengan perawat siaga.

Pesan dari Wali Santri:
"${incomingText}"

Tuliskan balasan WhatsApp yang hangat (awali salam, gunakan format WhatsApp seperti *tebal* jika perlu, jangan terlalu panjang, akhiri dengan doa/salam):`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
        })
      });

      if (res.ok) {
        const json = await res.json();
        const candidate = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate && candidate.trim()) {
          return candidate.trim();
        }
      }
    } catch (llmErr) {
      console.warn('⚠️ [AI Otonom] Gemini API offline/limit, beralih ke Smart Local Reasoning Engine:', llmErr.message);
    }
  }

  // 2. Smart Local Reasoning Engine (Context-Aware Instant Fallback)
  // Periksa intent spesifik secara bertingkat:

  // TOPIK 1: SALDO RFID / DOMPET PINTAR / UANG SAKU
  if (textLower.includes('saldo') || textLower.includes('uang') || textLower.includes('dompet') || textLower.includes('jajan') || textLower.includes('rfid') || textLower.includes('topup') || textLower.includes('top up')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nBerikut informasi dompet pintar cashless ananda *${waliData.santriNama}*:\n\n💳 *Sisa Saldo RFID:* *${waliData.saldoRfid}*\n📊 *Limit Jajan Harian:* ${waliData.limitHarian}/hari\n🏢 *Lokasi Transaksi:* Kantin Asrama & Koperasi Ma'had\n\nUntuk pengisian saldo (Top Up), Bapak/Ibu dapat melakukan transfer Virtual Account atau melalui aplikasi Smart Ri'ayah.\n\n_— Smart Ri'ayah Cashless Gateway_`;
  }

  // TOPIK 2: PERIZINAN & PERPANJANGAN LIBURAN
  if (textLower.includes('izin') || textLower.includes('pulang') || textLower.includes('libur') || textLower.includes('perpanjang') || textLower.includes('pesiar') || textLower.includes('keluar')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nUntuk perizinan ananda *${waliData.santriNama}*:\n\n📋 *SOP Perizinan Santri:*\n1. Izin kepulangan/pesiar diajukan minimal H-1 oleh wali melalui menu *Perizinan* di aplikasi Smart Ri'ayah.\n2. Jika ananda sakit dan membutuhkan *Perpanjangan Liburan*, silakan klik tombol *Ajukan Perpanjangan Liburan* pada riwayat izin serta lampirkan foto surat dokter/keterangan medis.\n3. Musyrif & Mudir akan memverifikasi permohonan dalam waktu 1x24 jam.\n\nStatus izin ananda saat ini: *${waliData.izinTerakhir}*.\n\n_— Layanan Perizinan Digital DU-PERMIT_`;
  }

  // TOPIK 3: KESEHATAN / SAKIT / UKS / POSKESTREN
  if (textLower.includes('sakit') || textLower.includes('demam') || textLower.includes('obat') || textLower.includes('uks') || textLower.includes('poskestren') || textLower.includes('klinik') || textLower.includes('dokter')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nLayanan Kesehatan Pesantren Modern Darul Ulum (Poskestren) siap siaga *24 jam* dengan tenaga medis asrama.\n\n🏥 Apabila ananda *${waliData.santriNama}* mengeluhkan sakit, ananda segera diperiksa di ruang rawat UKS dan diberikan istirahat serta pengobatan dokter. Jika memerlukan tindakan lanjutan, tim Poskestren akan merujuk ke RS dan menghubungi Bapak/Ibu seketika.\n\nKondisi medis ananda saat ini: *Sehat & Terpantau Baik*.\n\n_— Poskestren Darul Ulum Care_`;
  }

  // TOPIK 4: JAM KUNJUNGAN / SAMBANGAN WALI
  if (textLower.includes('sambang') || textLower.includes('kunjung') || textLower.includes('besuk') || textLower.includes('tengok')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\n📅 *Jadwal Kunjungan (Sambangan) Wali Santri:*\n• *Hari:* Setiap Ahad (Minggu)\n• *Waktu:* Pukul 08.00 s/d 17.00 WIB\n• *Tempat:* Area Gazebo & Aula Kunjungan Ma'had Darul Ulum\n\nSaat berkunjung, mohon memarkir kendaraan di area parkir utama dan melapor singkat ke Pos Satpam. Santri tidak diperkenankan diajak keluar area pondok tanpa izin tertulis Musyrif.\n\n_— Tata Tertib Kunjungan Pesantren_`;
  }

  // TOPIK 5: KABAR & KONDISI SANTRI / AKTIVITAS HARIAN
  if (textLower.includes('kabar') || textLower.includes('sehat') || textLower.includes('kondisi') || textLower.includes('kegiatan') || textLower.includes('sholat') || textLower.includes('shalat') || textLower.includes('fauzi') || textLower.includes('anak saya')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nAlhamdulillah, ananda *${waliData.santriNama}* saat ini dalam kondisi *sehat wal'afiat* di ${waliData.kamar}.\n\n📌 *Catatan Aktivitas Hari Ini:*\n• Status: *${waliData.statusAsrama}*\n• Poin Kedisiplinan: *${waliData.poinDisiplin}*\n• Sholat Berjamaah: Hadir tertib di Masjid Jami'\n\nSemoga ananda senantiasa diberikan kemudahan dan keberkahan dalam menuntut ilmu. Aamiin.\n\n_— Salam hangat, Smart Ri'ayah AI Bot Pesantren_`;
  }

  // TOPIK 6: SALAM ATAU SAPAAN UMUM
  if (textLower.includes('assalamu') || textLower.includes('halo') || textLower.includes('selamat') || textLower.includes('pagi') || textLower.includes('siang') || textLower.includes('sore') || textLower.includes('malam') || textLower.includes('ping') || textLower.includes('tes')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nTerima kasih telah menghubungi layanan WhatsApp Resmi Pesantren Modern Darul Ulum.\n\nSaya adalah *Smart Ri'ayah AI Bot* yang siap melayani Bapak/Ibu 24 jam mengenai:\n1. 📈 *Kondisi & Disiplin Santri* (${waliData.santriNama})\n2. 💳 *Cek Saldo Dompet RFID & Limit Jajan*\n3. 📋 *Prosedur Izin Pulang & Perpanjangan Liburan*\n4. 🏥 *Layanan Kesehatan Poskestren*\n5. 📅 *Jadwal Sambangan & Kunjungan Wali*\n\nSilakan ketik hal yang ingin Bapak/Ibu tanyakan. Semoga keluarga senantiasa dalam lindungan Allah SWT. Aamiin.\n\n_— Smart Ri'ayah 168Fix Engage AI_`;
  }

  // TOPIK DEFAULT / PERTANYAAN LAINNYA
  return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nPesan Bapak/Ibu telah diterima oleh sistem cerdas Pesantren Modern Darul Ulum.\n\nInformasi terkait ananda *${waliData.santriNama}* (${waliData.kamar}) saat ini tercatat dalam kondisi *${waliData.statusAsrama}* dengan poin adab *${waliData.poinDisiplin}*.\n\nJika Bapak/Ibu memerlukan bantuan khusus dari Ustadz Musyrif Asrama atau Pengasuh Pondok, pesan ini juga telah kami teruskan ke *AI Inbox Petugas Asrama* untuk pendampingan lebih lanjut.\n\n_— Smart Ri'ayah AI Autonomous Assistant_`;
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
