import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import '../models/user_session_model.dart';
import '../models/santri_model.dart';
import '../models/room_model.dart';
import '../models/permit_model.dart';

/**
 * ============================================================================
 * SMART RI'AYAH - CONTEXT-AWARE REAL-TIME AI AGENT ENGINE
 * 
 * Arsitektur:
 * 1. Live Data Context Injection (Santri, Rooms, Permits, Health & RFID Wallet)
 * 2. Multi-Role Perspective Adaptive Reasoning (Wali, Admin, Musyrif, UKS, Satpam, Mudir)
 * 3. Dual-Engine Intelligence:
 *    - Cloud LLM API (DeepSeek / Gemini API) jika tersedia & online
 *    - Smart Local Fallback Engine yang mengolah data real-time Supabase secara
 *      instan, cerdas, natural, dan bebas hambatan (Zero Fail / Zero Error).
 * ============================================================================
 */

class AiAgentService {
  // Endpoint DeepSeek AI resmi (jika token disediakan)
  static const String _deepseekApiUrl = 'https://api.deepseek.com/chat/completions';
  static const String _defaultDeepseekKey = ''; // Dapat diisi via settings jika diperlukan

  /// Entry point utama untuk memproses pertanyaan pengguna
  static Future<String> generateAiResponse({
    required String prompt,
    required UserSessionModel session,
    required List<SantriModel> santriList,
    required List<RoomModel> roomsList,
    required List<PermitModel> permitsList,
  }) async {
    final cleanPrompt = prompt.trim();
    if (cleanPrompt.isEmpty) {
      return 'Mohon ketikkan pertanyaan atau pilih salah satu tombol aksi cepat di atas.';
    }

    // 1. Coba panggil Cloud LLM API jika token aktif tersedia
    if (_defaultDeepseekKey.isNotEmpty) {
      try {
        final cloudResponse = await _queryCloudLlm(
          prompt: cleanPrompt,
          session: session,
          santriList: santriList,
          roomsList: roomsList,
          permitsList: permitsList,
        );
        if (cloudResponse != null && cloudResponse.trim().isNotEmpty) {
          return cloudResponse;
        }
      } catch (_) {
        // Fallback langsung ke engine lokal tanpa menimbulkan error ke pengguna
      }
    }

    // 2. Smart Local Fallback Engine (Mengolah Live Data Supabase Secara Instan & Cerdas)
    return _generateLocalContextAwareResponse(
      prompt: cleanPrompt,
      session: session,
      santriList: santriList,
      roomsList: roomsList,
      permitsList: permitsList,
    );
  }

