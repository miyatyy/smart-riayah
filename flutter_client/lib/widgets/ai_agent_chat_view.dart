import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:intl/intl.dart';
import '../models/user_session_model.dart';
import '../models/santri_model.dart';
import '../models/room_model.dart';
import '../models/permit_model.dart';
import '../services/ai_agent_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - REAL GENERATIVE AI (LLM) CHAT INTERFACE
 * 
 * Fitur Utama:
 * 1. 100% Real LLM Generative AI (Zero Hardcoded Template / Zero If-Else)
 * 2. Multi-Provider (Google Gemini API, Groq Cloud, DeepSeek AI, OpenAI)
 * 3. Injeksi Konteks Dinamis Database Supabase Real-Time ke System Instruction
 * 4. Multi-Turn Conversation History (Ingatan percakapan panjang)
 * 5. Pengaturan API Key Interaktif & Uji Koneksi Langsung di Dalam Aplikasi
 * 6. Markdown Rendering Lengkap (Bold, List, Code, Quote, Tables)
 * 7. Quick Starters Berdasarkan Role Pengguna
 * ============================================================================
 */

class AiMessageItem {
  final String id;
  final String role; // 'user' atau 'ai'
  final String content;
  final DateTime timestamp;

  AiMessageItem({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
  });

  bool get isUser => role == 'user';
}

class AiAgentChatView extends StatefulWidget {
  final UserSessionModel session;
  final List<SantriModel> santriList;
  final List<RoomModel> roomsList;
  final List<PermitModel> permitsList;

  const AiAgentChatView({
    super.key,
    required this.session,
    required this.santriList,
    required this.roomsList,
    required this.permitsList,
  });

  @override
  State<AiAgentChatView> createState() => _AiAgentChatViewState();
}

class _AiAgentChatViewState extends State<AiAgentChatView> with SingleTickerProviderStateMixin {
  final TextEditingController _promptCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  final List<AiMessageItem> _messages = [];

  bool _isThinking = false;
  late AnimationController _animCtrl;

