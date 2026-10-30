import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase_config.dart';
import '../models/user_session_model.dart';
import '../services/notification_service.dart';
import '../services/supabase_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - WHATSAPP-STYLE LIVE CHAT WEBSOCKET COMPONENT
 * Channel Realtime Supabase: 'whatsapp-room' (Broadcast & Postgres Changes)
 * Fitur:
 * 1. Pesan Instan Real-Time (WebSocket Channel Broadcast & PostgreSQL Changes)
 * 2. Indikator Sent (✓) & Read (✓✓)
 * 3. Indikator "Sedang mengetik..." (Typing indicator via WebSocket)
 * 4. Emoji Reactions Bar (👍, ❤️, 🙏, 😢, ✅, 🤲) dengan counter di bubble
 * 5. Push Notification lokal (Heads-up banner dengan getaran & suara)
 * 6. Quick reply chips santri & wali
 * ============================================================================
 */

class ChatMessageItem {
  final String id;
  final String sender;
  final String senderRole;
  final String text;
  final DateTime timestamp;
  final bool isMe;
  bool isRead;
  Map<String, int> reactions; // e.g. {'👍': 1, '❤️': 2}

  ChatMessageItem({
    required this.id,
    required this.sender,
    required this.senderRole,
    required this.text,
    required this.timestamp,
    required this.isMe,
    this.isRead = false,
    Map<String, int>? reactions,
  }) : reactions = reactions ?? {};

  factory ChatMessageItem.fromMap(Map<String, dynamic> map, String currentUserName, {String? currentEmail}) {
    final senderEmail = map['sender_email']?.toString();
    final senderName = map['sender_name']?.toString() ?? map['sender']?.toString() ?? 'Pengguna';
    final isMe = (currentEmail != null && senderEmail != null && senderEmail.toLowerCase() == currentEmail.toLowerCase()) ||
                 (senderName.trim().toLowerCase() == currentUserName.trim().toLowerCase());
    
    DateTime time;
    if (map['created_at'] != null) {
      time = DateTime.tryParse(map['created_at'].toString()) ?? DateTime.now();
    } else if (map['timestamp'] != null) {
      time = DateTime.tryParse(map['timestamp'].toString()) ?? DateTime.now();
    } else {
      time = DateTime.now();
    }

    final Map<String, int> reactionMap = {};
    if (map['reactions'] is Map) {
      (map['reactions'] as Map).forEach((k, v) {
        reactionMap[k.toString()] = int.tryParse(v.toString()) ?? 1;
      });
    } else if (map['reaction'] != null && map['reaction'].toString().isNotEmpty && map['reaction'] != 'null') {
      reactionMap[map['reaction'].toString()] = 1;
    }

    return ChatMessageItem(
      id: map['id']?.toString() ?? 'MSG-${DateTime.now().millisecondsSinceEpoch}',
      sender: senderName,
      senderRole: map['sender_role']?.toString() ?? map['senderRole']?.toString() ?? 'Wali Santri',
      text: map['message_text']?.toString() ?? map['text']?.toString() ?? '',
      timestamp: time,
      isMe: isMe,
      isRead: map['is_read'] == true || map['isRead'] == true || isMe,
      reactions: reactionMap,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'sender': sender,
      'senderRole': senderRole,
      'text': text,
      'timestamp': timestamp.toIso8601String(),
      'isRead': isRead,
      'reactions': reactions,
    };
  }
}

class WhatsAppLiveChatView extends StatefulWidget {
  final UserSessionModel session;
  final String? customRecipientTitle;

  const WhatsAppLiveChatView({
    super.key,
    required this.session,
    this.customRecipientTitle,
  });

  @override
  State<WhatsAppLiveChatView> createState() => _WhatsAppLiveChatViewState();
}

class _WhatsAppLiveChatViewState extends State<WhatsAppLiveChatView> {
  final TextEditingController _textCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  RealtimeChannel? _chatChannel;

  final List<ChatMessageItem> _messages = [];
  String? _typingUserName;
  Timer? _typingTimer;
  Timer? _debounceTypingTimer;

  static const List<String> availableEmojis = ['👍', '❤️', '🙏', '😢', '✅', '🤲'];

