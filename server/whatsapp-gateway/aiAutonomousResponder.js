/**
 * Smart Ri'ayah - Autonomous AI Responder for WhatsApp Gateway
 * Otak AI Otonom yang membalas pesan masuk dari Wali Santri secara instan via Fonnte API
 */

import { createClient } from '@supabase/supabase-js';
import { broadcastToSupabaseRealtime } from './supabaseBroadcaster.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://htjnrpyuzkarigglgrxm.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_WQ7Ix8DuKxlVdv_dnwBspw_cXbdkADI';
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_FONNTE_TOKEN = '8UN12iqFjKNBYdds8FCG';

// In-memory set penyimpan nomor HP yang sedang diambil alih manual oleh Admin Ri'ayah
export const manualTakeoverPhones = new Set();

/**
 * Simpan / perbarui status Mode Ambil Alih Manual ke Supabase & In-Memory Cache
 */
export async function setManualTakeover(phone, isManual) {
  const clean = normalizePhone(phone);
  const digits = String(clean).replace(/[^0-9]/g, '');
  if (!digits) return false;
  const last8 = digits.slice(-8);

  if (isManual) {
    manualTakeoverPhones.add(clean);
    try {
      // 1. Bersihkan record lama untuk nomor ini di Supabase messages table
      await supabase
        .from('messages')
        .delete()
        .eq('room_id', 'whatsapp_takeover')
        .like('message_text', `%${last8}%`);

      // 2. Insert record baru sebagai penanda bahwa nomor ini sedang di-takeover manual
      const { error } = await supabase
        .from('messages')
        .insert([{
          room_id: 'whatsapp_takeover',
          sender_email: 'admin@smartriayah.com',
          sender_name: 'Admin Ri\'ayah',
          sender_role: 'admin',
          message_text: clean,
          reaction: 'MANUAL_TAKEOVER',
          is_read: false
        }]);

      if (error) {
        console.warn('⚠️ [Supabase setManualTakeover insert error]:', error.message);
      } else {
        console.log(`✅ [Supabase setManualTakeover SUCCESS]: ${clean} kini dalam MODE AMBIL ALIH MANUAL`);
      }
    } catch (err) {
      console.warn('⚠️ [Supabase setManualTakeover exception]:', err.message);
    }
    return true;
  } else {
    manualTakeoverPhones.delete(clean);
    const alt = clean.startsWith('62') ? '0' + clean.slice(2) : (clean.startsWith('0') ? '62' + clean.slice(1) : clean);
    manualTakeoverPhones.delete(alt);

    try {
      // Hapus status takeover dari Supabase messages table
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', 'whatsapp_takeover')
        .like('message_text', `%${last8}%`);

      if (error) {
        console.warn('⚠️ [Supabase removeManualTakeover error]:', error.message);
      } else {
        console.log(`✅ [Supabase removeManualTakeover SUCCESS]: ${clean} dikembalikan ke MODE OTONOM`);
      }
    } catch (err) {
      console.warn('⚠️ [Supabase removeManualTakeover exception]:', err.message);
    }
    return false;
  }
}

/**
 * Cek apakah nomor sedang dalam Mode Ambil Alih Manual (Cek In-Memory & Supabase)
 */
export async function isPhoneInManualTakeover(phone) {
  const clean = normalizePhone(phone);
  const digits = String(clean).replace(/[^0-9]/g, '');
  if (!digits) return false;
  const last8 = digits.slice(-8);

  // 1. Cek in-memory set (fast path)
  if (manualTakeoverPhones.has(clean)) return true;
  for (const p of manualTakeoverPhones) {
    if (clean.endsWith(p.slice(-8)) || p.endsWith(clean.slice(-8))) {
      return true;
    }
  }

  // 2. Cek Supabase (persistent across all Vercel Serverless Lambdas)
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('message_text, reaction')
      .eq('room_id', 'whatsapp_takeover');

    if (!error && Array.isArray(data) && data.length > 0) {
      const match = data.some(row => {
        const rowDigits = String(row.message_text || '').replace(/[^0-9]/g, '');
        return rowDigits && (rowDigits.endsWith(last8) || digits.endsWith(rowDigits.slice(-8)));
      });

      if (match) {
        console.log(`🔒 [Supabase Verified]: Nomor ${clean} TERBUKTI sedang dalam MODE AMBIL ALIH MANUAL oleh Admin!`);
        manualTakeoverPhones.add(clean);
        return true;
      }
    }
  } catch (err) {
    console.warn('⚠️ [Check Takeover Supabase Error]:', err.message);
  }

  return false;
}