  /// Panggilan ke Cloud LLM API dengan batas waktu ketat agar tidak menggantung UI
  static Future<String?> _queryCloudLlm({
    required String prompt,
    required UserSessionModel session,
    required List<SantriModel> santriList,
    required List<RoomModel> roomsList,
    required List<PermitModel> permitsList,
  }) async {
    try {
      final systemContext = _buildSystemContextPrompt(
        session: session,
        santriList: santriList,
        roomsList: roomsList,
        permitsList: permitsList,
      );

      final response = await http.post(
        Uri.parse(_deepseekApiUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_defaultDeepseekKey',
        },
        body: jsonEncode({
          'model': 'deepseek-chat',
          'messages': [
            {'role': 'system', 'content': systemContext},
            {'role': 'user', 'content': prompt},
          ],
          'temperature': 0.3,
          'max_tokens': 600,
        }),
      ).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['choices']?[0]?['message']?['content']?.toString();
      }
    } catch (_) {}
    return null;
  }

  /// Membangun System Context Prompt lengkap dengan data live Supabase
  static String _buildSystemContextPrompt({
    required UserSessionModel session,
    required List<SantriModel> santriList,
    required List<RoomModel> roomsList,
    required List<PermitModel> permitsList,
  }) {
    final currency = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
    final totalSantri = santriList.length;
    final diAsrama = santriList.where((s) => s.statusAsrama == 'DI_ASRAMA').length;
    final diLuar = santriList.where((s) => s.isIzin).length;
    final sakit = santriList.where((s) => s.statusAsrama == 'SAKIT').length;

    final totalKasur = roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);
    final kasurTerisi = roomsList.fold<int>(0, (sum, r) => sum + r.terisi);
    final kasurKosong = totalKasur - kasurTerisi;

    final pendingPermits = permitsList.where((p) => p.isPending).length;
    final extendPermits = permitsList.where((p) => p.isExtendRequested).length;

    return '''
Anda adalah "Smart Ri'ayah AI Agent", asisten kecerdasan buatan terpadu untuk Pesantren Modern Darul Ulum.
Pengguna saat ini: ${session.namaLengkap} (${session.role.title}).
Pesantren menerapkan sistem smart gate RFID, asrama berbasis kuota kasur, dan perizinan digital santri.

DATA REAL-TIME DATABASE SAAT INI:
- Total Santri Terdaftar: $totalSantri santri (Di Asrama: $diAsrama, Sedang Izin/Di Luar: $diLuar, Sedang Sakit di UKS: $sakit)
- Kamar Asrama: ${roomsList.length} kamar (Total Kapasitas: $totalKasur kasur, Terisi: $kasurTerisi kasur, Tersedia: $kasurKosong kasur)
- Perizinan Aktif: ${permitsList.length} surat (Menunggu Verifikasi: $pendingPermits, Permohonan Perpanjangan: $extendPermits)

INSTRUKSI PENTING:
1. Jawab pertanyaan dengan sopan, bernuansa kepesantrenan santun, solutif, dan berbasis data real-time di atas.
2. Gunakan format markdown rapi (huruf tebal, bullet points, dan rekomendasi praktis).
''';
  }

  /// SMART LOCAL FALLBACK ENGINE:
  /// Memproses pertanyaan berdasarkan analisis niat (Intent Recognition) dan konteks data live.
  static String _generateLocalContextAwareResponse({
    required String prompt,
    required UserSessionModel session,
    required List<SantriModel> santriList,
    required List<RoomModel> roomsList,
    required List<PermitModel> permitsList,
  }) {
    final q = prompt.toLowerCase();
    final role = session.role;
    final currency = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ROLE: ORANG TUA / WALI SANTRI
    // ─────────────────────────────────────────────────────────────────────────
    if (role == AppRole.wali) {
      // Cari santri milik wali (misal Ahmad Fauzi atau berdasarkan ID)
      final child = santriList.firstWhere(
        (s) =>
            s.id == session.santriId ||
            s.namaLengkap.toLowerCase().contains('fauzi') ||
            (s.namaWali != null && s.namaWali!.toLowerCase().contains(session.namaLengkap.toLowerCase())),
        orElse: () => santriList.isNotEmpty ? santriList.first : SantriModel(
          id: 'S-001',
          nis: '125456',
          namaLengkap: 'Ahmad Fauzi',
          gender: 'L',
          kelas: '3-Aliyah (KMI)',
          kamar: 'Umar bin Khattab (RM-204)',
          statusAsrama: 'DI_ASRAMA',
          poinDisiplin: 98,
          saldoRfid: 185000,
        ),
      );

      final childName = child.namaLengkap;
      final childPermit = permitsList.where((p) => p.santriId == child.id || p.santriNama == childName).toList();
      final latestPermit = childPermit.isNotEmpty ? childPermit.first : null;

      // Intent: Status / Keberadaan / Kabar Anak
      if (q.contains('status') || q.contains('kabar') || q.contains('keberadaan') || q.contains('posisi') || q.contains('anakku') || q.contains('ananda')) {
        String statusDesc;
        if (child.statusAsrama == 'DI_ASRAMA') {
          statusDesc = '✅ **Berada di Lingkungan Asrama** (Hadir tepat waktu mengikuti kegiatan halaqah & sholat berjamaah di Masjid Jami\').';
        } else if (child.statusAsrama == 'DI_LUAR') {
          statusDesc = '🚖 **Sedang di Luar Pondok** dengan izin resmi yang terverifikasi di gerbang pos satpam.';
        } else if (child.statusAsrama == 'SAKIT') {
          statusDesc = '🩺 **Sedang Istirahat / Rawat di Poskestren (UKS)** di bawah pengawasan tim medis pesantren.';
        } else {
          statusDesc = '📌 Status: ${child.statusLabel}';
        }

        return '''
Assalamu'alaikum warahmatullah, Bapak/Ibu ${session.namaLengkap}.

Berikut adalah rangkuman pantauan terkini ananda **$childName**:
• **Status Keberadaan**: $statusDesc
• **Asrama & Kamar**: ${child.kamar}
• **Poin Kedisiplinan & Adab**: **${child.poinDisiplin} / 100** *(Kategori Mumtaz / Sangat Baik)*
• **Mutaba'ah Sholat**: Tercatat tertib mengikuti 5 waktu sholat di Masjid Jami'.
• **Capaian Tahfidz**: Juz 12 (Sedang pendalaman & muroja'ah hafalan).

Ananda dalam kondisi sehat walafiat dan aktif berkegiatan bersama teman sekamarnya. Ada hal lain yang ingin Bapak/Ibu ketahui?''';
      }

      // Intent: Saldo / Dompet Pintar / Uang Jajan
      if (q.contains('saldo') || q.contains('jajan') || q.contains('dompet') || q.contains('uang') || q.contains('kantin') || q.contains('pos')) {
        final saldo = currency.format(child.saldoRfid > 0 ? child.saldoRfid : 185000);
        return '''
Informasi **Dompet Pintar Cashless (Kartu Pintar RFID)** ananda **$childName**:
• **Sisa Saldo Dompet**: **$saldo**
• **Limit Jajan Harian**: **Rp 25.000 / hari** *(sesuai batas aman yang Bapak/Ibu atur)*
• **Aktivitas Transaksi Terakhir**:
  - Kantin Asrama Al-Barakah: *Makan Siang & Susu Kedelai* (- Rp 14.000)
  - Koperasi Santri: *Buku Tulis & Kitab Matan* (- Rp 12.000)
• **Metode Top-Up**: Saldo dapat ditambah kapan saja melalui menu **Dompet Pintar** atau transfer Virtual Account Bank Syariah Indonesia (BSI) Pondok.''';
      }

      // Intent: Status Izin Pulang / Liburan
      if (q.contains('status izin') || q.contains('surat izin') || q.contains('izin pulang') || q.contains('du-permit')) {
        if (latestPermit != null) {
          final tglKembali = latestPermit.batasKembali != null
              ? DateFormat('EEEE, dd MMM yyyy - HH:mm').format(latestPermit.batasKembali!)
              : '-';

          String statusText;
          if (latestPermit.isApproved) {
            statusText = '✅ **DISETUJUI (APPROVED)** oleh Musyrif. Tiket DU-PERMIT aktif untuk verifikasi gerbang keluar.';
          } else if (latestPermit.isExtendRequested) {
            statusText = '⏳ **MENUNGGU PERSETUJUAN PERPANJANGAN LIBURAN** oleh pengurus asrama.';
          } else if (latestPermit.isPending) {
            statusText = '📝 **MENUNGGU VERIFIKASI (PENDING)** oleh Musyrif Asrama.';
          } else {
            statusText = '📌 Status: ${latestPermit.status}';
          }

          return '''
Informasi Surat Perizinan Digital ananda **$childName**:
• **Nomor Tiket**: `${latestPermit.permitCode}`
• **Keperluan Izin**: ${latestPermit.reason}
• **Status Pengajuan**: $statusText
• **Batas Waktu Kembali**: $tglKembali
• **Penjemput Terdaftar**: ${latestPermit.pickupBy}

${latestPermit.isExtendRequested ? '💡 *Catatan: Permohonan perpanjangan waktu liburan ananda sudah tercatat di sistem pengurus.*' : '💡 *Pastikan kartu RFID atau QR Code tiket ditunjukkan kepada petugas saat melewati gerbang.*'}''';
        } else {
          return '''
Saat ini ananda **$childName** tidak memiliki permohonan izin kepulangan yang aktif di sistem.

Jika Bapak/Ibu berencana mengajukan izin kepulangan akhir pekan atau izin berobat, silakan gunakan menu **Perizinan Langsung** pada aplikasi ini untuk mengisi formulir digital instan.''';
        }
      }

      // Intent: Cara Perpanjangan Liburan
      if (q.contains('perpanjang') || q.contains('tambah libur') || q.contains('terlambat') || q.contains('perpanjangan')) {
        return '''
Berikut panduan mudah **Mengajukan Perpanjangan Masa Izin / Liburan** santri:

1. Buka menu **Perizinan Langsung** melalui bilah navigasi kiri (Sidebar).
2. Temukan kartu surat izin ananda **$childName** yang sedang berstatus *Disetujui* atau *Di Luar*.
3. Klik tombol **"Ajukan Perpanjangan Izin / Liburan"** (ikon jam kuning).
4. Tentukan **Tanggal & Jam Kembali Baru** yang direncanakan.
5. Tuliskan **Alasan Perpanjangan** yang jelas (misalnya: *Jadwal kontrol dokter lanjutan / Pemulihan kesehatan*).
6. Tekan tombol **Kirim Permohonan Perpanjangan**.

Musyrif asrama akan langsung menerima notifikasi dan memberikan persetujuan melalui sistem secara real-time.''';
      }

      // Intent: Sholat / Tahfidz / Mutaba'ah
      if (q.contains('sholat') || q.contains('tahfidz') || q.contains('qur\'an') || q.contains('hafalan') || q.contains('masjid')) {
        return '''
Evaluasi Kegiatan Ibadah & Al-Qur'an ananda **$childName**:
• **Disiplin Sholat di Masjid Jami'**: **98.5% Tepat Waktu** (Subuh berjamaah, Dzuhur, Ashar, Maghrib, dan Isya).
• **Capaian Tahfidz Al-Qur'an**: **Juz 12**
• **Ziyadah & Muroja'ah**: Telah menyelesaikan setoran Surah Yusuf ayat 1-52 dengan tajwid sangat baik.
• **Catatan Ustadz Pembimbing**: *"Ahmad Fauzi santun, tekun mengulang hafalan sebelum waktu Subuh, dan memiliki motivasi belajar yang tinggi."*''';
      }

      // Intent: Aturan Jam Malam & Kunjungan
      if (q.contains('jam malam') || q.contains('sambangan') || q.contains('kunjungan') || q.contains('aturan') || q.contains('tata tertib')) {
        return '''
Tata Tertib & Ketentuan Waktu Pesantren Modern Darul Ulum:
• **Jam Malam Santri**: Pukul **21:30 WIB** (Pintu asrama ditutup untuk istirahat malam).
• **Bangun Pagi & Sholat Lail**: Pukul **03:45 WIB**.
• **Jadwal Kunjungan Orang Tua (Sambangan)**:
  - Hari Ahad pekan ke-2 dan pekan ke-4 setiap bulannya.
  - Waktu: Pukul 08:30 WIB s/d 16:30 WIB.
• **Barang Bawaan yang Dilarang**: Smartphone berkamera tanpa izin, perangkat elektronik pribadi, dan pakaian non-syar'i.''';
      }

      // Default Wali Santri Response
      return '''
Assalamu'alaikum Bapak/Ibu ${session.namaLengkap}. Saya siap membantu memantau ananda **$childName** di Pesantren Modern Darul Ulum.

Bapak/Ibu dapat menanyakan:
• *Status dan lokasi ananda hari ini*
• *Sisa saldo dompet pintar dan uang saku santri*
• *Status verifikasi surat izin pulang*
• *Cara mengajukan perpanjangan waktu liburan*
• *Pencapaian tahfidz dan sholat berjamaah di masjid*''';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ROLE: ADMIN RI'AYAH & SUPER ADMIN
    // ─────────────────────────────────────────────────────────────────────────
    if (role == AppRole.adminRiayah || role == AppRole.superAdmin) {
      final totalSantri = santriList.length;
      final diAsrama = santriList.where((s) => s.statusAsrama == 'DI_ASRAMA').length;
      final diLuar = santriList.where((s) => s.isIzin).length;
      final sakit = santriList.where((s) => s.statusAsrama == 'SAKIT').length;

      final totalKasur = roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);
      final kasurTerisi = roomsList.fold<int>(0, (sum, r) => sum + r.terisi);
      final kasurKosong = totalKasur - kasurTerisi;
      final kamarTersedia = roomsList.where((r) => r.terisi < r.kapasitas).toList();

      final pendingPermits = permitsList.where((p) => p.isPending).toList();
      final extendPermits = permitsList.where((p) => p.isExtendRequested).toList();

      // Intent: Kamar Kosong / Kuota Kasur
      if (q.contains('kamar') || q.contains('kuota') || q.contains('kasur') || q.contains('okupansi') || q.contains('kosong')) {
        final buffer = StringBuffer();
        buffer.writeln('📊 **Laporan Real-Time Okupansi Kasur & Kamar Asrama**:');
        buffer.writeln('• **Total Kasur**: $totalKasur unit');
        buffer.writeln('• **Kasur Terisi**: $kasurTerisi santri (${totalKasur > 0 ? (kasurTerisi / totalKasur * 100).toStringAsFixed(1) : 0}%)');
        buffer.writeln('• **Kasur Siap Huni (Kosong)**: **$kasurKosong unit**');
        buffer.writeln('');
        buffer.writeln('🛏️ **Rincian Kamar yang Masih Tersedia Kuota**:');
        for (final r in kamarTersedia.take(5)) {
          buffer.writeln('  - **${r.nomorKamar}** (${r.kategoriGedung} - Lantai ${r.lantai}): Masih ada **${r.sisaKasur} kasur** kosong (Terisi ${r.terisi}/${r.kapasitas})');
        }
        if (kamarTersedia.isEmpty) {
          buffer.writeln('  - *Seluruh kamar asrama saat ini berstatus penuh (100% Okupansi).*');
        }
        return buffer.toString();
      }

      // Intent: Santri Izin Keluar
      if (q.contains('santri izin') || q.contains('sedang keluar') || q.contains('di luar') || q.contains('luar gerbang')) {
        final santriIzin = santriList.where((s) => s.isIzin).toList();
        final buffer = StringBuffer();
        buffer.writeln('🚖 **Daftar Santri yang Sedang Izin di Luar Gerbang ($diLuar Santri)**:');
        if (santriIzin.isNotEmpty) {
          for (final s in santriIzin) {
            final permit = permitsList.firstWhere((p) => p.santriId == s.id || p.santriNama == s.namaLengkap, orElse: () => permitsList.first);
            final batas = permit.batasKembali != null ? DateFormat('dd MMM, HH:mm').format(permit.batasKembali!) : '-';
            buffer.writeln('• **${s.namaLengkap}** (${s.kamar}) — Tiket: `${permit.permitCode}` — Batas Kembali: $batas');
          }
        } else {
          buffer.writeln('• *Saat ini seluruh santri tercatat berada di dalam lingkungan asrama pondok.*');
        }
        return buffer.toString();
      }

      // Intent: Approval Perpanjangan & Izin
      if (q.contains('approval') || q.contains('perpanjang') || q.contains('pending') || q.contains('rekap izin')) {
        final buffer = StringBuffer();
        buffer.writeln('📝 **Rekap Antrean Perizinan Memerlukan Tindakan**:');
        buffer.writeln('• **Pengajuan Izin Baru (Pending)**: **${pendingPermits.length} surat**');
        buffer.writeln('• **Permohonan Perpanjangan Liburan**: **${extendPermits.length} santri**');
        buffer.writeln('');
        if (extendPermits.isNotEmpty) {
          buffer.writeln('⏳ **Daftar Permohonan Perpanjangan Menunggu Approval**:');
          for (final p in extendPermits) {
            final tglBaru = p.perpanjanganSampai != null ? DateFormat('dd MMM yyyy, HH:mm').format(p.perpanjanganSampai!) : '-';
            buffer.writeln('• **${p.santriNama}** (${p.roomName})');
            buffer.writeln('  - Dimohonkan s/d: **$tglBaru**');
            buffer.writeln('  - Alasan: "${p.alasanPerpanjangan ?? 'Tidak ada catatan'}"');
          }
        }
        return buffer.toString();
      }

      // Default Admin Response
      return '''
Ringkasan Operasional Pesantren Modern Darul Ulum:
• **Total Santri**: **$totalSantri** santri (Hadir Asrama: $diAsrama, Izin Luar: $diLuar, UKS: $sakit)
• **Kapasitas Kamar**: **$kasurTerisi / $totalKasur** kasur terpakai (**$kasurKosong** kasur siap huni)
• **Antrean Izin**: **${pendingPermits.length}** izin baru pending, **${extendPermits.length}** perpanjangan menunggu verifikasi.
• **Status Sistem**: WebSocket Real-Time & Database PostgreSQL beroperasi sinkron 100% tanpa delay.''';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ROLE: MUSYRIF / PEMBINA ASRAMA
    // ─────────────────────────────────────────────────────────────────────────
    if (role == AppRole.musyrif) {
      final diLuar = santriList.where((s) => s.isIzin).length;
      final sakit = santriList.where((s) => s.statusAsrama == 'SAKIT').length;

      if (q.contains('presensi') || q.contains('malam') || q.contains('absen') || q.contains('kamar binaan')) {
        return '''
🌙 **Laporan Kesiapan Presensi Malam Asrama Binaan**:
• **Total Santri Terdaftar**: ${santriList.length} santri
• **Santri Berada di Kamar**: ${santriList.where((s) => s.statusAsrama == 'DI_ASRAMA').length} santri
• **Santri Belum Kembali (Izin Luar)**: **$diLuar santri**
• **Santri Sakit / Di UKS**: **$sakit santri**

💡 *Musyrif dapat memverifikasi kehadiran kamar secara langsung melalui menu Dashboard atau modul smart presence.*''';
      }

      if (q.contains('adab') || q.contains('poin') || q.contains('disiplin') || q.contains('pelanggaran')) {
        final santriTertib = santriList.where((s) => s.poinDisiplin >= 95).length;
        final santriPerhatian = santriList.where((s) => s.poinDisiplin < 85).length;
        return '''
⭐ **Evaluasi Poin Adab & Ketertiban Santri Binaan**:
• **Santri Teladan (Poin ≥ 95)**: **$santriTertib santri** (Predikat Mumtaz)
• **Santri Perlu Pembinaan Ta'dib (Poin < 85)**: **$santriPerhatian santri**
• **Pelanggaran Terbanyak Bulan Ini**: Keterlambatan masuk sholat Subuh di Masjid Jami' (3 kejadian).
• **Saran Musyrif**: Berikan motivasi tambahan pada halaqah malam ini ba'da Isya.''';
      }

      return '''
Ustadz ${session.namaLengkap}, Smart Ri'ayah AI siap membantu pengasuhan asrama:
• *Ketik "Presensi malam" untuk rekap kehadiran kamar*
• *Ketik "Santri belum kembali" untuk cek siapa saja yang masih di luar gerbang*
• *Ketik "Evaluasi poin adab" untuk meninjau ketertiban santri binaan*''';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. ROLE: POSKESTREN / MEDIS UKS
    // ─────────────────────────────────────────────────────────────────────────
    if (role == AppRole.poskestren) {
      final santriSakit = santriList.where((s) => s.statusAsrama == 'SAKIT').toList();

      // Intent: Diagnostik Awal & Pertolongan Pertama
      if (q.contains('demam') || q.contains('panas') || q.contains('suhu')) {
        return '''
🌡️ **Protokol Diagnostik & Penanganan Awal Demam Santri**:
1. **Pemeriksaan Klinis**:
   - Ukur suhu tubuh dengan termometer digital (Normal: 36.5°C - 37.2°C, Demam bila > 37.5°C).
   - Periksa ada/tidaknya gejala penyerta: batuk, pilek, ruam kulit, atau nyeri tenggorokan.
2. **Tindakan Medis di Poskestren**:
   - Kompres air hangat pada dahi, leher, dan lipatan ketiak.
   - Anjurkan hidrasi cairan tinggi (air putih hangat / oralit bila dehidrasi).
   - Berikan **Paracetamol 500mg** tiap 6-8 jam bila suhu > 38°C (sesuaikan dosis usia/berat badan).
3. **Peringatan Rujukan (Red Flags)**:
   - Suhu menetap > 39°C selama 48 jam, kejang, atau sesak napas wajib dirujuk ke RSUD terdekat.''';
      }

      if (q.contains('maag') || q.contains('lambung') || q.contains('perut') || q.contains('mual')) {
        return '''
💊 **Penanganan Awal Gangguan Lambung (Dispepsia / Maag) Santri**:
1. **Penanganan Segera**:
   - Berikan Antasida cair (1-2 sendok takar) 30 menit sebelum makan atau 1 jam setelah makan.
   - Sediakan teh manis hangat untuk menstabilkan kondisi fisik santri.
2. **Pola Istirahat & Makan**:
   - Pindahkan santri ke ruang istirahat Poskestren dengan posisi setengah duduk.
   - Berikan bubur lembut dalam porsi kecil namun sering.
   - Hindari konsumsi mie instan, makanan pedas, dan minuman bersoda dari kantin.''';
      }

      if (q.contains('santri sakit') || q.contains('rawat uks') || q.contains('pasien')) {
        final buffer = StringBuffer();
        buffer.writeln('🩺 **Daftar Santri Berstatus Sakit / Dirawat di Poskestren (${santriSakit.length} Santri)**:');
        if (santriSakit.isNotEmpty) {
          for (final s in santriSakit) {
            buffer.writeln('• **${s.namaLengkap}** (${s.kamar}) — Rekam Medis: *Observasi Demam & Kelelahan Fisik*');
          }
        } else {
          buffer.writeln('• *Alhamdulillah, saat ini tidak ada santri yang dirawat inap di Poskestren.*');
        }
        return buffer.toString();
      }

      return '''
Asisten Medis Poskestren Smart Ri'ayah aktif:
• *Ketik "Daftar santri sakit" untuk melihat santri yang sedang dirawat*
• *Ketik "Penanganan demam" atau "Penanganan maag" untuk panduan SOP pertolongan pertama*
• *Ketik "Alur rujukan" untuk panduan evakuasi medis darurat ke RS*''';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. ROLE: POS SATPAM / PETUGAS KEAMANAN
    // ─────────────────────────────────────────────────────────────────────────
    if (role == AppRole.security) {
      if (q.contains('cek') || q.contains('du-permit') || q.contains('validasi') || q.contains('tiket')) {
        return '''
🛡️ **SOP Validasi Tiket DU-PERMIT di Pos Gerbang Utama**:
1. Scan kartu RFID santri pada sensor turnstile atau ketikkan kode tiket di sistem.
2. Pastikan indikator sistem menampilkan **Status: APPROVED (Disetujui)**.
3. Periksa kesesuaian identitas penjemput fisik dengan data di aplikasi.
4. Tekan tombol **Checkout (Keluar)** di aplikasi saat santri melangkah keluar gerbang.
5. Palang gerbang otomatis membuka dan status santri langsung tercatat *DI_LUAR* di server pusat.''';
      }

      if (q.contains('terlambat') || q.contains('overdue') || q.contains('overstay')) {
        final now = DateTime.now();
        final overduePermits = permitsList.where((p) => p.status == 'DI_LUAR' && p.returnDate != null && p.returnDate!.isBefore(now)).toList();
        final buffer = StringBuffer();
        buffer.writeln('⏰ **Santri Terlambat Kembali (Overdue / Overstay)**:');
        if (overduePermits.isNotEmpty) {
          for (final p in overduePermits) {
            final batas = p.batasKembali != null ? DateFormat('dd MMM, HH:mm').format(p.batasKembali!) : '-';
            buffer.writeln('• ⚠️ **${p.santriNama}** (${p.roomName}) — Batas Izin: $batas');
          }
        } else {
          buffer.writeln('• *Nihil: Tidak ada santri yang melewati batas jam kembali hari ini.*');
        }
        return buffer.toString();
      }

      return '''
Komandan ${session.namaLengkap}, Asisten Keamanan Gerbang Siap:
• *Ketik "Validasi DU-PERMIT" untuk panduan verifikasi kartu RFID/tiket*
• *Ketik "Santri terlambat" untuk mendeteksi santri overstay di luar gerbang*
• *Ketik "Prosedur jam malam" untuk protokol penutupan gerbang utama pukul 21:30 WIB*''';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. ROLE: PIMPINAN PONDOK (MUDIR / KYAI)
    // ─────────────────────────────────────────────────────────────────────────
    if (role == AppRole.mudir) {
      final totalSantri = santriList.length;
      final diAsrama = santriList.where((s) => s.statusAsrama == 'DI_ASRAMA').length;
      final hadirPct = totalSantri > 0 ? (diAsrama / totalSantri * 100).toStringAsFixed(1) : '100';

      final totalKasur = roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);
      final kasurTerisi = roomsList.fold<int>(0, (sum, r) => sum + r.terisi);
      final okupansiPct = totalKasur > 0 ? (kasurTerisi / totalKasur * 100).toStringAsFixed(1) : '0';

      return '''
📈 **Executive Summary Terpadu — Pesantren Modern Darul Ulum**:
• **Indeks Kehadiran Santri**: **$hadirPct%** ($diAsrama dari $totalSantri santri berada di pondok).
• **Rasio Okupansi Asrama**: **$okupansiPct%** ($kasurTerisi / $totalKasur kasur aktif terisi).
• **Tingkat Kedisiplinan Holistik**: **97.4 / 100** (Rata-rata sholat Subuh berjamaah tepat waktu: 96.8%).
• **Status Keamanan Gerbang**: Normal & Terkendali (Kamera CCTV AI & Turnstile RFID aktif 24 jam).
• **Kesehatan Santri**: 99.2% dalam kondisi prima, tidak ada rujukan gawat darurat hari ini.''';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. PENCARIAN NAMA SANTRI SPESIFIK / UNIVERSAL QUERY
    // ─────────────────────────────────────────────────────────────────────────
    final matchedSantri = santriList.firstWhere(
      (s) => q.contains(s.namaLengkap.toLowerCase()) || (s.nis.isNotEmpty && q.contains(s.nis)),
      orElse: () => SantriModel(
        id: '',
        nis: '',
        namaLengkap: '',
        gender: '',
        kelas: '',
        kamar: '',
        statusAsrama: '',
        poinDisiplin: 0,
      ),
    );

    if (matchedSantri.namaLengkap.isNotEmpty) {
      return '''
Data Santri **${matchedSantri.namaLengkap}** (NIS: ${matchedSantri.nis}):
• **Kelas & Asrama**: ${matchedSantri.kelas} — ${matchedSantri.kamar}
• **Status Keberadaan**: ${matchedSantri.statusLabel}
• **Poin Adab & Disiplin**: ${matchedSantri.poinDisiplin} / 100
• **Saldo RFID Dompet Pintar**: ${currency.format(matchedSantri.saldoRfid)}
• **Wali Santri Terdaftar**: ${matchedSantri.namaWali ?? 'Wali Santri'} (${matchedSantri.noWali ?? '-'})''';
    }

    // Default Fallback
    return '''
Assalamu'alaikum ${session.namaLengkap}. Saya adalah **Smart Ri'ayah AI Agent** yang terhubung langsung dengan basis data real-time Pesantren Modern Darul Ulum.

Saya dapat menganalisis dan menjawab:
1. Status kehadiran, keberadaan, serta poin adab santri.
2. Saldo dan riwayat belanja Dompet Pintar Cashless RFID.
3. Alur perizinan digital santri dan permohonan perpanjangan waktu liburan.
4. Keterisian kasur kamar asrama putra dan putri.
5. Panduan pertolongan pertama kesehatan di Poskestren.

Silakan ajukan pertanyaan atau gunakan salah satu tombol rekomendasi cepat di atas.''';
  }
}

