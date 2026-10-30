import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/user_session_model.dart';
import '../models/santri_model.dart';
import '../models/room_model.dart';
import '../models/permit_model.dart';
import '../services/ai_agent_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - AI SMART ASSISTANT (AI AGENT) COMPONENT
 * Fitur:
 * 1. Live Data Context Injection (Santri, Kamar, Perizinan, Kesehatan & Dompet)
 * 2. Role-Aware Assistant (Wali, Admin, Musyrif, Medis UKS, Satpam, Mudir)
 * 3. Quick Action Chips (Tombol Aksi Cepat Sesuai Role)
 * 4. Animasi Typing Indicator Responsif & Halus
 * 5. Tampilan Pesan Markdown Rapi (Bold, Bullet List, Badge Highlight)
 * 6. Fitur "Bersihkan Riwayat Chat"
 * 7. Smooth Auto-Scroll Controller
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

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _initWelcomeMessage();
  }

  @override
  void dispose() {
    _promptCtrl.dispose();
    _scrollCtrl.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  void _initWelcomeMessage() {
    final role = widget.session.role;
    String greeting;

    if (role == AppRole.wali) {
      final child = widget.santriList.firstWhere(
        (s) => s.id == widget.session.santriId || s.namaLengkap.toLowerCase().contains('fauzi'),
        orElse: () => widget.santriList.isNotEmpty ? widget.santriList.first : SantriModel(
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

Saya adalah **Smart Ri'ayah AI Agent**, asisten cerdas pemantauan ananda **${child.namaLengkap}** di Pesantren Modern Darul Ulum.

Saya dapat memberikan informasi real-time mengenai:
• Status keberadaan & kegiatan harian ananda
• Sisa saldo Dompet Pintar RFID & riwayat jajan
• Status persetujuan surat izin pulang & cara perpanjangan liburan
• Catatan mutaba'ah sholat di masjid & tahfidz Al-Qur'an

Silakan klik tombol pertanyaan cepat di bawah atau ketikkan pertanyaan Anda.''';
    } else if (role == AppRole.adminRiayah || role == AppRole.superAdmin) {
      greeting = '''
Assalamu'alaikum **${widget.session.namaLengkap}** (${widget.session.role.title}).

Sistem cerdas AI Agent telah memuat data operasional pondok secara real-time:
• Total Santri: **${widget.santriList.length} santri**
• Total Kamar: **${widget.roomsList.length} kamar**
• Status Antrean Izin: **${widget.permitsList.where((p) => p.isPending).length} pengajuan pending**

Silakan tanyakan ringkasan kuota asrama, santri yang sedang di luar gerbang, atau persetujuan perpanjangan liburan.''';
    } else if (role == AppRole.musyrif) {
      greeting = '''
Assalamu'alaikum Ustadz **${widget.session.namaLengkap}** (Musyrif Pengasuhan Asrama).

AI Agent siap membantu pengawasan kamar binaan, rekap presensi malam asrama, dan evaluasi poin adab/pelanggaran santri secara instan.''';
    } else if (role == AppRole.poskestren) {
      greeting = '''
Assalamu'alaikum Tim Medis Poskestren **${widget.session.namaLengkap}**.

AI Agent aktif sebagai asisten triase dan SOP pertolongan pertama kesehatan santri. Anda dapat memantau santri yang dirawat inap di UKS atau menanyakan panduan klinis pertolongan pertama.''';
    } else if (role == AppRole.security) {
      greeting = '''
Selamat bertugas, Komandan **${widget.session.namaLengkap}** (Pos Keamanan Gate).

AI Agent siap membantu verifikasi validitas tiket DU-PERMIT santri, mendeteksi santri yang overstay/terlambat kembali, dan protokol keamanan gerbang asrama.''';
    } else if (role == AppRole.mudir) {
      greeting = '''
Assalamu'alaikum Kyai / Mudir Ma'had **${widget.session.namaLengkap}**.

AI Agent siap menyajikan *Executive Decision Summary* pondok mencakup indeks kehadiran santri, rasio okupansi kasur asrama, dan evaluasi kedisiplinan holistik.''';
    } else {
      greeting = '''
Assalamu'alaikum **${widget.session.namaLengkap}**. Smart Ri'ayah AI Agent siap membantu Anda dengan informasi data santri dan asrama secara real-time.''';
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
          '📍 Cek Status & Posisi Anak',
          '💳 Info Saldo & Jajan',
          '📝 Status Izin Pulang',
          '⏳ Cara Perpanjang Liburan',
          '🕌 Mutaba\'ah Sholat & Tahfidz',
          '📋 Aturan Jam Malam Pondok',
        ];
      case AppRole.adminRiayah:
      case AppRole.superAdmin:
        return [
          '📊 Ringkasan Kuota Asrama',
          '🛏️ Daftar Kamar Kosong',
          '🚖 Santri Sedang Izin Keluar',
          '📝 Rekap Izin Perlu Approval',
          '👥 Total Statistik Santri',
        ];
      case AppRole.musyrif:
        return [
          '🌙 Presensi Malam Asrama',
          '📋 Santri Belum Kembali',
          '⭐ Evaluasi Poin Adab',
          '🚪 Santri Kamar Binaan',
        ];
      case AppRole.poskestren:
        return [
          '🩺 Daftar Santri Sakit',
          '🌡️ Pertolongan Pertama Demam',
          '💊 Pertolongan Pertama Maag',
          '🏥 Prosedur Rujukan Medis',
        ];
      case AppRole.security:
        return [
          '🔍 Cek Validitas DU-PERMIT',
          '⏰ Santri Overdue / Terlambat',
          '🚪 Prosedur Jam Malam Gerbang',
        ];
      case AppRole.mudir:
        return [
          '📈 Executive Summary Hari Ini',
          '👥 Rasio Okupansi Asrama',
          '🛡️ Kedisiplinan & Kepatuhan',
          '📖 Capaian Tahfidz Global',
        ];
      default:
        return [
          '📍 Status Santri Hari Ini',
          '🛏️ Kuota Kamar Asrama',
          '📝 Rekap Izin Keluar',
        ];
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent + 120,
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

    try {
      final aiReply = await AiAgentService.generateAiResponse(
        prompt: text,
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
            content: 'Terjadi sedikit kendala koneksi. Namun sistem tetap dapat memberikan ringkasan status santri secara aman.',
            timestamp: DateTime.now(),
          ));
          _isThinking = false;
        });
        _scrollToBottom();
      }
    }
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
            Text('Bersihkan Riwayat Chat', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Apakah Anda yakin ingin mengosongkan seluruh percakapan AI Assistant? Pesan sambutan akan ditampilkan kembali.',
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
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                      colors: [Color(0xFF8B5CF6), Color(0xFF047857)],
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
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Text(
                            'Smart Ri\'ayah AI Agent',
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
                      Text(
                        'Live Data Context • ${widget.session.role.title}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                Tooltip(
                  message: 'Bersihkan Riwayat Chat',
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: _confirmClearChat,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.cleaning_services_rounded, size: 14, color: Color(0xFF64748B)),
                          SizedBox(width: 4),
                          Text('Reset', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ─── 2. LIST PESAN CHAT ──────────────────────────────────────────────
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

          // ─── 3. ANIMATED TYPING INDICATOR ────────────────────────────────────
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
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.auto_awesome_rounded, color: Color(0xFF8B5CF6), size: 16),
                  const SizedBox(width: 8),
                  const Text(
                    'AI Ri\'ayah sedang menganalisis data live...',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF7C3AED),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(const Color(0xFF8B5CF6)),
                    ),
                  ),
                ],
              ),
            ),

          // ─── 4. QUICK PROMPT ACTION CHIPS ────────────────────────────────────
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
                          fontWeight: FontWeight.bold,
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

          // ─── 5. INPUT BAR ────────────────────────────────────────────────────
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
                        hintText: 'Tanyakan data santri, izin, atau kamar...',
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
                        colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
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
          maxWidth: MediaQuery.of(context).size.width * 0.86,
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
                  const Text('AI Ri\'ayah', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF6D28D9))),
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
              child: _buildRichTextContent(msg.content, isUser),
            ),
          ],
        ),
      ),
    );
  }

  /// Parser teks rapi untuk memformat bold (**...**), bullet points, dan baris teks
  Widget _buildRichTextContent(String content, bool isUser) {
    final lines = content.split('\n');
    final textColor = isUser ? Colors.white : const Color(0xFF0F172A);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.map((line) {
        if (line.trim().isEmpty) {
          return const SizedBox(height: 6);
        }

        // Parse format bold **teks**
        final spans = <TextSpan>[];
        final parts = line.split('**');

        for (int i = 0; i < parts.length; i++) {
          final isBold = i % 2 == 1;
          spans.add(
            TextSpan(
              text: parts[i],
              style: TextStyle(
                fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
                color: textColor,
                fontSize: 12.5,
                height: 1.4,
              ),
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: RichText(
            text: TextSpan(children: spans),
          ),
        );
      }).toList(),
    );
  }
}

