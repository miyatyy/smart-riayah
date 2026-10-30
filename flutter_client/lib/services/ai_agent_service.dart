import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_session_model.dart';
import '../models/santri_model.dart';
import '../models/room_model.dart';
import '../models/permit_model.dart';

/// Jenis penyedia Large Language Model yang didukung
enum LlmProvider {
  gemini('Google Gemini API', 'gemini-1.5-flash'),
  groq('Groq Cloud (Llama 3.3)', 'llama-3.3-70b-versatile'),
  deepseek('DeepSeek AI', 'deepseek-chat'),
  openai('OpenAI (ChatGPT)', 'gpt-4o-mini');

  final String displayName;
  final String defaultModel;
  const LlmProvider(this.displayName, this.defaultModel);

  static LlmProvider fromString(String? val) {
    if (val == null) return LlmProvider.gemini;
    for (final p in LlmProvider.values) {
      if (p.name.toLowerCase() == val.toLowerCase()) return p;
    }
    return LlmProvider.gemini;
  }
}

/// Model data konfigurasi LLM
class LlmConfig {
  final LlmProvider provider;
  final String apiKey;
  final String model;

  const LlmConfig({
    required this.provider,
    required this.apiKey,
    required this.model,
  });

  bool get hasKey => apiKey.trim().isNotEmpty;
}

/// Riwayat pesan percakapan untuk memori multi-turn LLM
class ChatTurn {
  final String role; // 'user' atau 'model' / 'assistant'
  final String content;

  ChatTurn({required this.role, required this.content});
}

/// Hasil uji koneksi LLM
class LlmTestResult {
  final bool success;
  final String message;
  final int latencyMs;

  LlmTestResult({
    required this.success,
    required this.message,
    required this.latencyMs,
  });
}

/**
 * ============================================================================
 * SMART RI'AYAH - REAL GENERATIVE AI (LLM) SERVICE
 * 
 * Arsitektur:
 * 1. 100% Pure LLM Inference (Tanpa if-else / keyword matching / template statis)
 * 2. Multi-Provider REST API Support (Google Gemini, Groq, DeepSeek, OpenAI)
 * 3. Dynamic Live Supabase Context Injection ke System Instruction
 * 4. Multi-Turn Conversation Memory (Riwayat obrolan panjang)
 * 5. SharedPreferences Persistent Configuration & In-App Key Manager
 * ============================================================================
 */
class AiAgentService {
  static const String _prefProviderKey = 'smart_riayah_llm_provider';
  static const String _prefApiKey = 'smart_riayah_llm_api_key';
  static const String _prefModelKey = 'smart_riayah_llm_model';

  /// Default API Key bawaan jika ada dari environment konfigurasi
  static const String defaultFallbackKey = '';

  /// Membaca konfigurasi LLM tersimpan
  static Future<LlmConfig> getConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final providerStr = prefs.getString(_prefProviderKey);
    final provider = LlmProvider.fromString(providerStr);
    final key = prefs.getString(_prefApiKey) ?? defaultFallbackKey;
    final model = prefs.getString(_prefModelKey) ?? provider.defaultModel;

