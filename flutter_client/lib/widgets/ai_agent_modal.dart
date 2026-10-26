import 'package:flutter/material.dart';

class AiAgentModal extends StatefulWidget {
  final String namaSantri;
  final String roleUser;

  const AiAgentModal({
    super.key,
    this.namaSantri = 'Nurmiyaty',
    this.roleUser = 'Musyrif',
  });

  static void show(BuildContext context, {String namaSantri = 'Nurmiyaty', String roleUser = 'Musyrif'}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => AiAgentModal(namaSantri: namaSantri, roleUser: roleUser),
    );
  }

  @override
  State<AiAgentModal> createState() => _AiAgentModalState();
}

class _AiAgentModalState extends State<AiAgentModal> {
  final TextEditingController _promptCtrl = TextEditingController();
  bool _isAnalyzing = false;

  final List<Map<String, String>> _chatHistory = [
    {
      'role': 'ai',
      'content': 'Assalamu\'alaikum. Saya Smart Riayah AI Agent (DeepSeek & Diagram DSS). Saya siap menganalisis kepatuhan jam malam, poin disiplin, mutaba\'ah sholat, serta tren perizinan santri.',
    },
    {
      'role': 'ai',
      'content': '📊 Ringkasan Cepat Nurmiyaty (NIS: 125460):\n• Status: Di Asrama (Kamar Khadijah RF-103)\n• Poin Disiplin: 100 Pts (Mumtaz)\n• RFID Kartu: Aktif (UID: 73:E2:4F:9A)\n• Rekomendasi: Kepatuhan adab dan ibadah sangat istiqomah. Layak diberikan apresiasi santri teladan pekan ini.',
    },
  ];

  void _runAiPrompt(String prompt) {
    if (prompt.trim().isEmpty) return;

    setState(() {
      _chatHistory.add({'role': 'user', 'content': prompt});
      _isAnalyzing = true;
    });
    _promptCtrl.clear();

    Future.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;

      String aiResponse;
      final lower = prompt.toLowerCase();

      if (lower.contains('nurmiyaty') || lower.contains('kepatuhan')) {
        aiResponse = '✨ Analisis Holistik Ananda Nurmiyaty:\n'
            '1. Presensi Sholat 5 Waktu: 100% Berjamaah di Masjid\n'
            '2. Jam Malam: Tidak pernah terlambat tap gate (rata-rata kembali 45 menit sebelum batas waktu)\n'
            '3. Saldo RFID: Rp 185.000 (Konsumsi kantin sehat dan terkontrol)\n'
            '4. Prediksi AI: Peluang pelanggaran < 1.2% (Tingkat risiko: Sangat Rendah).';
      } else if (lower.contains('izin') || lower.contains('pulang')) {
        aiResponse = '📈 Prediksi Dinamika Izin Akhir Pekan:\n'
            '• Total Izin Diperkirakan: 32 Santri Pesiar & 19 Pulang Bermalam\n'
            '• Puncak Keluar Gerbang: Jum\'at 16:30 - 17:30 WIB\n'
            '• Rekomendasi Satpam Gate: Buka Gate 01 RFID & Siagakan Barcode Scanner Cadangan.';
      } else if (lower.contains('tahfidz') || lower.contains('adab')) {
        aiResponse = '📖 Evaluasi Tahfidz & Karakter:\n'
            '• Nurmiyaty telah menuntaskan setoran Juz 29 & 30 dengan predikat Mutqin.\n'
            '• Adab asrama: Santun terhadap Musyrifah dan teman sekamar.';
      } else {
        aiResponse = '🤖 Jawaban Smart Riayah AI:\n'
            'Berdasarkan data real-time database pesantren untuk query "$prompt", seluruh indikator sistem perizinan Gate IoT dan monitoring santri dalam kondisi prima dan sinkron dengan server.';
      }

      setState(() {
        _chatHistory.add({'role': 'ai', 'content': aiResponse});
        _isAnalyzing = false;
      });
    });
  }

  @override
  void dispose() {
    _promptCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.82,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1.5)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF059669),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.auto_awesome, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Smart Riayah AI Agent',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        'Asisten Cerdas Evaluasi & Prediksi Santri',
                        style: TextStyle(color: Color(0xFF059669), fontSize: 11, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          const Divider(color: Color(0xFFE2E8F0), height: 1),

          // Chat Area
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _chatHistory.length,
              itemBuilder: (ctx, idx) {
                final item = _chatHistory[idx];
                final isAi = item['role'] == 'ai';
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isAi ? const Color(0xFFF1F5F9) : const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isAi ? const Color(0xFFE2E8F0) : const Color(0xFFA7F3D0),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isAi ? Icons.auto_awesome : Icons.person,
                            size: 13,
                            color: isAi ? const Color(0xFF059669) : const Color(0xFF065F46),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isAi ? 'Smart Riayah AI' : 'Anda',
                            style: TextStyle(
                              color: isAi ? const Color(0xFF059669) : const Color(0xFF065F46),
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item['content']!,
                        style: TextStyle(
                          color: isAi ? const Color(0xFF0F172A) : const Color(0xFF065F46),
                          fontSize: 12.5,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          if (_isAnalyzing)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: const Row(
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF059669)),
                  ),
                  SizedBox(width: 10),
                  Text(
                    'AI sedang menganalisis data real-time...',
                    style: TextStyle(color: Color(0xFF059669), fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),

          // Quick Prompt Pills
          Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _buildPromptChip('Analisis Kepatuhan Nurmiyaty'),
                _buildPromptChip('Prediksi Kepulangan Akhir Pekan'),
                _buildPromptChip('Evaluasi Tahfidz & Adab'),
                _buildPromptChip('Cek Anomali Gate Gerbang'),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Input field
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _promptCtrl,
                    style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Tanyakan sesuatu ke AI...',
                      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFFF1F5F9),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xFF059669)),
                      ),
                    ),
                    onSubmitted: _runAiPrompt,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFF059669),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.arrow_upward, color: Colors.white, size: 20),
                    onPressed: () => _runAiPrompt(_promptCtrl.text),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPromptChip(String text) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        onPressed: () => _runAiPrompt(text),
        backgroundColor: Colors.white,
        side: const BorderSide(color: Color(0xFFCBD5E1)),
        label: Text(
          text,
          style: const TextStyle(color: Color(0xFF334155), fontSize: 10.5, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
