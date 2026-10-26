import 'package:flutter/material.dart';

class ChatMessage {
  final String text;
  final bool isFromAdmin;
  final DateTime time;

  ChatMessage({
    required this.text,
    required this.isFromAdmin,
    required this.time,
  });
}

class ChatAdminRiayahScreen extends StatefulWidget {
  final String namaPengirim;
  final String namaSantri;

  const ChatAdminRiayahScreen({
    super.key,
    this.namaPengirim = 'Wali Santri Nurmiyaty',
    this.namaSantri = 'Nurmiyaty',
  });

  @override
  State<ChatAdminRiayahScreen> createState() => _ChatAdminRiayahScreenState();
}

class _ChatAdminRiayahScreenState extends State<ChatAdminRiayahScreen> {
  final TextEditingController _msgCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  bool _isTyping = false;

  // Vue Design Palette
  static const Color vueGreen = Color(0xFF42B883);
  static const Color vueDark = Color(0xFF35495E);
  static const Color vueMint = Color(0xFFE8F8F1);
  static const Color vueSurface = Color(0xFFF8FAFC);
  static const Color vueBorder = Color(0xFFE2E8F0);

  final List<ChatMessage> _messages = [
    ChatMessage(
      text: 'Assalamu\'alaikum warahmatullah. Selamat datang di Layanan Informasi Smart Ri\'ayah Asrama.',
      isFromAdmin: true,
      time: DateTime.now().subtract(const Duration(minutes: 45)),
    ),
    ChatMessage(
      text: 'Ada yang bisa kami bantu terkait perizinan, mutaba\'ah, atau kartu RFID santri?',
      isFromAdmin: true,
      time: DateTime.now().subtract(const Duration(minutes: 44)),
    ),
    ChatMessage(
      text: 'Assalamu\'alaikum Ustdzh, saya ingin konfirmasi perizinan ananda Nurmiyaty untuk kepulangan akhir pekan ini.',
      isFromAdmin: false,
      time: DateTime.now().subtract(const Duration(minutes: 20)),
    ),
    ChatMessage(
      text: 'Wa\'alaikumsalam Ibu. Baik, data izin ananda Nurmiyaty sudah kami terima dan sudah diverifikasi Musyrif. Kartu RFID ananda siap di-tap saat gerbang dibuka ya bu.',
      isFromAdmin: true,
      time: DateTime.now().subtract(const Duration(minutes: 18)),
    ),
  ];

  void _sendMessage([String? textToSend]) {
    final text = textToSend ?? _msgCtrl.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _messages.add(ChatMessage(
        text: text,
        isFromAdmin: false,
        time: DateTime.now(),
      ));
      _isTyping = true;
    });
    _msgCtrl.clear();

    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });

    // Auto-reply reaktif dari Admin Ri'ayah dengan status typing
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      setState(() {
        _isTyping = false;
        _messages.add(ChatMessage(
          text: 'Terima kasih atas informasinya. Pesan Anda telah tercatat di sistem Smart Ri\'ayah Asrama untuk ananda ${widget.namaSantri}. Barokallahu fiikum.',
          isFromAdmin: true,
          time: DateTime.now(),
        ));
      });
      Future.delayed(const Duration(milliseconds: 100), () {
        if (_scrollCtrl.hasClients) {
          _scrollCtrl.animateTo(
            _scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    });
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: vueSurface,
      appBar: AppBar(
        backgroundColor: vueGreen,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: vueDark.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.terminal_rounded, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Admin Ri\'ayah',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: vueDark,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Vue 3 View',
                          style: TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const Row(
                    children: [
                      Icon(Icons.circle, color: Color(0xFFD1FAE5), size: 7),
                      SizedBox(width: 4),
                      Text(
                        'v-model:connected • Reactive Online',
                        style: TextStyle(color: Color(0xFFE8F8F1), fontSize: 10),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Banner Vue Reactive State resmi
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: vueBorder)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.code_rounded, color: vueGreen, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      'v-bind:santri="${widget.namaSantri}"',
                      style: const TextStyle(
                        color: vueDark,
                        fontSize: 11.5,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: vueMint,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: vueGreen.withValues(alpha: 0.3)),
                  ),
                  child: const Text(
                    'WhatsApp Gateway Ready',
                    style: TextStyle(color: vueDark, fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

          // Messages List
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (ctx, idx) {
                final msg = _messages[idx];
                return _buildVueChatBubble(msg);
              },
            ),
          ),

          // Realtime typing indicator
          if (_isTyping)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              alignment: Alignment.centerLeft,
              child: Row(
                children: [
                  const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(color: vueGreen, strokeWidth: 2),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Ustadzah sedang mengetik balasan... (v-if="isTyping")',
                    style: TextStyle(color: vueDark.withValues(alpha: 0.7), fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),

          // Quick Vue Action Chips
          Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _buildVueChip('@click="Tanya Status Izin"'),
                _buildVueChip('@click="Konfirmasi Penjemputan"'),
                _buildVueChip('@click="Cek Saldo RFID"'),
                _buildVueChip('@click="Kondisi Kesehatan"'),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Vue-style Reactive Input Bar
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: vueBorder)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _msgCtrl,
                    style: const TextStyle(color: vueDark, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Ketik pesan ke Admin... (v-model="msg")',
                      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFFF1F5F9),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: vueBorder),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: vueBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: vueGreen, width: 1.6),
                      ),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: const BoxDecoration(
                    color: vueGreen,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white, size: 18),
                    onPressed: () => _sendMessage(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVueChip(String text) {
    final cleanAction = text.replaceAll('@click="', '').replaceAll('"', '');
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        onPressed: () => _sendMessage(cleanAction),
        backgroundColor: Colors.white,
        side: const BorderSide(color: vueBorder),
        label: Text(
          text,
          style: const TextStyle(
            color: vueDark,
            fontSize: 10.5,
            fontFamily: 'monospace',
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildVueChatBubble(ChatMessage msg) {
    final isAdmin = msg.isFromAdmin;
    return Align(
      alignment: isAdmin ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isAdmin ? Colors.white : vueGreen,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isAdmin ? 2 : 16),
            bottomRight: Radius.circular(isAdmin ? 16 : 2),
          ),
          border: Border.all(
            color: isAdmin ? vueBorder : vueGreen,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: isAdmin ? CrossAxisAlignment.start : CrossAxisAlignment.end,
          children: [
            if (isAdmin)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: vueGreen,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Text(
                      'Admin Ri\'ayah (v-component)',
                      style: TextStyle(
                        color: Color(0xFF64748B),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            Text(
              msg.text,
              style: TextStyle(
                color: isAdmin ? vueDark : Colors.white,
                fontSize: 13,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${msg.time.hour.toString().padLeft(2, '0')}:${msg.time.minute.toString().padLeft(2, '0')}',
                  style: TextStyle(
                    color: isAdmin ? const Color(0xFF94A3B8) : Colors.white70,
                    fontSize: 9,
                  ),
                ),
                if (!isAdmin) ...[
                  const SizedBox(width: 4),
                  const Icon(Icons.done_all, color: Colors.white, size: 12),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