  static const List<String> quickReplies = [
    'Assalamu\'alaikum Ustadz/Ustadzah',
    'Mohon konfirmasi izin kepulangan santri',
    'Bagaimana kondisi kesehatan anak kami?',
    'Alhamdulillah, terima kasih banyak pengurus.',
    'Izin menjemput ananda sore ini ba\'da Ashar.',
  ];

  @override
  void initState() {
    super.initState();
    _initDefaultConversation();
    _loadInitialMessages();
    _connectRealtimeChat();
  }

  Future<void> _loadInitialMessages() async {
    try {
      final dbMsgs = await SupabaseService.getMessagesList();
      if (mounted && dbMsgs.isNotEmpty) {
        setState(() {
          _messages.clear();
          for (final row in dbMsgs) {
            _messages.add(ChatMessageItem.fromMap(
              row,
              widget.session.namaLengkap,
              currentEmail: widget.session.email,
            ));
          }
        });
        _scrollToBottom();
      }
    } catch (e) {
      print('❌ [WhatsAppLiveChatView] Gagal mengambil riwayat pesan: $e');
    }
  }

  void _initDefaultConversation() {
    final now = DateTime.now();
    final role = widget.session.role;

    if (role == AppRole.wali) {
      _messages.addAll([
        ChatMessageItem(
          id: 'INIT-01',
          sender: 'Ust. M. Syukron, M.Pd.',
          senderRole: 'Musyrif Asrama Putra',
          text: 'Assalamu\'alaikum warahmatullah Bapak/Ibu Wali Santri. Layanan komunikasi asrama Smart Ri\'ayah siap membantu informasi santri.',
          timestamp: now.subtract(const Duration(hours: 2)),
          isMe: false,
          isRead: true,
          reactions: {'🙏': 1},
        ),
        ChatMessageItem(
          id: 'INIT-02',
          sender: widget.session.namaLengkap,
          senderRole: 'Wali Santri',
          text: 'Wa\'alaikumsalam Ustadz. Terima kasih atas bimbingannya untuk ananda selama di asrama.',
          timestamp: now.subtract(const Duration(minutes: 50)),
          isMe: true,
          isRead: true,
          reactions: {'❤️': 1},
        ),
      ]);
    } else {
      _messages.addAll([
        ChatMessageItem(
          id: 'INIT-01',
          sender: 'Hj. Siti Aminah',
          senderRole: 'Wali Santri (Ahmad Dahlan)',
          text: 'Assalamu\'alaikum Pengurus Ri\'ayah. Izin bertanya jadwal kepulangan santri akhir semester.',
          timestamp: now.subtract(const Duration(hours: 1)),
          isMe: false,
          isRead: true,
          reactions: {'🙏': 1},
        ),
        ChatMessageItem(
          id: 'INIT-02',
          sender: widget.session.namaLengkap,
          senderRole: widget.session.role.title,
          text: 'Wa\'alaikumsalam Ibu. Kepulangan santri semester ini dimulai hari Jumat pukul 14.00 WIB ba\'da Sholat Jumat.',
          timestamp: now.subtract(const Duration(minutes: 25)),
          isMe: true,
          isRead: true,
          reactions: {'👍': 1},
        ),
      ]);
    }
  }