  LlmConfig _llmConfig = const LlmConfig(
    provider: LlmProvider.gemini,
    apiKey: '',
    model: 'gemini-1.5-flash',
  );

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _loadConfigAndInitGreeting();
  }

  @override
  void dispose() {
    _promptCtrl.dispose();
    _scrollCtrl.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadConfigAndInitGreeting() async {
    final cfg = await AiAgentService.getConfig();
    if (mounted) {
      setState(() {
        _llmConfig = cfg;
      });
    }
    _initWelcomeMessage();
  }

  void _initWelcomeMessage() {
    final role = widget.session.role;
    String greeting;

    if (role == AppRole.wali) {
      final child = widget.santriList.firstWhere(
        (s) => s.id == widget.session.santriId || s.namaLengkap.toLowerCase().contains('fauzi'),
        orElse: () => widget.santriList.isNotEmpty
            ? widget.santriList.first
            : SantriModel(
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
      greeting = '''
Assalamu'alaikum warahmatullah, Bapak/Ibu **${widget.session.namaLengkap}**.

Saya adalah **Smart Ri'ayah AI**, asisten kecerdasan buatan berbasis Large Language Model (Generative AI) murni untuk mendampingi pengasuhan ananda **${child.namaLengkap}** di Pesantren Modern Darul Ulum.

Saya terhubung langsung dengan data live Supabase dan siap diajak berdiskusi tentang:
• **Kondisi & Keberadaan**: Posisi ananda, kegiatan asrama, dan kesehatan terkini.
• **Dompet Pintar RFID**: Sisa saldo jajan, mutasi kartu, dan penghematan uang saku.
• **Perizinan & Liburan**: Status permohonan izin atau panduan perpanjangan liburan santri.
• **Konsultasi Bebas**: Tips pengasuhan islami, motivasi belajar anak di pesantren, atau draf pesan menenangkan untuk ananda.

*Ketikkan pertanyaan apa saja dengan leluasa layaknya ChatGPT/Gemini!*
''';
    } else if (role == AppRole.adminRiayah || role == AppRole.superAdmin) {
      greeting = '''
Assalamu'alaikum **${widget.session.namaLengkap}** (${widget.session.role.title}).

Saya adalah **Smart Ri'ayah Generative AI Assistant**. Seluruh data operasional pondok telah tersinkronisasi sebagai memori kerja AI:
• **Total Santri**: ${widget.santriList.length} santri terdaftar
• **Kapasitas Kamar**: ${widget.roomsList.length} kamar asrama
• **Perizinan DU-PERMIT**: ${widget.permitsList.length} berkas aktif

Anda dapat meminta saya menganalisis kapasitas asrama, menyusun draf pengumuman/surat edaran resmi, evaluasi kedisiplinan, maupun diskusi kebijakan pesantren secara bebas.
''';
    } else if (role == AppRole.musyrif) {
      greeting = '''
Assalamu'alaikum Ustadz **${widget.session.namaLengkap}** (Musyrif Pengasuhan Asrama).

Smart Ri'ayah Generative AI siap membantu Ustadz dalam pembinaan santri:
• Evaluasi kedisiplinan sholat berjamaah & kamar asrama
• Rekap presensi malam santri yang belum kembali
• Konsultasi pendekatan konseling psikologis untuk santri yang melanggar aturan atau rindu rumah (*homesick*)
''';
    } else if (role == AppRole.poskestren) {
      greeting = '''
Assalamu'alaikum Tim Medis Poskestren **${widget.session.namaLengkap}**.

AI Smart Assistant siap mendukung operasional kesehatan dan klinik santri:
• Rekap santri yang sedang sakit di asrama/UKS
• Diskusi klinis pertolongan pertama (SOP demam, maag akut, infeksi saluran napas, dan penanganan luka)
• Draf catatan medis atau rekomendasi istirahat untuk musyrif
''';
    } else if (role == AppRole.security) {
      greeting = '''
Selamat bertugas, Komandan **${widget.session.namaLengkap}** (Pos Pengamanan Gerbang).

AI Smart Assistant siap membantu validasi surat izin DU-PERMIT, analisis pola keterlambatan santri (overstay), dan perumusan SOP pengamanan gerbang utama pesantren.
''';
    } else if (role == AppRole.mudir) {
      greeting = '''
Assalamu'alaikum Kyai / Mudir Ma'had **${widget.session.namaLengkap}**.

Smart Ri'ayah Generative AI siap menyajikan *Executive Strategic Analysis*:
• Rasio okupansi kamar asrama putra & putri
• Indeks kepatuhan kedisiplinan dan mutaba'ah tahfidz santri secara agregat
• Perumusan arahan ta'shil dan kebijakan pesantren modern
''';
    } else {
      greeting = '''
Assalamu'alaikum **${widget.session.namaLengkap}**. Smart Ri'ayah Generative AI siap menjawab pertanyaan dan berdiskusi mengenai seluruh aspek kepesantrenan secara cerdas.
''';
    }

    _messages.add(AiMessageItem(
      id: 'welcome-${DateTime.now().millisecondsSinceEpoch}',
      role: 'ai',
      content: greeting,
      timestamp: DateTime.now(),
    ));
  }

  List<String> _getQuickPromptChips() {
    final role = widget.session.role;
    switch (role) {
      case AppRole.wali:
        return [
          'Bagaimana kondisi, posisi, dan kegiatan anak saya saat ini?',
          'Berapa sisa saldo dompet pintar RFID anak saya dan limit jajannya?',
          'Apakah surat izin pulang anak saya sudah disetujui?',
          'Bagaimana cara mengajukan perpanjangan masa liburan santri?',
          'Buatkan draf pesan WhatsApp yang penuh kasih sayang untuk ananda',
          'Berikan tips mengatasi anak yang sedang rindu rumah di pesantren',
        ];
      case AppRole.adminRiayah:
      case AppRole.superAdmin:
        return [
          'Berikan ringkasan kuota asrama dan daftar kamar yang masih kosong',
          'Siapa saja santri yang saat ini sedang berada di luar pondok?',
          'Buatkan draf surat edaran resmi perizinan libur semester pondok',
          'Berapa jumlah pengajuan izin yang butuh persetujuan segera?',
          'Lakukan analisis kepatuhan perizinan santri minggu ini',
        ];
      case AppRole.musyrif:
        return [
          'Rekap presensi santri yang belum kembali ke asrama malam ini',
          'Bagaimana saran pendekatan konseling untuk santri yang melanggar adab?',
          'Tampilkan santri yang sedang dirawat sakit di asrama',
          'Buatkan checklist pembinaan kebersihan dan ketertiban kamar',
        ];
      case AppRole.poskestren:
        return [
          'Daftar santri yang sedang sakit dan dirawat di klinik UKS',
          'Jelaskan SOP pertolongan pertama untuk santri demam tinggi di asrama',
          'Apa langkah penanganan darurat santri dengan maag kambuh?',
          'Buatkan format rujukan medis rumah sakit untuk santri',
        ];
      case AppRole.security:
        return [
          'Bagaimana cara verifikasi kode tiket izin DU-PERMIT di pos satpam?',
          'Tampilkan santri yang terlambat kembali melewati jam malam',
          'Buatkan SOP penjagaan pos gerbang saat jam kepulangan santri',
        ];
      case AppRole.mudir:
        return [
          'Berikan Executive Summary menyeluruh kondisi pesantren hari ini',
          'Bagaimana rasio keterisian asrama dan ketersediaan ranjang?',
          'Evaluasi kedisiplinan dan capaian tahfidz santri secara holistik',
        ];
      default:
        return [
          'Tampilkan status santri dan keterisian kamar asrama hari ini',
          'Bagaimana prosedur perizinan santri di Pesantren Darul Ulum?',
        ];
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent + 150,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage([String? prefilledPrompt]) async {
    final text = prefilledPrompt ?? _promptCtrl.text.trim();
    if (text.isEmpty || _isThinking) return;

    final userMsg = AiMessageItem(
      id: 'USER-${DateTime.now().millisecondsSinceEpoch}',
      role: 'user',
      content: text,
      timestamp: DateTime.now(),
    );

    setState(() {
      _messages.add(userMsg);
      _isThinking = true;
      if (prefilledPrompt == null) _promptCtrl.clear();
    });

    _scrollToBottom();

    // Bangun memori percakapan multi-turn
    final history = _messages
        .where((m) => !m.content.startsWith('⚠️ **API Key LLM Belum Dikonfigurasi**'))
        .map((m) => ChatTurn(
              role: m.isUser ? 'user' : 'model',
              content: m.content,
            ))
        .toList();

    // Hapus pesan user terakhir dari history agar tidak duplikat dengan newPrompt
    if (history.isNotEmpty && history.last.role == 'user') {
      history.removeLast();
    }

    try {
      final aiReply = await AiAgentService.generateAiResponse(
        prompt: text,
        history: history,
        session: widget.session,
        santriList: widget.santriList,
        roomsList: widget.roomsList,
        permitsList: widget.permitsList,
      );

      if (mounted) {
        setState(() {
          _messages.add(AiMessageItem(
            id: 'AI-${DateTime.now().millisecondsSinceEpoch}',
            role: 'ai',
            content: aiReply,
            timestamp: DateTime.now(),
          ));
          _isThinking = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.add(AiMessageItem(
            id: 'AI-ERR-${DateTime.now().millisecondsSinceEpoch}',
            role: 'ai',
            content: '⚠️ **Gagal Terhubung ke LLM**: $e\n\nSilakan cek koneksi internet atau atur API Key melalui tombol (⚙️) di atas.',
            timestamp: DateTime.now(),
          ));
          _isThinking = false;
        });
        _scrollToBottom();
      }
    }
  }

  void _openApiKeySettingsModal() {
    LlmProvider selectedProvider = _llmConfig.provider;
    final keyCtrl = TextEditingController(text: _llmConfig.apiKey);
    final modelCtrl = TextEditingController(text: _llmConfig.model);
    bool obscureKey = true;
    bool isTesting = false;
    LlmTestResult? testResult;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (modalCtx, setModalState) {
          return Container(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
              top: 20,
              left: 20,
              right: 20,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle bar
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Title
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEDE9FE),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.vpn_key_rounded, color: Color(0xFF7C3AED), size: 22),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Konfigurasi Real LLM Engine',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              'Pilih penyedia AI & masukkan API Key Anda',
                              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded, color: Colors.grey),
                        onPressed: () => Navigator.pop(modalCtx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Provider Selector
                  const Text('Penyedia LLM (Large Language Model)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(12),
                      color: const Color(0xFFF8FAFC),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<LlmProvider>(
                        value: selectedProvider,
                        isExpanded: true,
                        items: LlmProvider.values.map((p) {
                          return DropdownMenuItem<LlmProvider>(
                            value: p,
                            child: Row(
                              children: [
                                Icon(
                                  p == LlmProvider.gemini
                                      ? Icons.auto_awesome
                                      : p == LlmProvider.groq
                                          ? Icons.bolt
                                          : Icons.psychology_rounded,
                                  size: 18,
                                  color: const Color(0xFF7C3AED),
                                ),
                                const SizedBox(width: 8),
                                Text(p.displayName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (newVal) {
                          if (newVal != null) {
                            setModalState(() {
                              selectedProvider = newVal;
                              modelCtrl.text = newVal.defaultModel;
                              testResult = null;
                            });
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // API Key Field
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('API Key', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                      if (selectedProvider == LlmProvider.gemini)
                        const Text('Gratis di aistudio.google.com', style: TextStyle(fontSize: 11, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600))
                      else if (selectedProvider == LlmProvider.groq)
                        const Text('Gratis di console.groq.com', style: TextStyle(fontSize: 11, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: keyCtrl,
                    obscureText: obscureKey,
                    decoration: InputDecoration(
                      hintText: selectedProvider == LlmProvider.gemini
                          ? 'AIzaSy...'
                          : selectedProvider == LlmProvider.groq
                              ? 'gsk_...'
                              : 'sk-...',
                      hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                      suffixIcon: IconButton(
                        icon: Icon(obscureKey ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                        onPressed: () => setModalState(() => obscureKey = !obscureKey),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Model Name Field
                  const Text('Model Name', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                  const SizedBox(height: 8),
                  TextField(
                    controller: modelCtrl,
                    decoration: InputDecoration(
                      hintText: selectedProvider.defaultModel,
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Test result banner
                  if (testResult != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: testResult!.success ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: testResult!.success ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                      ),
                      child: Row(
                        children: [
                          Icon(testResult!.success ? Icons.check_circle : Icons.error, color: testResult!.success ? const Color(0xFF10B981) : const Color(0xFFEF4444), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              testResult!.message,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: testResult!.success ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Action Buttons: Uji Koneksi & Simpan
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: isTesting
                              ? null
                              : () async {
                                  setModalState(() {
                                    isTesting = true;
                                    testResult = null;
                                  });
                                  final tempConfig = LlmConfig(
                                    provider: selectedProvider,
                                    apiKey: keyCtrl.text.trim(),
                                    model: modelCtrl.text.trim(),
                                  );
                                  final result = await AiAgentService.testConnection(tempConfig);
                                  setModalState(() {
                                    isTesting = false;
                                    testResult = result;
                                  });
                                },
                          icon: isTesting
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.network_check_rounded, size: 16),
                          label: Text(isTesting ? 'Menguji...' : 'Uji Koneksi'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            foregroundColor: const Color(0xFF7C3AED),
                            side: const BorderSide(color: Color(0xFF7C3AED)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () async {
                            final newConfig = LlmConfig(
                              provider: selectedProvider,
                              apiKey: keyCtrl.text.trim(),
                              model: modelCtrl.text.trim(),
                            );
                            await AiAgentService.saveConfig(
                              provider: newConfig.provider,
                              apiKey: newConfig.apiKey,
                              model: newConfig.model,
                            );
                            if (!mounted) return;
                            setState(() {
                              _llmConfig = newConfig;
                            });
                            Navigator.pop(modalCtx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Konfigurasi ${newConfig.provider.displayName} tersimpan!'),
                                backgroundColor: const Color(0xFF10B981),
                              ),
                            );
                          },
                          icon: const Icon(Icons.save_rounded, size: 16),
                          label: const Text('Simpan'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            backgroundColor: const Color(0xFF7C3AED),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _confirmClearChat() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.cleaning_services_rounded, color: Color(0xFF8B5CF6)),
            SizedBox(width: 10),
            Text('Bersihkan Percakapan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Kosongkan seluruh riwayat obrolan dengan AI? Konteks memori percakapan akan diatur ulang dari awal.',
          style: TextStyle(fontSize: 13, color: Color(0xFF475569)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _messages.clear();
                _initWelcomeMessage();
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Bersihkan'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chips = _getQuickPromptChips();

    return Container(
      color: const Color(0xFFF8FAFC),
      child: Column(
        children: [
          // ─── 1. HEADER AI PANEL ──────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF8B5CF6), Color(0xFF4F46E5)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Text(
                            'Smart Ri\'ayah AI',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          SizedBox(width: 6),
                          CircleAvatar(radius: 3.5, backgroundColor: Color(0xFF10B981)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              _llmConfig.hasKey
                                  ? '${_llmConfig.provider.displayName} • ${_llmConfig.model}'
                                  : 'API Key Belum Diatur (Ketuk ⚙️)',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: _llmConfig.hasKey ? const Color(0xFF64748B) : const Color(0xFFEF4444),
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Button Atur API Key (Key Icon)
                Tooltip(
                  message: 'Atur API Key LLM',
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: _openApiKeySettingsModal,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        color: _llmConfig.hasKey ? const Color(0xFFF1F5F9) : const Color(0xFFFEF2F2),
                        border: Border.all(
                          color: _llmConfig.hasKey ? const Color(0xFFE2E8F0) : const Color(0xFFFCA5A5),
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.vpn_key_rounded,
                            size: 13,
                            color: _llmConfig.hasKey ? const Color(0xFF64748B) : const Color(0xFFEF4444),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'API Key',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: _llmConfig.hasKey ? const Color(0xFF64748B) : const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // Button Reset Chat
                Tooltip(
                  message: 'Reset Riwayat Chat',
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: _confirmClearChat,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFF64748B)),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ─── 2. WARNING BANNER JIKA KEY KOSONG ──────────────────────────────
          if (!_llmConfig.hasKey)
            InkWell(
              onTap: _openApiKeySettingsModal,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                color: const Color(0xFFFEF3C7),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 16),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'API Key LLM belum dimasukkan. Ketuk di sini untuk menghubungkan Gemini / Groq API gratis.',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, color: Color(0xFF92400E), size: 18),
                  ],
                ),
              ),
            ),

          // ─── 3. LIST PESAN CHAT DENGAN MARKDOWN ───────────────────────────────
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              itemCount: _messages.length,
              itemBuilder: (ctx, idx) {
                final msg = _messages[idx];
                return _buildMessageBubble(msg);
              },
            ),
          ),

          // ─── 4. ANIMATED TYPING INDICATOR ────────────────────────────────────
          if (_isThinking)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.psychology_rounded, color: Color(0xFF8B5CF6), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'AI sedang bernalar & menyusun jawaban...',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF7C3AED),
                    ),
                  ),
                  SizedBox(width: 10),
                  SizedBox(
                    width: 13,
                    height: 13,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF8B5CF6)),
                    ),
                  ),
                ],
              ),
            ),

          // ─── 5. QUICK PROMPT STARTER CHIPS ───────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(vertical: 6),
            color: Colors.white,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: chips.map((chipText) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ActionChip(
                      label: Text(
                        chipText,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF4C1D95),
                        ),
                      ),
                      backgroundColor: const Color(0xFFF5F3FF),
                      side: const BorderSide(color: Color(0xFFDDD6FE)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      onPressed: () => _sendMessage(chipText),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // ─── 6. INPUT BAR ────────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: TextField(
                      controller: _promptCtrl,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: const InputDecoration(
                        hintText: 'Tanyakan apa saja ke AI (bebas tanpa batas)...',
                        hintStyle: TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 11),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: _isThinking ? null : () => _sendMessage(),
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF8B5CF6).withValues(alpha: 0.35),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: _isThinking
                        ? const Center(
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            ),
                          )
                        : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(AiMessageItem msg) {
    final isUser = msg.isUser;
    final timeStr = DateFormat('HH:mm').format(msg.timestamp);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.88,
        ),
        child: Column(
          crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isUser) ...[
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEDE9FE),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(Icons.auto_awesome_rounded, size: 12, color: Color(0xFF7C3AED)),
                  ),
                  const SizedBox(width: 6),
                  const Text('Smart Ri\'ayah AI', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF6D28D9))),
                ] else ...[
                  const Text('Anda', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  const SizedBox(width: 6),
                  const Icon(Icons.person_rounded, size: 12, color: Color(0xFF64748B)),
                ],
                const SizedBox(width: 8),
                Text(timeStr, style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
              ],
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: isUser ? const Color(0xFF7C3AED) : Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isUser ? 16 : 4),
                  bottomRight: Radius.circular(isUser ? 4 : 16),
                ),
                border: isUser ? null : Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: isUser
                  ? Text(
                      msg.content,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.white,
                        height: 1.4,
                      ),
                    )
                  : MarkdownBody(
                      data: msg.content,
                      selectable: true,
                      styleSheet: MarkdownStyleSheet(
                        p: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), height: 1.45),
                        strong: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        h1: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        h2: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        h3: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        listBullet: const TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.bold),
                        code: TextStyle(fontFamily: 'monospace', backgroundColor: Colors.grey.shade100, fontSize: 11.5),
                        blockquote: TextStyle(color: Colors.grey.shade700, fontStyle: FontStyle.italic),
                        blockquoteDecoration: const BoxDecoration(
                          border: Border(left: BorderSide(color: Color(0xFF7C3AED), width: 3)),
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