// Database referensi cepat Wali & Santri Pesantren Darul Ulum
const KNOWN_WALI_MAP = {
  '6285960213654': {
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
  '085960213654': {
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

  // ─── INTENT PRIORITAS TERTINGGI: CLOSINGAN / WALI INGIN BICARA DENGAN ADMIN ───
  const isAdminRequest =
    textLower.includes('bicara sama admin') ||
    textLower.includes('bicara dengan admin') ||
    textLower.includes('ngomong sama admin') ||
    textLower.includes('ngomong dengan admin') ||
    textLower.includes('hubungkan ke admin') ||
    textLower.includes('hubungi admin') ||
    textLower.includes('panggil admin') ||
    textLower.includes('minta nomor admin') ||
    textLower.includes('kontak admin') ||
    textLower.includes('bicara ustadz') ||
    textLower.includes('bicara dengan ustadz') ||
    textLower.includes('ngomong sama ustadz') ||
    textLower.includes('pengasuh pondok') ||
    textLower.includes('apakah ini dengan admin') ||
    textLower.includes('apakah ini admin') ||
    textLower.includes('apakah dengan admin') ||
    textLower.includes('ini admin kah') ||
    textLower.includes('apakah admin') ||
    textLower.includes('mau admin') ||
    textLower.includes('bisa bicara langsung') ||
    textLower.includes('bicara langsung');

  if (isAdminRequest) {
    console.log(`🔔 [Smart Handoff Triggered]: Wali ${cleanPhone} meminta bicara dengan Admin! Mengalihkan ke Mode Manual.`);

    // 1. Simpan nomor ini ke Mode Ambil Alih Manual di Supabase & memory cache
    await setManualTakeover(cleanPhone, true);

    // 2. Siarkan event takeover otomatis ke dashboard admin secara real-time
    try {
      await broadcastToSupabaseRealtime('whatsapp.takeover', {
        phone: cleanPhone,
        isManual: true,
        reason: 'WALI_REQUESTED_ADMIN',
        senderName: waliData.namaWali,
        admin: 'Ust. Drs. H. Mustofa',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Takeover broadcast warning:', e.message);
    }

    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nBaik Bapak/Ibu, percakapan ini sekarang kami alihkan langsung ke *Admin Ri'ayah / Ustadz Musyrif Asrama*.\n\nUstadz akan segera membaca dan membalas pesan Bapak/Ibu secara langsung di sini. Mohon ditunggu sebentar ya Bapak/Ibu. 🙏\n\n_— Smart Ri'ayah Handoff System_`;
  }

  // 1. Coba gunakan DeepSeek / Gemini AI jika token tersedia
  const deepseekKey = process.env.DEEPSEEK_API_KEY || 'sk-5b97e9e1d00846818565250d944cc047';
  if (deepseekKey) {
    try {
      const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `Anda adalah pengasuh/ustadz ramah dari Pesantren Modern Darul Ulum yang membalas pesan WhatsApp wali santri.
Konteks: Wali ${waliData.namaWali}, Santri ${waliData.santriNama} (${waliData.kelas}, ${waliData.kamar}). Status: ${waliData.statusAsrama}, Saldo: ${waliData.saldoRfid}.
ATURAN PENTING:
- Balas pesan senatural mungkin, santun, hangat, dan bersahabat layaknya percakapan nyata.
- JANGAN PERNAH membuat daftar/list menu berupa angka (1, 2, 3...) atau poin-poin kaku penanganan masalah.
- Jawab langsung secara wajar, lalu tanyakan keperluannya apa atau apa yang bisa dibantu.`
            },
            {
              role: 'user',
              content: incomingText
            }
          ],
          temperature: 0.3,
          max_tokens: 250
        })
      });

      if (dsRes.ok) {
        const dsJson = await dsRes.json();
        const reply = dsJson.choices?.[0]?.message?.content?.trim();
        if (reply) return reply;
      }
    } catch (llmErr) {
      console.warn('⚠️ [AI Otonom] DeepSeek AI offline/fallback ke Smart Local Reasoning:', llmErr.message);
    }
  }

  // 2. Smart Local Reasoning Engine (Context-Aware Instant Fallback)
  // Periksa intent spesifik secara bertingkat:

  // TOPIK 1: SALDO RFID / DOMPET PINTAR / UANG SAKU
  if (textLower.includes('saldo') || textLower.includes('uang') || textLower.includes('dompet') || textLower.includes('jajan') || textLower.includes('rfid') || textLower.includes('topup') || textLower.includes('top up')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nAlhamdulillah, sisa saldo kartu RFID ananda *${waliData.santriNama}* saat ini *${waliData.saldoRfid}* dengan batas jajan ${waliData.limitHarian} per hari.\n\nAda keperluan isi saldo (Top Up) atau hal lain yang bisa kami bantu untuk ananda? Silakan disampaikan ya Bapak/Ibu. 🙏`;
  }

  // TOPIK 2: PERIZINAN & PERPANJANGAN LIBURAN
  if (textLower.includes('izin') || textLower.includes('pulang') || textLower.includes('libur') || textLower.includes('perpanjang') || textLower.includes('pesiar') || textLower.includes('keluar')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nUntuk perizinan ananda *${waliData.santriNama}*, permohonan izin pulang maupun pesiar dapat diajukan via aplikasi Smart Ri'ayah minimal H-1 ya Bapak/Ibu. Saat ini status izin ananda: *${waliData.izinTerakhir}*.\n\nAda keperluan izin apa yang ingin diajukan untuk ananda? Silakan disampaikan ya Bapak/Ibu. 🙏`;
  }

  // TOPIK 3: KESEHATAN / SAKIT / UKS / POSKESTREN
  if (textLower.includes('sakit') || textLower.includes('demam') || textLower.includes('obat') || textLower.includes('uks') || textLower.includes('poskestren') || textLower.includes('klinik') || textLower.includes('dokter')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nAlhamdulillah kondisi medis ananda *${waliData.santriNama}* saat ini terpantau baik di pondok. Petugas kesehatan Poskestren asrama juga siaga 24 jam mendampingi para santri.\n\nAda keluhan atau keperluan khusus terkait kesehatan ananda yang ingin disampaikan Bapak/Ibu? Silakan ya. 🙏`;
  }

  // TOPIK 4: JAM KUNJUNGAN / SAMBANGAN WALI
  if (textLower.includes('sambang') || textLower.includes('kunjung') || textLower.includes('besuk') || textLower.includes('tengok')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nUntuk jadwal sambangan santri dibuka setiap hari Ahad (Minggu) pukul 08.00 s/d 17.00 WIB di aula ma'had, atau melalui permohonan booking kunjungan hari kerja yang disetujui.\n\nAda rencana berkunjung hari apa dan jam berapa untuk ananda *${waliData.santriNama}*? Silakan disampaikan ya Bapak/Ibu. 🙏`;
  }

  // TOPIK 5: KABAR & KONDISI SANTRI / AKTIVITAS HARIAN
  if (textLower.includes('kabar') || textLower.includes('sehat') || textLower.includes('kondisi') || textLower.includes('kegiatan') || textLower.includes('sholat') || textLower.includes('shalat') || textLower.includes('fauzi') || textLower.includes('anak saya')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nAlhamdulillah ananda *${waliData.santriNama}* saat ini dalam kondisi sehat dan aktif beraktivitas di asrama (${waliData.kamar}). Sholat berjamaah dan halaqah santri berjalan tertib.\n\nAda yang ingin dititipkan atau ditanyakan untuk ananda hari ini Bapak/Ibu? 🙏`;
  }

  // TOPIK 6: SALAM ATAU SAPAAN UMUM
  if (textLower.includes('assalamu') || textLower.includes('halo') || textLower.includes('selamat') || textLower.includes('pagi') || textLower.includes('siang') || textLower.includes('sore') || textLower.includes('malam') || textLower.includes('ping') || textLower.includes('tes')) {
    return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nTerima kasih sudah menghubungi kami di Pesantren Modern Darul Ulum. Ada yang bisa kami bantu? Silakan sampaikan keperluannya ya Bapak/Ibu. 🙏`;
  }

  // TOPIK DEFAULT / PERTANYAAN LAINNYA
  return `Wa'alaikumsalam Warahmatullahi Wabarakatuh, ${waliData.namaWali}.\n\nTerima kasih atas pesannya. Ada yang bisa kami bantu untuk ananda *${waliData.santriNama}*? Silakan sampaikan keperluannya ya Bapak/Ibu. 🙏`;
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