  /// Menghubungkan ke Supabase Realtime Channel: 'whatsapp-room' & tabel 'messages'
  void _connectRealtimeChat() {
    try {
      _chatChannel = SupabaseConfig.client.channel('whatsapp-room');

      // 1. Dengarkan Pesan Masuk Realtime via Broadcast
      _chatChannel?.onBroadcast(
        event: 'whatsapp.incoming',
        callback: (payload) {
          if (!mounted) return;
          final msg = ChatMessageItem.fromMap(payload, widget.session.namaLengkap, currentEmail: widget.session.email);

          // Cek jika pesan bukan dari kita sendiri dan belum ada di list
          if (!msg.isMe) {
            final exists = _messages.any((m) => m.id == msg.id);
            if (!exists) {
              setState(() {
                _messages.add(msg);
              });
              _scrollToBottom();

              // Picu Push Notification lokal (Heads-up banner)
              NotificationService.showNotification(
                title: '💬 Pesan dari ${msg.sender} (${msg.senderRole})',
                body: msg.text,
                payload: 'chat:${msg.id}',
              );
            }
          }
        },
      );

      // 2. Dengarkan Status Mengetik Realtime (Typing Indicator)
      _chatChannel?.onBroadcast(
        event: 'whatsapp.typing',
        callback: (payload) {
          if (!mounted) return;
          final sender = payload['sender']?.toString();
          final isTyping = payload['isTyping'] == true;

          if (sender != null && sender != widget.session.namaLengkap) {
            setState(() {
              if (isTyping) {
                _typingUserName = sender;
                _typingTimer?.cancel();
                _typingTimer = Timer(const Duration(seconds: 3), () {
                  if (mounted) setState(() => _typingUserName = null);
                });
              } else {
                _typingUserName = null;
              }
            });
          }
        },
      );

      // 3. Dengarkan Reaksi Emoji Pesan Realtime via Broadcast
      _chatChannel?.onBroadcast(
        event: 'whatsapp.reaction',
        callback: (payload) {
          if (!mounted) return;
          final messageId = payload['messageId']?.toString();
          final emoji = payload['emoji']?.toString();
          final reactor = payload['user']?.toString() ?? 'Pengguna';

          if (messageId != null && emoji != null) {
            setState(() {
              final idx = _messages.indexWhere((m) => m.id == messageId);
              if (idx != -1) {
                final cur = _messages[idx].reactions[emoji] ?? 0;
                _messages[idx].reactions[emoji] = cur + 1;

                // Jika reaksi mengenai pesan kita sendiri, berikan push notifikasi!
                if (_messages[idx].isMe && reactor != widget.session.namaLengkap) {
                  NotificationService.showNotification(
                    title: '✨ Reaksi Pesan Baru',
                    body: '$reactor memberikan reaksi $emoji pada: "${_messages[idx].text}"',
                  );
                }
              }
            });
          }
        },
      );

      // 4. Dengarkan Perubahan Database PostgreSQL tabel public.messages
      _chatChannel?.onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'messages',
        callback: (payload) {
          if (!mounted) return;
          final newRecord = payload.newRecord;
          if (newRecord.isEmpty) return;

          final msgId = newRecord['id']?.toString();
          if (payload.eventType == PostgresChangeEvent.insert) {
            final msg = ChatMessageItem.fromMap(
              newRecord,
              widget.session.namaLengkap,
              currentEmail: widget.session.email,
            );
            final existingIdx = _messages.indexWhere((m) => m.id == msg.id);
            if (existingIdx == -1) {
              setState(() {
                _messages.add(msg);
              });
              _scrollToBottom();

              if (!msg.isMe) {
                NotificationService.showNotification(
                  title: '💬 Pesan dari ${msg.sender} (${msg.senderRole})',
                  body: msg.text,
                  payload: 'chat:${msg.id}',
                );
              }
            }
          } else if (payload.eventType == PostgresChangeEvent.update) {
            final existingIdx = _messages.indexWhere((m) => m.id == msgId);
            final reaction = newRecord['reaction']?.toString();
            final isRead = newRecord['is_read'] == true;
            if (existingIdx != -1) {
              setState(() {
                if (reaction != null && reaction.isNotEmpty && reaction != 'null') {
                  _messages[existingIdx].reactions[reaction] = (_messages[existingIdx].reactions[reaction] ?? 0) + 1;
                }
                _messages[existingIdx].isRead = isRead || _messages[existingIdx].isMe;
              });

              if (_messages[existingIdx].isMe && reaction != null && reaction.isNotEmpty && reaction != 'null') {
                NotificationService.showNotification(
                  title: '✨ Reaksi Pesan Baru',
                  body: 'Seseorang memberikan reaksi $reaction pada pesan Anda: "${_messages[existingIdx].text}"',
                );
              }
            }
          }
        },
      );

      _chatChannel?.subscribe();
      print('✅ [WhatsAppLiveChatView] Terhubung ke Supabase Realtime whatsapp-room & tabel messages.');
    } catch (e) {
      print('❌ [WhatsAppLiveChatView] Gagal subscribe realtime chat: $e');
    }
  }

  void _handleTypingChange(String val) {
    if (_debounceTypingTimer?.isActive ?? false) _debounceTypingTimer!.cancel();

    // Kirim event broadcast typing = true
    _chatChannel?.sendBroadcastMessage(
      event: 'whatsapp.typing',
      payload: {
        'sender': widget.session.namaLengkap,
        'isTyping': val.trim().isNotEmpty,
      },
    );

    // Otomatis matikan typing indicator setelah 2 detik tidak mengetik
    _debounceTypingTimer = Timer(const Duration(seconds: 2), () {
      _chatChannel?.sendBroadcastMessage(
        event: 'whatsapp.typing',
        payload: {
          'sender': widget.session.namaLengkap,
          'isTyping': false,
        },
      );
    });
  }

  /// Mengirim pesan chat instan via Database PostgreSQL & WebSocket Broadcast
  void _sendMessage([String? prefilledText]) {
    final text = prefilledText ?? _textCtrl.text.trim();
    if (text.isEmpty) return;

    final newId = 'MSG-${DateTime.now().millisecondsSinceEpoch}-${100 + (DateTime.now().microsecond % 900)}';
    final now = DateTime.now();

    final newMsg = ChatMessageItem(
      id: newId,
      sender: widget.session.namaLengkap,
      senderRole: widget.session.role.title,
      text: text,
      timestamp: now,
      isMe: true,
      isRead: false,
    );

    setState(() {
      _messages.add(newMsg);
      if (prefilledText == null) _textCtrl.clear();
    });

    _scrollToBottom();

    // 1. Simpan langsung ke PostgreSQL tabel public.messages
    SupabaseService.sendMessage(
      text: text,
      senderEmail: widget.session.email ?? '${widget.session.username}@pesantren.id',
      senderName: widget.session.namaLengkap,
      senderRole: widget.session.role.title,
    );

    // 2. Broadcast pesan via Supabase Realtime ke seluruh subscriber (Web & Mobile)
    _chatChannel?.sendBroadcastMessage(
      event: 'whatsapp.incoming',
      payload: newMsg.toMap(),
    );

    // 3. Stop status typing
    _chatChannel?.sendBroadcastMessage(
      event: 'whatsapp.typing',
      payload: {
        'sender': widget.session.namaLengkap,
        'isTyping': false,
      },
    );

    // Simulasi centang dua terbaca (read receipt) setelah delay singkat
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() {
          newMsg.isRead = true;
        });
      }
    });
  }

  /// Mengirim reaksi emoji terhadap pesan
  void _addReaction(ChatMessageItem msg, String emoji) {
    setState(() {
      final currentCount = msg.reactions[emoji] ?? 0;
      msg.reactions[emoji] = currentCount + 1;
    });

    // 1. Simpan reaksi ke tabel public.messages Supabase
    SupabaseService.updateMessageReaction(
      messageId: msg.id,
      reaction: emoji,
    );

    // 2. Broadcast reaksi via WebSocket Realtime
    _chatChannel?.sendBroadcastMessage(
      event: 'whatsapp.reaction',
      payload: {
        'messageId': msg.id,
        'emoji': emoji,
        'user': widget.session.namaLengkap,
      },
    );
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent + 100,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    _typingTimer?.cancel();
    _debounceTypingTimer?.cancel();
    if (_chatChannel != null) {
      SupabaseConfig.client.removeChannel(_chatChannel!);
    }
    super.dispose();
  }

  /// Menampilkan popup bar reaksi emoji saat bubble ditekan lama atau diklik ikon reaksi
  void _showReactionPicker(BuildContext context, ChatMessageItem msg) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 18,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Pilih Reaksi Emoji Cepat',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: availableEmojis.map((emoji) {
                  return InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () {
                      Navigator.pop(ctx);
                      _addReaction(msg, emoji);
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Text(
                        emoji,
                        style: const TextStyle(fontSize: 28),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final String partnerName = widget.customRecipientTitle ??
        (widget.session.role == AppRole.wali
            ? 'Layanan Pengasuhan Asrama'
            : 'Wali Santri & Musyrif Terpadu');

    return Container(
      color: const Color(0xFFF0FDF4).withValues(alpha: 0.35),
      child: Column(
        children: [
          // 1. HEADER CHAT ALA WHATSAPP
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              children: [
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: const Color(0xFF047857).withValues(alpha: 0.12),
                      child: const Icon(Icons.forum_rounded, color: Color(0xFF047857), size: 22),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 11,
                        height: 11,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        partnerName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      if (_typingUserName != null)
                        Row(
                          children: [
                            const SizedBox(
                              width: 10,
                              height: 10,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF047857),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '$_typingUserName sedang mengetik...',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF047857),
                              ),
                            ),
                          ],
                        )
                      else
                        const Row(
                          children: [
                            CircleAvatar(radius: 3, backgroundColor: Color(0xFF10B981)),
                            SizedBox(width: 5),
                            Text(
                              'Online • Siap Melayani',
                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Aktif',
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF047857),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. LIST PESAN CHAT
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

          // 3. QUICK REPLY SUGGESTIONS
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: quickReplies.map((reply) {
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ActionChip(
                    label: Text(
                      reply,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF047857)),
                    ),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: Color(0xFFA7F3D0)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    onPressed: () => _sendMessage(reply),
                  ),
                );
              }).toList(),
            ),
          ),

          // 4. INPUT BAR ALA WHATSAPP
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: SafeArea(
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.sentiment_satisfied_alt_rounded, color: Color(0xFF64748B)),
                    tooltip: 'Emoji',
                    onPressed: () {
                      _textCtrl.text += ' 😊';
                    },
                  ),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: TextField(
                        controller: _textCtrl,
                        onChanged: _handleTypingChange,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _sendMessage(),
                        decoration: const InputDecoration(
                          hintText: 'Ketik pesan...',
                          hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => _sendMessage(),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF047857), Color(0xFF065F46)],
                        ),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Komponen Bubble Chat dengan Reaction Anchor & Long Press Reaction Picker
  Widget _buildMessageBubble(ChatMessageItem msg) {
    final isMe = msg.isMe;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            CircleAvatar(
              radius: 14,
              backgroundColor: const Color(0xFFE2E8F0),
              child: Text(
                msg.sender.isNotEmpty ? msg.sender[0].toUpperCase() : '?',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
              ),
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: () => _showReactionPicker(context, msg),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                    decoration: BoxDecoration(
                      color: isMe ? const Color(0xFF047857) : Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft: isMe ? const Radius.circular(16) : Radius.zero,
                        bottomRight: isMe ? Radius.zero : const Radius.circular(16),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                      border: isMe ? null : Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        if (!isMe) ...[
                          Text(
                            '${msg.sender} • ${msg.senderRole}',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF047857),
                            ),
                          ),
                          const SizedBox(height: 3),
                        ],
                        Text(
                          msg.text,
                          style: TextStyle(
                            fontSize: 13,
                            color: isMe ? Colors.white : const Color(0xFF0F172A),
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _formatTime(msg.timestamp),
                              style: TextStyle(
                                fontSize: 9.5,
                                color: isMe ? Colors.white70 : const Color(0xFF94A3B8),
                              ),
                            ),
                            if (isMe) ...[
                              const SizedBox(width: 4),
                              Icon(
                                msg.isRead ? Icons.done_all_rounded : Icons.check_rounded,
                                size: 14,
                                color: msg.isRead ? const Color(0xFF6EE7B7) : Colors.white70,
                              ),
                            ],
                          ],
                        ),
                        if (msg.reactions.isNotEmpty) const SizedBox(height: 10),
                      ],
                    ),
                  ),

                  // ANCHORED REACTION PILL (Pojok bawah gelembung pesan)
                  if (msg.reactions.isNotEmpty)
                    Positioned(
                      bottom: -8,
                      right: isMe ? 4 : null,
                      left: isMe ? null : 4,
                      child: GestureDetector(
                        onTap: () => _showReactionPicker(context, msg),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.08),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: msg.reactions.entries.map((e) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 2),
                                child: Text(
                                  '${e.key}${e.value > 1 ? " ${e.value}" : ""}',
                                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (isMe) ...[
            const SizedBox(width: 6),
            CircleAvatar(
              radius: 14,
              backgroundColor: const Color(0xFF047857),
              child: Text(
                widget.session.namaLengkap.isNotEmpty ? widget.session.namaLengkap[0].toUpperCase() : 'A',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