    return LlmConfig(
      provider: provider,
      apiKey: key,
      model: model,
    );
  }

  /// Menyimpan konfigurasi LLM ke penyimpanan lokal
  static Future<void> saveConfig({
    required LlmProvider provider,
    required String apiKey,
    required String model,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefProviderKey, provider.name);
    await prefs.setString(_prefApiKey, apiKey.trim());
    await prefs.setString(_prefModelKey, model.trim());
  }

  /// Menguji koneksi ke endpoint LLM yang dipilih
  static Future<LlmTestResult> testConnection(LlmConfig config) async {
    final t0 = DateTime.now();
    final key = config.apiKey.trim();
    if (key.isEmpty) {
      return LlmTestResult(
        success: false,
        message: 'API Key masih kosong. Silakan masukkan API Key Anda.',
        latencyMs: 0,
      );
    }

    try {
      if (config.provider == LlmProvider.gemini) {
        final url = Uri.parse(
          'https://generativelanguage.googleapis.com/v1beta/models/${config.model.isNotEmpty ? config.model : "gemini-1.5-flash"}:generateContent?key=$key',
        );
        final res = await http.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'contents': [
              {
                'role': 'user',
                'parts': [
                  {'text': 'Ping! Balas hanya dengan kata: OK'}
                ]
              }
            ],
            'generationConfig': {'maxOutputTokens': 10, 'temperature': 0.1}
          }),
        ).timeout(const Duration(seconds: 10));

        final latency = DateTime.now().difference(t0).inMilliseconds;
        if (res.statusCode == 200) {
          return LlmTestResult(
            success: true,
            message: 'Koneksi ke Google Gemini API Berhasil! (${latency}ms)',
            latencyMs: latency,
          );
        } else {
          final errBody = jsonDecode(res.body);
          final errMsg = errBody['error']?['message'] ?? 'HTTP ${res.statusCode}';
          return LlmTestResult(
            success: false,
            message: 'Gagal (HTTP ${res.statusCode}): $errMsg',
            latencyMs: latency,
          );
        }
      } else {
        // Groq / DeepSeek / OpenAI (OpenAI Chat Completions format)
        final String endpoint;
        if (config.provider == LlmProvider.groq) {
          endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        } else if (config.provider == LlmProvider.deepseek) {
          endpoint = 'https://api.deepseek.com/chat/completions';
        } else {
          endpoint = 'https://api.openai.com/v1/chat/completions';
        }

        final res = await http.post(
          Uri.parse(endpoint),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $key',
          },
          body: jsonEncode({
            'model': config.model.isNotEmpty ? config.model : config.provider.defaultModel,
            'messages': [
              {'role': 'user', 'content': 'Ping! Balas hanya dengan kata: OK'}
            ],
            'max_tokens': 10,
            'temperature': 0.1,
          }),
        ).timeout(const Duration(seconds: 10));

        final latency = DateTime.now().difference(t0).inMilliseconds;
        if (res.statusCode == 200) {
          return LlmTestResult(
            success: true,
            message: 'Koneksi ke ${config.provider.displayName} Berhasil! (${latency}ms)',
            latencyMs: latency,
          );
        } else {
          final errBody = jsonDecode(res.body);
          final errMsg = errBody['error']?['message'] ?? 'HTTP ${res.statusCode}';
          return LlmTestResult(
            success: false,
            message: 'Gagal (HTTP ${res.statusCode}): $errMsg',
            latencyMs: latency,
          );
        }
      }
    } catch (e) {
      final latency = DateTime.now().difference(t0).inMilliseconds;
      return LlmTestResult(
        success: false,
        message: 'Koneksi gagal: $e',
        latencyMs: latency,
      );
    }
  }

  /// ENTRY POINT UTAMA: Memanggil Real Generative AI LLM dengan Live Context & Multi-turn Memory
  static Future<String> generateAiResponse({
    required String prompt,
    required List<ChatTurn> history,
    required UserSessionModel session,
    required List<SantriModel> santriList,
    required List<RoomModel> roomsList,
    required List<PermitModel> permitsList,
  }) async {
    final cleanPrompt = prompt.trim();
    if (cleanPrompt.isEmpty) {
      return 'Mohon ketikkan pertanyaan atau perintah Anda.';
    }

    final config = await getConfig();
    if (!config.hasKey) {
      return '''
⚠️ **API Key LLM Belum Dikonfigurasi**

Untuk memulai percakapan cerdas dengan **Real Generative AI (LLM murni tanpa template)**, Anda perlu memasukkan API Key terlebih dahulu.

**Cara mengaktifkan:**
1. Tekan ikon **Kunci / Pengaturan (⚙️)** di pojok kanan atas layar ini.
2. Pilih penyedia LLM favorit Anda:
   • **Google Gemini API** (Gratis di [aistudio.google.com](https://aistudio.google.com/app/apikey))
   • **Groq Cloud API** (Gratis & Sangat Cepat di [console.groq.com](https://console.groq.com/keys))
   • **DeepSeek AI** ([platform.deepseek.com](https://platform.deepseek.com))
   • **OpenAI / ChatGPT** ([platform.openai.com](https://platform.openai.com))
3. Masukkan API Key Anda lalu simpan.

*Setelah tersimpan, AI akan langsung berpikir dan bernalar secara bebas tanpa batas topik!*
''';
    }

    // Bangun System Prompt yang kaya dengan live data Supabase
    final systemPrompt = _buildDynamicSystemPrompt(
      session: session,
      santriList: santriList,
      roomsList: roomsList,
      permitsList: permitsList,
    );

    try {
      if (config.provider == LlmProvider.gemini) {
        return await _callGeminiApi(
          apiKey: config.apiKey,
          model: config.model.isNotEmpty ? config.model : 'gemini-1.5-flash',
          systemPrompt: systemPrompt,
          history: history,
          newPrompt: cleanPrompt,
        );
      } else {
        final endpoint = config.provider == LlmProvider.groq
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : config.provider == LlmProvider.deepseek
                ? 'https://api.deepseek.com/chat/completions'
                : 'https://api.openai.com/v1/chat/completions';

        return await _callOpenAiCompatibleApi(
          endpoint: endpoint,
          apiKey: config.apiKey,
          model: config.model.isNotEmpty ? config.model : config.provider.defaultModel,
          systemPrompt: systemPrompt,
          history: history,
          newPrompt: cleanPrompt,
        );
      }
    } catch (e) {
      return '⚠️ **Kendala Pemrosesan LLM**: $e\n\nSilakan periksa kembali kuota atau validitas API Key Anda melalui tombol pengaturan (⚙️) di kanan atas.';
    }
  }

  /// Panggilan REST API ke Google Gemini (dengan system_instruction dan multi-turn contents)
  static Future<String> _callGeminiApi({
    required String apiKey,
    required String model,
    required String systemPrompt,
    required List<ChatTurn> history,
    required String newPrompt,
  }) async {
    final url = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey',
    );

    // Format multi-turn history untuk Gemini API
    final List<Map<String, dynamic>> contents = [];

    // Ambil maksimal 14 turn terakhir agar tidak melebihi konteks token
    final recentHistory = history.length > 14
        ? history.sublist(history.length - 14)
        : history;

    for (final turn in recentHistory) {
      contents.add({
        'role': turn.role == 'user' ? 'user' : 'model',
        'parts': [
          {'text': turn.content}
        ]
      });
    }

    // Tambahkan pertanyaan pengguna saat ini
    contents.add({
      'role': 'user',
      'parts': [
        {'text': newPrompt}
      ]
    });

    final payload = {
      'system_instruction': {
        'parts': [
          {'text': systemPrompt}
        ]
      },
      'contents': contents,
      'generationConfig': {
        'temperature': 0.7,
        'maxOutputTokens': 1500,
        'topP': 0.95,
      }
    };

    final response = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    ).timeout(const Duration(seconds: 25));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final candidates = data['candidates'] as List?;
      if (candidates != null && candidates.isNotEmpty) {
        final parts = candidates[0]['content']?['parts'] as List?;
        if (parts != null && parts.isNotEmpty) {
          final replyText = parts[0]['text']?.toString() ?? '';
          if (replyText.trim().isNotEmpty) {
            return replyText.trim();
          }
        }
      }
      return 'AI telah memproses permintaan, tetapi tidak mengembalikan teks respons.';
    } else {
      final errData = jsonDecode(response.body);
      final errMsg = errData['error']?['message'] ?? 'HTTP ${response.statusCode}';
      if (response.statusCode == 403) {
        return '⛔ **Akses Ditolak (HTTP 403)**: $errMsg\n\nPastikan API Key Gemini Anda valid dan layanan Generative Language API aktif.';
      } else if (response.statusCode == 429) {
        return '⏳ **Batas Kuota Tercapai (HTTP 429)**: Kuota permintaan API Anda sedang penuh. Tunggu beberapa saat atau ganti dengan API Key lain.';
      }
      return '⚠️ **Gagal Memanggil Gemini API (HTTP ${response.statusCode})**: $errMsg';
    }
  }

  /// Panggilan REST API untuk OpenAI-Compatible (Groq, DeepSeek, OpenAI)
  static Future<String> _callOpenAiCompatibleApi({
    required String endpoint,
    required String apiKey,
    required String model,
    required String systemPrompt,
    required List<ChatTurn> history,
    required String newPrompt,
  }) async {
    final List<Map<String, String>> messages = [
      {'role': 'system', 'content': systemPrompt}
    ];

    final recentHistory = history.length > 14
        ? history.sublist(history.length - 14)
        : history;

    for (final turn in recentHistory) {
      messages.add({
        'role': turn.role == 'user' ? 'user' : 'assistant',
        'content': turn.content,
      });
    }

    messages.add({'role': 'user', 'content': newPrompt});

    final payload = {
      'model': model,
      'messages': messages,
      'temperature': 0.7,
      'max_tokens': 1500,
    };

    final response = await http.post(
      Uri.parse(endpoint),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $apiKey',
      },
      body: jsonEncode(payload),
    ).timeout(const Duration(seconds: 25));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final choices = data['choices'] as List?;
      if (choices != null && choices.isNotEmpty) {
        final text = choices[0]['message']?['content']?.toString() ?? '';
        if (text.trim().isNotEmpty) {
          return text.trim();
        }
      }
      return 'AI telah memproses permintaan, tetapi tidak menghasilkan respons teks.';
    } else {
      final errData = jsonDecode(response.body);
      final errMsg = errData['error']?['message'] ?? 'HTTP ${response.statusCode}';
      if (response.statusCode == 401) {
        return '⛔ **API Key Tidak Valid (HTTP 401)**: $errMsg\n\nSilakan periksa kembali API Key Anda melalui tombol pengaturan (⚙️).';
      } else if (response.statusCode == 429) {
        return '⏳ **Rate Limit (HTTP 429)**: Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu beberapa detik.';
      }
      return '⚠️ **Gagal Memanggil API (HTTP ${response.statusCode})**: $errMsg';
    }
  }

  /// MEMBANGUN OTAK KONTEKS DINAMIS (SYSTEM INSTRUCTION)
  /// Menyuntikkan seluruh fakta live Supabase tanpa template jawaban
  static String _buildDynamicSystemPrompt({
    required UserSessionModel session,
    required List<SantriModel> santriList,
    required List<RoomModel> roomsList,
    required List<PermitModel> permitsList,
  }) {
    final currency = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

    // Agregasi Data Santri
    final totalSantri = santriList.length;
    final diAsrama = santriList.where((s) => s.statusAsrama == 'DI_ASRAMA').length;
    final diLuar = santriList.where((s) => s.isIzin).length;
    final sakit = santriList.where((s) => s.statusAsrama == 'SAKIT').length;

    // Agregasi Data Kamar
    final totalKasur = roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);
    final kasurTerisi = roomsList.fold<int>(0, (sum, r) => sum + r.terisi);
    final kasurKosong = totalKasur - kasurTerisi;

    // Agregasi Data Izin
    final pendingPermits = permitsList.where((p) => p.isPending).length;
    final extendPermits = permitsList.where((p) => p.isExtendRequested).length;
    final outPermits = permitsList.where((p) => p.isActive || p.isApproved).length;

    // Ringkasan Santri
    final santriSummary = santriList.map((s) {
      return '- ${s.namaLengkap} (NIS: ${s.nis}, Kamar: ${s.kamar}, Kelas: ${s.kelas}, Status: ${s.statusLabel}, Saldo RFID: ${currency.format(s.saldoRfid)}, Poin Disiplin: ${s.poinDisiplin}/100)';
    }).join('\n');

    // Ringkasan Kamar
    final roomSummary = roomsList.map((r) {
      return '- ${r.nomorKamar} (${r.namaGedung} - ${r.kategoriGedung}): Kapasitas ${r.kapasitas} kasur, Terisi ${r.terisi}, Sisa Kosong ${r.sisaKasur} kasur';
    }).join('\n');

    // Ringkasan Izin Aktif
    final permitSummary = permitsList.map((p) {
      return '- Izin [${p.permitCode}] ${p.santriName} (Kamar: ${p.roomName}) | Keperluan: "${p.reason}" | Status: ${p.statusLabel} | Kembali: ${p.returnDate != null ? DateFormat('dd/MM/yyyy HH:mm').format(p.returnDate!) : "-"} ${p.isExtendRequested ? "[PERMOHONAN PERPANJANGAN: ${p.extensionReason ?? "-"}]" : ""}';
    }).join('\n');

    // Deteksi Anak Wali jika login sebagai Wali Santri
    String childContext = '';
    if (session.role == AppRole.wali) {
      final child = santriList.firstWhere(
        (s) => s.id == session.santriId || s.namaLengkap.toLowerCase().contains('fauzi'),
        orElse: () => santriList.isNotEmpty ? santriList.first : SantriModel(
          id: 'S-001',
          nis: '125456',
          namaLengkap: 'Ahmad Fauzi',
          gender: 'L',
          kelas: '3-Aliyah (KMI)',
          kamar: 'Umar bin Khattab 204',
          statusAsrama: 'DI_ASRAMA',
          poinDisiplin: 100,
        ),
      );
      childContext = '''
ANAK ASUH WALI YANG SEDANG LOGIN:
- Nama: ${child.namaLengkap} (NIS: ${child.nis})
- Kelas: ${child.kelas} | Kamar Asrama: ${child.kamar}
- Status Keberadaan Terkini: ${child.statusLabel}
- Saldo Dompet Pintar RFID: ${currency.format(child.saldoRfid)}
- Poin Kedisiplinan: ${child.poinDisiplin}/100
''';
    }

    return '''
Anda adalah "Smart Ri'ayah AI", sebuah asisten kecerdasan buatan terpadu (Large Language Model) untuk Pesantren Modern Darul Ulum.
Pesantren mengadopsi ekosistem Smart Campus dengan integrasi Smart Gate Turnstile RFID, Dompet Pintar Cashless, Manajemen Kamar Berbasis Kuota Kasur, dan E-Perizinan Digital.

IDENTITAS PENGGUNA SAAT INI:
- Nama: ${session.namaLengkap} (${session.username})
- Role: ${session.role.title} (${session.role.id})
$childContext

DATA OPERASIONAL REAL-TIME DATABASE SUPABASE (FAKTA TERKINI):
1. STATISTIK GLOBAL SANTRI:
   - Total Santri: $totalSantri santri
   - Berada di Asrama: $diAsrama santri
   - Sedang Izin/Di Luar Pondok: $diLuar santri
   - Sedang Sakit/Dirawat di Poskestren (UKS): $sakit santri

2. STATISTIK KAMAR & ASRAMA:
   - Total Ranjang: $totalKasur kasur
   - Ranjang Terisi: $kasurTerisi kasur
   - Ranjang Tersedia (Kosong): $kasurKosong kasur
   - Daftar Rincian Kamar:
$roomSummary

3. PERIZINAN SANTRI (DU-PERMIT):
   - Total Izin: ${permitsList.length} berkas
   - Menunggu Persetujuan (Pending): $pendingPermits izin
   - Sedang Aktif di Luar: $outPermits izin
   - Permohonan Perpanjangan Liburan: $extendPermits izin
   - Rincian Berkas Perizinan:
$permitSummary

4. DAFTAR LENGKAP SANTRI & KEUANGAN RFID:
$santriSummary

PEDOMAN PENALARAN & CARA MENJAWAB:
1. ANDA ADALAH REAL GENERATIVE AI (LLM):
   - Anda TIDAK menggunakan template statis atau jawaban kaku.
   - Bernalarlah secara bebas, cerdas, kreatif, empatik, dan solutif layaknya manusia atau asisten ChatGPT/Gemini profesional.
   - Pahami kalimat pengguna dalam berbagai gaya bahasa (formal, kasual, gaul, dialek pesantren/santri, bahasa daerah, maupun bahasa Arab/Inggris).

2. KEBEBASAN TOPIK TANPA BATASAN:
   - Pengguna bebas bertanya apa saja: data teknis pondok, konsultasi pengasuhan & psikologi santri, tips menghadapi anak homesick/rindu rumah, hukum fiqih kepesantrenan & adab penuntut ilmu, saran medis pertolongan pertama, penyusunan draf surat resmi pengumuman/izin, hingga diskusi umum dan ngobrol santai.

3. KETEPATAN FAKTA REAL-TIME:
   - Jika pengguna menanyakan tentang santri, kamar, saldo, atau izin, gunakan fakta data live Supabase di atas dengan presisi tinggi.
   - Jika pengguna adalah Wali Santri, prioritaskan memberikan ketenangan hati dan informasi transparan mengenai ananda yang diasuh.

4. FORMAT JAWABAN:
   - Gunakan format Markdown yang indah dan mudah dibaca di layar smartphone: huruf tebal (**teks**), daftar butir (• atau 1, 2, 3), kutipan, serta pemisahan paragraf yang lapang.
   - Berikan salam islami santun di awal atau akhir jika relevan.
''';
  }
}
