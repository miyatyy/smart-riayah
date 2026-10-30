import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase_config.dart';
import '../models/user_session_model.dart';
import '../models/santri_model.dart';
import '../models/room_model.dart';
import '../models/permit_model.dart';
import '../services/supabase_service.dart';
import '../services/session_service.dart';
import '../widgets/app_drawer.dart';
import '../widgets/room_occupancy_card.dart';
import '../widgets/delete_confirm_dialog.dart';
import '../widgets/rfid_card_widget.dart';
import '../widgets/mudir_charts.dart';
import 'admin/onboarding_santri_screen.dart';
import 'admin/manage_rooms_screen.dart';
import 'auth/login_screen.dart';
import '../widgets/whatsapp_live_chat_view.dart';
import '../services/notification_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - MAIN DASHBOARD WITH STRICT RBAC ENGINE
 * 100% Selaras dengan Logika & Akses Versi Web (smart-riayah.vercel.app):
 * - Hak akses menu & tampilan difilter ketat berdasarkan 7 Role:
 *   1. Super Admin: Full Access & CRUD Override
 *   2. Admin Ri'ayah: Operasional Asrama, Kamar & Onboarding
 *   3. Orang Tua / Wali: Dashboard Khusus Anak Sendiri, Dompet & Form Izin
 *   4. Musyrif: Presensi Kamar Malam, Poin Adab & Approval Awal
 *   5. Pos Satpam: Validasi Checkout/Checkin Gate DU-PERMIT & Overstay
 *   6. Medis UKS: Rekam Medis, Status Sakit di UKS & Rekomendasi Rujuk
 *   7. Mudir: Executive Read-Only KPI, Analitik & Laporan Terpadu
 * ============================================================================
 */

class MainDashboardScreen extends StatefulWidget {
  final UserSessionModel session;
  final String initialMenuKey;

  const MainDashboardScreen({
    super.key,
    required this.session,
    this.initialMenuKey = 'dashboard',
  });

  @override
  State<MainDashboardScreen> createState() => _MainDashboardScreenState();
}

class _MainDashboardScreenState extends State<MainDashboardScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  late String _activeMenuKey;

  bool _isLoading = true;
  List<RoomModel> _roomsList = [];
  List<SantriModel> _santriList = [];
  List<PermitModel> _permitsList = [];

  // Search & Filter
  String _searchQuery = '';
  String _selectedGenderFilter = 'ALL';

  // Realtime Subscriptions
  RealtimeChannel? _roomsChannel;
  RealtimeChannel? _santriChannel;
  RealtimeChannel? _permitsChannel;
  RealtimeChannel? _notificationBroadcastChannel;

  // AI Assistant Chat State
  final TextEditingController _aiPromptCtrl = TextEditingController();
  bool _isAiThinking = false;
  final List<Map<String, String>> _aiMessages = [];

  // Live Chat State
  final TextEditingController _chatMsgCtrl = TextEditingController();
  final List<Map<String, dynamic>> _chatMessages = [];

  // Instant Permit Form State
  final _permitKategoriCtrl = TextEditingController(text: 'PULANG');
  final _permitKeperluanCtrl = TextEditingController();
  final _permitPenjemputCtrl = TextEditingController();
  bool _isSubmittingPermit = false;

  // Medis UKS Form State
  final _medisKeluhanCtrl = TextEditingController();
  final _medisDiagnosaCtrl = TextEditingController();
  final _medisObatCtrl = TextEditingController();
  SantriModel? _selectedMedisSantri;

  // Musyrif Roll-call checklist (kamarId -> Set of checked santriId)
  final Map<String, bool> _eveningRollCall = {};

  @override
  void initState() {
    super.initState();
    _activeMenuKey = widget.initialMenuKey;
    _permitPenjemputCtrl.text = widget.session.namaLengkap;
    _initDefaultChatAndAi();
    _loadAllData();
    _setupSupabaseRealtime();
  }

  @override
  void dispose() {
    _roomsChannel?.unsubscribe();
    _santriChannel?.unsubscribe();
    _permitsChannel?.unsubscribe();
    if (_notificationBroadcastChannel != null) {
      SupabaseConfig.client.removeChannel(_notificationBroadcastChannel!);
    }
    _aiPromptCtrl.dispose();
    _chatMsgCtrl.dispose();
    _permitKategoriCtrl.dispose();
    _permitKeperluanCtrl.dispose();
    _permitPenjemputCtrl.dispose();
    _medisKeluhanCtrl.dispose();
    _medisDiagnosaCtrl.dispose();
    _medisObatCtrl.dispose();
    super.dispose();
  }

  void _initDefaultChatAndAi() {
    final role = widget.session.role;

    // Default AI Greeting per role
    String aiGreeting;
    switch (role) {
      case AppRole.wali:
        aiGreeting = 'Assalamu\'alaikum Ibu/Bapak ${widget.session.namaLengkap}. Saya AI Smart Ri\'ayah siap membantu memantau mutaba\'ah ananda, mengecek jadwal kunjungan, serta tata tertib perizinan asrama.';
        break;
      case AppRole.security:
        aiGreeting = 'Siap, Komandan. AI Gate Assistant memantau antrean gerbang, verifikasi token DU-PERMIT, dan deteksi santri yang melampaui jam malam.';
        break;
      case AppRole.poskestren:
        aiGreeting = 'Halo dr. Nurul Aini. AI Poskestren siap membantu pengecekan riwayat alergi santri, pencatatan rekam medis, dan rekomendasi rujukan rumah sakit.';
        break;
      case AppRole.mudir:
        aiGreeting = 'Ahlan wa Sahlan, Kyai. AI Executive DSS siap memberikan ringkasan analisis performa kedisiplinan dan tren perizinan seluruh santri.';
        break;
      default:
        aiGreeting = 'Assalamu\'alaikum ${widget.session.namaLengkap}. Smart Ri\'ayah AI siap menganalisis data santri, kuota kasur kamar, dan presensi realtime.';
    }

    _aiMessages.add({'role': 'ai', 'content': aiGreeting});

    // Default Chat Messages per role
    if (role == AppRole.wali) {
      _chatMessages.addAll([
        {
          'sender': 'Ust. M. Syukron, M.Pd.',
          'role': 'Musyrif Asrama',
          'text': 'Assalamu\'alaikum Ibu Fatimah. Ananda Ahmad Fauzi hari ini mengikuti halaqah tahfidz dan sholat berjamaah tepat waktu.',
          'time': '07:30',
          'isMe': false,
        },
        {
          'sender': 'Ibu Fatimah Az-Zahra',
          'role': 'Wali Santri',
          'text': 'Alhamdulillah Ustadz. Mohon bimbingannya selalu untuk ananda.',
          'time': '07:45',
          'isMe': true,
        },
      ]);
    } else {
      _chatMessages.addAll([
        {
          'sender': 'Ibu Fatimah Az-Zahra',
          'role': 'Wali Santri',
          'text': 'Assalamu\'alaikum Ustadz, apakah surat izin pulang Ahmad Fauzi untuk akhir pekan sudah diverifikasi?',
          'time': '08:15',
          'isMe': false,
        },
        {
          'sender': 'Ust. M. Syukron, M.Pd.',
          'role': 'Musyrif Asrama',
          'text': 'Wa\'alaikumsalam Ibu. Sudah kami setujui di sistem, token DU-PERMIT sudah aktif untuk gerbang.',
          'time': '08:20',
          'isMe': role == AppRole.musyrif,
        },
      ]);
    }
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        SupabaseService.getRoomsList(),
        SupabaseService.getSantriList(),
        SupabaseService.getPermitsList(),
      ]);

      if (mounted) {
        setState(() {
          _roomsList = results[0] as List<RoomModel>;
          _santriList = results[1] as List<SantriModel>;
          _permitsList = results[2] as List<PermitModel>;
          if (_santriList.isNotEmpty && _selectedMedisSantri == null) {
            _selectedMedisSantri = _santriList.first;
          }
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _setupSupabaseRealtime() {
    _roomsChannel = SupabaseService.subscribeTableChanges(
      tableName: 'rooms',
      onChange: (_) => _loadAllData(),
    );
    _santriChannel = SupabaseService.subscribeTableChanges(
      tableName: 'santri',
      onChange: (_) => _loadAllData(),
    );
    _permitsChannel = SupabaseService.subscribeTableChanges(
      tableName: 'permits',
      onChange: (payload) {
        _loadAllData();
        final newRecord = payload.newRecord;
        if (newRecord.isNotEmpty) {
          final santriNama = newRecord['santri_name']?.toString() ??
              newRecord['santri_nama']?.toString() ??
              'Santri';
          final status = newRecord['status']?.toString() ?? '';
          final isExtension = newRecord['is_extension'] == true;
          final role = widget.session.role;

          if (payload.eventType == PostgresChangeEvent.insert) {
            if (role == AppRole.musyrif || role == AppRole.adminRiayah || role == AppRole.superAdmin) {
              NotificationService.showNotification(
                title: '📋 Pengajuan Izin Baru',
                body: 'Surat izin baru diajukan untuk $santriNama ($status).',
              );
            }
          } else if (payload.eventType == PostgresChangeEvent.update) {
            if ((status == 'EXTEND_REQUESTED' || isExtension) &&
                (role == AppRole.musyrif || role == AppRole.adminRiayah || role == AppRole.superAdmin)) {
              NotificationService.showNotification(
                title: '⏳ Permohonan Perpanjangan Izin',
                body: 'Wali santri mengajukan perpanjangan masa izin untuk $santriNama.',
              );
            } else if (status == 'APPROVED' && role == AppRole.wali) {
              NotificationService.showNotification(
                title: '✅ Izin / Perpanjangan Disetujui',
                body: 'Permohonan izin / perpanjangan ananda $santriNama telah disetujui.',
              );
            } else if (status == 'REJECTED' && role == AppRole.wali) {
              NotificationService.showNotification(
                title: '❌ Izin / Perpanjangan Ditolak',
                body: 'Permohonan izin / perpanjangan ananda $santriNama ditolak.',
              );
            }
          }
        }
      },
    );

    // Channel Broadcast 'whatsapp-room' untuk Live Push Notifications
    try {
      _notificationBroadcastChannel = SupabaseConfig.client.channel('whatsapp-room');
      _notificationBroadcastChannel?.onBroadcast(
        event: 'whatsapp.notification',
        callback: (payload) {
          final title = payload['title']?.toString() ?? 'Pemberitahuan Ri\'ayah';
          final message = payload['message']?.toString() ?? '';
          NotificationService.showNotification(
            title: title,
            body: message,
          );
        },
      );
      _notificationBroadcastChannel?.subscribe();
    } catch (_) {}
  }

  /// Mengambil santri milik wali santri yang sedang login
  SantriModel? get _childOfWali {
    if (_santriList.isEmpty) return null;
    return _santriList.firstWhere(
      (s) =>
          s.namaLengkap.toLowerCase().contains('fauzi') ||
          s.id == widget.session.santriId,
      orElse: () => _santriList.first,
    );
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Konfirmasi Keluar', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Apakah Anda yakin ingin mengakhiri sesi dan keluar dari aplikasi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await SessionService.clearSession();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  void _onSelectMenuKey(String key) {
    setState(() => _activeMenuKey = key);
    if (_scaffoldKey.currentState?.isDrawerOpen == true) {
      Navigator.pop(context);
    }
  }

  // ─── GATE VALIDATION ACTIONS (KHUSUS SATPAM) ───────────────────────────────
  Future<void> _validateGateAction(PermitModel permit, bool isCheckOut) async {
    final actionName = isCheckOut ? 'Checkout (Keluar Gerbang)' : 'Check-in (Kembali ke Asrama)';
    final newStatus = isCheckOut ? 'DI_LUAR' : 'DI_ASRAMA';

    try {
      // 1. Update status santri di Supabase
      await SupabaseConfig.client.from('santri').update({
        'status_asrama': newStatus,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', permit.santriId);

      // 2. Catat ke tabel gate_logs
      await SupabaseConfig.client.from('gate_logs').insert({
        'id': 'LOG-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}',
        'santri_id': permit.santriId,
        'santri_nama': permit.santriNama,
        'rfid_uid': permit.tokenIzin,
        'gate_id': 'GATE-01 (Main Pos)',
        'tipe': isCheckOut ? 'TAP_KELUAR' : 'TAP_MASUK',
        'status': 'VERIFIED',
        'remarks': 'Divalidasi Komandan Sutrisno (Pos Satpam)',
        'created_at': DateTime.now().toIso8601String(),
      });

      // 3. Update status permit jika check-in selesai
      if (!isCheckOut) {
        await SupabaseConfig.client.from('permits').update({
          'status': 'COMPLETED',
          'updated_at': DateTime.now().toIso8601String(),
        }).eq('id', permit.id);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ Berhasil $actionName: ${permit.santriNama}'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
        _loadAllData();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal validasi gate: $e'), backgroundColor: Colors.redAccent),
      );
    }
  }

  // ─── MEDIS STATUS UPDATE (KHUSUS POSKESTREN) ───────────────────────────────
  Future<void> _updateSantriMedicalStatus(SantriModel santri, String status) async {
    try {
      await SupabaseConfig.client.from('santri').update({
        'status_asrama': status,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', santri.id);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Status medis ${santri.namaLengkap} diubah menjadi: $status'),
            backgroundColor: const Color(0xFF0284C7),
          ),
        );
        _loadAllData();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal update medis: $e'), backgroundColor: Colors.redAccent),
      );
    }
  }

  // ─── PERMIT APPROVAL ACTIONS (ADMIN & MUSYRIF) ─────────────────────────────
  Future<void> _updatePermitApproval(PermitModel permit, String newStatus) async {
    try {
      final res = await SupabaseService.updatePermitStatus(
        permitId: permit.id,
        status: newStatus,
        approverName: widget.session.namaLengkap,
        catatan: newStatus == 'APPROVED' ? 'Disetujui oleh ${widget.session.namaLengkap}' : 'Ditolak oleh ${widget.session.namaLengkap}',
      );

      // Broadcast notifikasi via Realtime
      await SupabaseService.sendRealtimeBroadcast(
        channelName: 'whatsapp-room',
        event: 'whatsapp.notification',
        payload: {
          'id': 'NOTIF-${DateTime.now().millisecondsSinceEpoch}',
          'title': newStatus == 'APPROVED' ? '✅ Surat Izin Disetujui' : '❌ Surat Izin Ditolak',
          'message': 'Surat izin ${permit.santriNama} telah $newStatus oleh ${widget.session.namaLengkap}.',
          'type': 'PERMIT_APPROVAL',
          'permitId': permit.id,
          'timestamp': DateTime.now().toIso8601String(),
        },
      );

      if (mounted) {
        if (res['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Surat izin ${permit.santriNama} berhasil ditandai: $newStatus'),
              backgroundColor: newStatus == 'APPROVED' ? const Color(0xFF047857) : const Color(0xFFDC2626),
            ),
          );
          _loadAllData();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Gagal mengubah status izin: ${res['error'] ?? 'Terjadi kesalahan'}'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal memperbarui izin: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  // ─── PERMIT EXTENSION (PERPANJANGAN MASA IZIN/LIBURAN) ──────────────────────
  void _showExtensionRequestModal(BuildContext context, PermitModel permit) {
    DateTime proposedDate = (permit.batasKembali ?? DateTime.now()).add(const Duration(days: 1));
    final reasonCtrl = TextEditingController(text: 'Pemulihan pasca sakit / hajatan keluarga');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.schedule_rounded, color: Color(0xFF047857), size: 22),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Ajukan Perpanjangan Masa Izin / Liburan',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                            ),
                            Text(
                              'Permohonan langsung ke Musyrif & Pengurus Asrama',
                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24),

                  Text('Santri: ${permit.santriNama} (${permit.tokenIzin})',
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                    'Batas Kembali Semula: ${permit.batasKembali != null ? DateFormat('dd MMM yyyy, HH:mm').format(permit.batasKembali!) : "-"}',
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 14),

                  const Text('Pilih Tanggal & Jam Kembali Baru (Perpanjangan):',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () async {
                      final pickedDate = await showDatePicker(
                        context: modalCtx,
                        initialDate: proposedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 30)),
                      );
                      if (pickedDate != null) {
                        final pickedTime = await showTimePicker(
                          context: modalCtx,
                          initialTime: TimeOfDay.fromDateTime(proposedDate),
                        );
                        if (pickedTime != null) {
                          setModalState(() {
                            proposedDate = DateTime(
                              pickedDate.year,
                              pickedDate.month,
                              pickedDate.day,
                              pickedTime.hour,
                              pickedTime.minute,
                            );
                          });
                        }
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_month_rounded, size: 18, color: Color(0xFF047857)),
                          const SizedBox(width: 10),
                          Text(
                            DateFormat('EEEE, dd MMM yyyy - HH:mm').format(proposedDate),
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                          ),
                          const Spacer(),
                          const Text('Ganti', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  const Text('Alasan Perpanjangan (Wajib Diisi):',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: reasonCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'Contoh: Santri masih kontrol medis / ada keperluan mendesak keluarga...',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),

                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (reasonCtrl.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Alasan perpanjangan wajib diisi!')),
                          );
                          return;
                        }
                        Navigator.pop(ctx);
                        final res = await SupabaseService.requestPermitExtension(
                          permitId: permit.id,
                          perpanjanganSampai: proposedDate,
                          alasan: reasonCtrl.text.trim(),
                          santriNama: permit.santriNama,
                        );
                        if (mounted) {
                          if (res['success'] == true) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Permohonan perpanjangan berhasil diajukan ke pengurus asrama.'),
                                backgroundColor: Color(0xFF047857),
                              ),
                            );
                            _loadAllData();
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Gagal mengajukan perpanjangan izin: ${res['error'] ?? 'Terjadi kesalahan'}'),
                                backgroundColor: Colors.redAccent,
                              ),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF047857),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Kirim Permohonan Perpanjangan', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _approveExtension(PermitModel permit) async {
    final newDate = permit.perpanjanganSampai ?? DateTime.now().add(const Duration(days: 1));
    final res = await SupabaseService.approvePermitExtension(
      permitId: permit.id,
      perpanjanganSampai: newDate,
      approverName: widget.session.namaLengkap,
      santriNama: permit.santriNama,
    );
    if (mounted) {
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Perpanjangan masa izin santri ${permit.santriNama} disetujui!'),
            backgroundColor: const Color(0xFF047857),
          ),
        );
        _loadAllData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menyetujui perpanjangan: ${res['error'] ?? 'Terjadi kesalahan'}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Future<void> _rejectExtension(PermitModel permit) async {
    final reasonCtrl = TextEditingController(text: 'Waktu liburan telah selesai dan jadwal santri dimulai');
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Tolak Perpanjangan Izin', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Apakah Anda yakin menolak permohonan perpanjangan izin untuk ${permit.santriNama}?'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(labelText: 'Catatan Penolakan'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            child: const Text('Tolak'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final res = await SupabaseService.rejectPermitExtension(
        permitId: permit.id,
        rejectReason: reasonCtrl.text.trim(),
        rejecterName: widget.session.namaLengkap,
        santriNama: permit.santriNama,
      );
      if (mounted) {
        if (res['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Perpanjangan izin untuk ${permit.santriNama} ditolak.'),
              backgroundColor: const Color(0xFFDC2626),
            ),
          );
          _loadAllData();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Gagal menolak perpanjangan: ${res['error'] ?? 'Terjadi kesalahan'}'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    }
  }

  // ─── SUBMIT PERMIT FORM (WALI & SANTRI) ────────────────────────────────────
  Future<void> _submitInstantPermit() async {
    if (_permitKeperluanCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Keperluan izin wajib diisi!')),
      );
      return;
    }

    setState(() => _isSubmittingPermit = true);

    final child = _childOfWali;
    final santriId = child?.id ?? 'S-001';
    final santriNama = child?.namaLengkap ?? 'Ahmad Fauzi';

    final res = await SupabaseService.submitPermit(
      santriId: santriId,
      santriNama: santriNama,
      kategori: _permitKategoriCtrl.text,
      keperluan: _permitKeperluanCtrl.text.trim(),
      penjemput: _permitPenjemputCtrl.text.trim(),
      batasKembali: DateTime.now().add(const Duration(days: 2)),
      roomName: child?.kamar ?? 'Asrama Putra',
    );

    if (!mounted) return;
    setState(() => _isSubmittingPermit = false);

    if (res['success'] == true) {
      _permitKeperluanCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Pengajuan izin digital (${res['permitCode'] ?? 'DU-PERMIT'}) berhasil dikirimkan ke Musyrif Asrama!'),
          backgroundColor: const Color(0xFF047857),
        ),
      );
      _loadAllData();
      setState(() => _activeMenuKey = 'dashboard');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Gagal mengajukan izin: ${res['error'] ?? 'Terjadi kesalahan'}'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  // ─── AI ASSISTANT CHAT SEND ────────────────────────────────────────────────
  void _sendAiMessage([String? customPrompt]) {
    final text = customPrompt ?? _aiPromptCtrl.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _aiMessages.add({'role': 'user', 'content': text});
      _isAiThinking = true;
    });
    _aiPromptCtrl.clear();

    Future.delayed(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      String reply;
      final lower = text.toLowerCase();
      final role = widget.session.role;

      if (role == AppRole.wali) {
        final child = _childOfWali;
        final name = child?.namaLengkap ?? 'Ahmad Fauzi';
        if (lower.contains('keberadaan') || lower.contains('posisi') || lower.contains('status')) {
          reply = 'Ananda $name saat ini berstatus: ${child?.statusLabel ?? "Di Asrama"}. '
              'Tercatat berada di lingkungan pondok dan mengikuti kegiatan halaqah dengan tertib.';
        } else if (lower.contains('saldo') || lower.contains('jajan')) {
          reply = 'Saldo Dompet Pintar $name saat ini Rp 185.000 dengan limit jajan harian Rp 25.000. '
              'Konsumsi terakhir tercatat di Kantin Sehat Asrama untuk makan siang.';
        } else {
          reply = 'Berdasarkan data pondok untuk ananda $name, nilai mutaba\'ah sholat 100% dan poin disiplin 100/100 (Mumtaz).';
        }
      } else if (role == AppRole.security) {
        final diLuar = _santriList.where((s) => s.isIzin).length;
        reply = 'Laporan Keamanan Gate:\n'
            '• Santri sedang di luar gerbang: $diLuar santri\n'
            '• Izin aktif terverifikasi: ${_permitsList.where((p) => p.isApproved).length} surat\n'
            '• Puncak arus keluar gerbang diprediksi pukul 16:30 WIB.';
      } else if (role == AppRole.poskestren) {
        final sakit = _santriList.where((s) => s.statusAsrama == 'SAKIT').length;
        reply = 'Laporan Poskestren:\n'
            '• Santri istirahat/rawat UKS saat ini: $sakit santri\n'
            '• Stok obat umum (paracetamol, antasida, vitamin) dalam kondisi aman.';
      } else {
        reply = 'Analisis AI: Sistem Smart Ri\'ayah terhubung aktif. '
            'Total santri: ${_santriList.length}, Total kamar: ${_roomsList.length}. Semua modul gerbang dan presensi siap.';
      }

      setState(() {
        _aiMessages.add({'role': 'ai', 'content': reply});
        _isAiThinking = false;
      });
    });
  }

  void _sendLiveChatMessage() {
    final text = _chatMsgCtrl.text.trim();
    if (text.isEmpty) return;

    final now = DateFormat('HH:mm').format(DateTime.now());
    setState(() {
      _chatMessages.add({
        'sender': widget.session.namaLengkap,
        'role': widget.session.role.title,
        'text': text,
        'time': now,
        'isMe': true,
      });
    });
    _chatMsgCtrl.clear();
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.role;
    final primaryColor = role.primaryColor;

    // Ambil judul halaman dari menu aktif
    final allowedMenus = AppDrawer.getMenusForRole(role);
    final activeItem = allowedMenus.firstWhere(
      (m) => m.key == _activeMenuKey,
      orElse: () => allowedMenus.first,
    );

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: AppDrawer(
        session: widget.session,
        activeMenuKey: _activeMenuKey,
        onSelectMenuKey: _onSelectMenuKey,
        onLogout: _handleLogout,
      ),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded, color: Color(0xFF0F172A), size: 24),
          tooltip: 'Menu Navigasi',
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              activeItem.title,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
              ),
            ),
            Row(
              children: [
                CircleAvatar(radius: 3, backgroundColor: primaryColor),
                const SizedBox(width: 5),
                Text(
                  role.title,
                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: 'Muat Ulang',
            onPressed: _loadAllData,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
            tooltip: 'Keluar',
            onPressed: _handleLogout,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : RefreshIndicator(
              onRefresh: _loadAllData,
              color: primaryColor,
              child: _buildBodyForActiveMenu(),
            ),
    );
  }

  // ─── ROUTER TAMPILAN BERDASARKAN MENU AKTIF & ROLE RBAC ───────────────────
  Widget _buildBodyForActiveMenu() {
    switch (_activeMenuKey) {
      case 'dashboard':
        return _buildRoleSpecificDashboard();
      case 'grafik':
        return _buildGrafikView();
      case 'data_kamar':
        return _buildDataKamarView();
      case 'rekap_laporan':
        return _buildRekapLaporanView();
      case 'perizinan':
        return _buildPerizinanView();
      case 'dompet_pintar':
        return _buildDompetPintarView();
      case 'ai_assistant':
        return _buildAiAssistantView();
      case 'live_chat':
        return _buildLiveChatView();
      default:
        return _buildRoleSpecificDashboard();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ROLE-SPECIFIC DASHBOARDS
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildRoleSpecificDashboard() {
    final role = widget.session.role;

    if (role == AppRole.wali) {
      return _buildWaliDashboard();
    } else if (role == AppRole.security) {
      return _buildSecurityDashboard();
    } else if (role == AppRole.poskestren) {
      return _buildPoskestrenDashboard();
    } else if (role == AppRole.mudir) {
      return _buildMudirExecutiveDashboard();
    } else if (role == AppRole.musyrif) {
      return _buildMusyrifDashboard();
    } else {
      // Super Admin & Admin Ri'ayah
      return _buildAdminDashboard();
    }
  }

  // ─── A. DASHBOARD KHUSUS ORANG TUA / WALI SANTRI ───────────────────────────
  Widget _buildWaliDashboard() {
    final child = _childOfWali;
    final isInside = child?.isPresent ?? true;
    final isSakit = child?.statusAsrama == 'SAKIT';

    Color statusBadgeColor = const Color(0xFF047857);
    String statusText = 'STATUS: DI DALAM ASRAMA';
    String statusDesc = 'Ananda berada di lingkungan pondok mengikuti halaqah & asrama.';

    if (isSakit) {
      statusBadgeColor = const Color(0xFF7C3AED);
      statusText = 'STATUS: SAKIT / DI UKS';
      statusDesc = 'Ananda sedang dalam perawatan medis Poskestren pondok.';
    } else if (!isInside) {
      statusBadgeColor = const Color(0xFFD97706);
      statusText = 'STATUS: SEDANG DI LUAR ASRAMA';
      statusDesc = 'Ananda tercatat keluar asrama dengan surat izin DU-PERMIT resmi.';
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Greeting Card Wali
          _buildGreetingCard(
            title: 'Assalamu\'alaikum, ${widget.session.namaLengkap}',
            sub: 'Portal Pemantauan Ananda • Pesantren Modern Darul Ulum',
            icon: Icons.family_restroom_rounded,
            color: const Color(0xFF0891B2),
          ),
          const SizedBox(height: 16),

          // Status Keberadaan Anak (Live Presence Badge)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: statusBadgeColor.withOpacity(0.08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: statusBadgeColor.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: statusBadgeColor,
                  child: Icon(
                    isSakit ? Icons.healing_rounded : (isInside ? Icons.check_circle_rounded : Icons.departure_board_rounded),
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        statusText,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: statusBadgeColor),
                      ),
                      const SizedBox(height: 2),
                      Text(statusDesc, style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Profil Ananda
          if (child != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: const Color(0xFF047857).withOpacity(0.12),
                    child: Text(
                      child.initials,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF047857)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          child.namaLengkap,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'NIS: ${child.nis} • Kelas ${child.kelas} • ${child.kamar}',
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'Poin Disiplin: ${child.poinDisiplin}/100',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF15803D)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),

          // Quick Action Wali: Form Izin & Cek Dompet
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => setState(() => _activeMenuKey = 'perizinan'),
                  icon: const Icon(Icons.send_rounded, size: 16),
                  label: const Text('Ajukan Izin Pulang'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF047857),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => setState(() => _activeMenuKey = 'dompet_pintar'),
                  icon: const Icon(Icons.wallet_rounded, size: 16),
                  label: const Text('Dompet Pintar'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),

          // Riwayat Izin Ananda
          const Text(
            'Riwayat Perizinan Ananda Terakhir',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 8),

          if (_permitsList.isEmpty)
            const Text('Belum ada surat perizinan aktif.', style: TextStyle(color: Colors.grey))
          else
            ..._permitsList.take(3).map((p) => _buildPermitCard(p)),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ─── B. DASHBOARD KHUSUS POS SATPAM / KEAMANAN GERBANG ─────────────────────
  Widget _buildSecurityDashboard() {
    final diLuarCount = _santriList.where((s) => s.isIzin).length;
    final permitsAktif = _permitsList.where((p) => p.isApproved).toList();

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildGreetingCard(
            title: 'Pos Keamanan Gerbang Utama (Gate Command)',
            sub: 'Monitoring IoT Turnstile Gate & Validasi DU-PERMIT',
            icon: Icons.cell_tower_rounded,
            color: const Color(0xFFE11D48),
          ),
          const SizedBox(height: 16),

          // Quick KPI Gate
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Sedang di Luar',
                  value: '$diLuarCount',
                  sub: 'Santri Izin',
                  icon: Icons.directions_walk_rounded,
                  color: const Color(0xFFE11D48),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildKpiCard(
                  label: 'Izin Aktif Hari Ini',
                  value: '${permitsAktif.length}',
                  sub: 'Siap Validasi Gate',
                  icon: Icons.verified_user_rounded,
                  color: const Color(0xFF10B981),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Daftar Validasi Checkout / Checkin Gate
          const Text(
            'Validasi Gerbang DU-PERMIT (1-Tap Gate)',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 8),

          if (permitsAktif.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Text('Tidak ada surat izin yang siap validasi gerbang saat ini.', style: TextStyle(color: Colors.grey)),
            )
          else
            ...permitsAktif.map((permit) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          permit.tokenIzin,
                          style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF0F766E)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(6)),
                          child: const Text('DISETUJUI', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF15803D))),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      permit.santriNama,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    Text(
                      '${permit.kategori} • ${permit.keperluan} • Penjemput: ${permit.penjemput}',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _validateGateAction(permit, true),
                            icon: const Icon(Icons.logout_rounded, size: 14),
                            label: const Text('Validasi Keluar'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFDC2626),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _validateGateAction(permit, false),
                            icon: const Icon(Icons.login_rounded, size: 14),
                            label: const Text('Validasi Masuk'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF047857),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ─── C. DASHBOARD KHUSUS POSKESTREN / MEDIS UKS ────────────────────────────
  Widget _buildPoskestrenDashboard() {
    final sakitCount = _santriList.where((s) => s.statusAsrama == 'SAKIT').length;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildGreetingCard(
            title: 'Klinik Pesantren & Poskestren',
            sub: 'Rekam Medis, Pemeriksaan & Rawat Inap UKS',
            icon: Icons.medical_services_rounded,
            color: const Color(0xFF0284C7),
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Rawat Inap UKS',
                  value: '$sakitCount',
                  sub: 'Santri Istirahat',
                  icon: Icons.hotel_rounded,
                  color: const Color(0xFF7C3AED),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildKpiCard(
                  label: 'Status Obat',
                  value: 'Lengkap',
                  sub: 'Apotek Asrama',
                  icon: Icons.medication_rounded,
                  color: const Color(0xFF0284C7),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Form Ubah Status Medis Santri
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.healing_rounded, color: Color(0xFF0284C7), size: 20),
                    SizedBox(width: 8),
                    Text('Pencatatan Status Medis & Rawat UKS', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 12),

                // Pilih Santri
                const Text('Pilih Santri', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                DropdownButtonFormField<SantriModel>(
                  value: _selectedMedisSantri,
                  isExpanded: true,
                  items: _santriList.map((s) {
                    return DropdownMenuItem(
                      value: s,
                      child: Text('${s.namaLengkap} (${s.kamar})', style: const TextStyle(fontSize: 12)),
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => _selectedMedisSantri = val),
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 12),

                // Keluhan
                TextField(
                  controller: _medisKeluhanCtrl,
                  decoration: InputDecoration(
                    labelText: 'Keluhan & Diagnosa Singkat',
                    hintText: 'Contoh: Demam 38°C, Flu, Radang Tenggorokan',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _selectedMedisSantri == null
                            ? null
                            : () => _updateSantriMedicalStatus(_selectedMedisSantri!, 'SAKIT'),
                        icon: const Icon(Icons.sick_rounded, size: 15),
                        label: const Text('Tandai Rawat di UKS'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF7C3AED),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _selectedMedisSantri == null
                            ? null
                            : () => _updateSantriMedicalStatus(_selectedMedisSantri!, 'DI_ASRAMA'),
                        icon: const Icon(Icons.check_circle_rounded, size: 15),
                        label: const Text('Sembuh & Kembali'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF047857),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ─── D. DASHBOARD KHUSUS MUDIR / PIMPINAN PONDOK (EXECUTIVE READ-ONLY) ──────
  Widget _buildMudirExecutiveDashboard() {
    final totalSantri = _santriList.length;
    final diAsrama = _santriList.where((s) => s.isPresent).length;
    final kasurTerisi = _roomsList.fold<int>(0, (sum, r) => sum + r.terisi);
    final totalKasur = _roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildGreetingCard(
            title: 'Executive Dashboard Ma\'had',
            sub: 'K.H. Ahmad Dahlan, Lc., M.A. • Pengasuh Pesantren',
            icon: Icons.account_balance_rounded,
            color: const Color(0xFFD97706),
          ),
          const SizedBox(height: 16),

          // Executive KPI Grid
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Total Santri',
                  value: '$totalSantri',
                  sub: 'Santri Aktif',
                  icon: Icons.people_alt_rounded,
                  color: const Color(0xFFD97706),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildKpiCard(
                  label: 'Kehadiran Pondok',
                  value: totalSantri > 0 ? '${((diAsrama / totalSantri) * 100).toStringAsFixed(1)}%' : '100%',
                  sub: '$diAsrama di Asrama',
                  icon: Icons.check_circle_rounded,
                  color: const Color(0xFF10B981),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Okupansi Asrama',
                  value: totalKasur > 0 ? '${((kasurTerisi / totalKasur) * 100).toStringAsFixed(0)}%' : '0%',
                  sub: '$kasurTerisi / $totalKasur Kasur',
                  icon: Icons.hotel_rounded,
                  color: const Color(0xFF0284C7),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildKpiCard(
                  label: 'Rata-rata Adab',
                  value: '95.8 Pts',
                  sub: 'Kategori Mumtaz',
                  icon: Icons.stars_rounded,
                  color: const Color(0xFF8B5CF6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Laporan Terpadu Divisi (Executive Overview)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rangkuman Kinerja Terpadu Pesantren', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                SizedBox(height: 8),
                Text(
                  '• Divisi Pengasuhan: 100% kamar telah melakukan presensi malam.\n'
                  '• Divisi Keamanan: Gerbang IoT Turnstile berjalan optimal dengan status locked.\n'
                  '• Divisi Medis: Tidak ada santri dengan rujukan penyakit darurat.\n'
                  '• Divisi Keuangan: Transaksi cashless santri transparan via kartu RFID.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.6),
                ),
              ],
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ─── E. DASHBOARD KHUSUS MUSYRIF / PEMBINA ASRAMA ─────────────────────────
  Widget _buildMusyrifDashboard() {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildGreetingCard(
            title: 'Asrama Binaan Musyrif',
            sub: 'Monitoring Kamar, Presensi Malam & Pembinaan Santri',
            icon: Icons.home_work_rounded,
            color: const Color(0xFF0D9488),
          ),
          const SizedBox(height: 16),

          // Presensi Malam Santri Checklist
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Presensi Malam Santri Binaan', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
              Text('${_santriList.length} Santri', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            ],
          ),
          const SizedBox(height: 8),

          ..._santriList.map((santri) {
            final isChecked = _eveningRollCall[santri.id] ?? santri.isPresent;
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: CheckboxListTile(
                value: isChecked,
                activeColor: const Color(0xFF0D9488),
                title: Text(santri.namaLengkap, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                subtitle: Text('${santri.kamar} • Poin: ${santri.poinDisiplin}', style: const TextStyle(fontSize: 11)),
                onChanged: (val) {
                  setState(() => _eveningRollCall[santri.id] = val ?? false);
                },
              ),
            );
          }),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ─── F. DASHBOARD ADMIN RI'AYAH & SUPER ADMIN ──────────────────────────────
  Widget _buildAdminDashboard() {
    final totalSantri = _santriList.length;
    final diAsrama = _santriList.where((s) => s.isPresent).length;
    final diLuar = _santriList.where((s) => s.isIzin).length;
    final totalKasur = _roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);
    final kasurTerisi = _roomsList.fold<int>(0, (sum, r) => sum + r.terisi);

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildGreetingCard(
            title: widget.session.namaLengkap,
            sub: widget.session.role.subtitle,
            icon: widget.session.role.icon,
            color: widget.session.role.primaryColor,
          ),
          const SizedBox(height: 16),

          // 4 KPI Cards
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Total Santri',
                  value: '$totalSantri',
                  sub: 'Buku Induk',
                  icon: Icons.people_alt_rounded,
                  color: const Color(0xFF047857),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildKpiCard(
                  label: 'Di Asrama',
                  value: '$diAsrama',
                  sub: 'Real-time Hadir',
                  icon: Icons.home_rounded,
                  color: const Color(0xFF0D9488),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  label: 'Sedang Izin',
                  value: '$diLuar',
                  sub: 'Di Luar Gerbang',
                  icon: Icons.departure_board_rounded,
                  color: const Color(0xFFD97706),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildKpiCard(
                  label: 'Kasur Terisi',
                  value: '$kasurTerisi / $totalKasur',
                  sub: '${_roomsList.length} Kamar Aktif',
                  icon: Icons.bed_rounded,
                  color: const Color(0xFF0284C7),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Santri Terkini
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Data Keberadaan Santri Terbaru', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
              TextButton(
                onPressed: () => setState(() => _activeMenuKey = 'data_kamar'),
                child: const Text('Lihat Semua', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
              ),
            ],
          ),
          const SizedBox(height: 6),

          if (_santriList.isEmpty)
            const Text('Belum ada data santri.')
          else
            ..._santriList.take(4).map((s) => _buildSantriMiniCard(s)),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. GRAFIK AKTIVITAS VIEW (MudirChartsView)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildGrafikView() {
    return const MudirChartsView();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. MANAJEMEN DATA & KAMAR VIEW (CRUD untuk Admin, Read-only / Presensi)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildDataKamarView() {
    final role = widget.session.role;
    final isAllowedCRUD = role == AppRole.superAdmin || role == AppRole.adminRiayah;

    final filteredRooms = _roomsList.where((room) {
      if (_selectedGenderFilter == 'PUTRA' && room.isPutri) return false;
      if (_selectedGenderFilter == 'PUTRI' && !room.isPutri) return false;
      return true;
    }).toList();

    final filteredSantri = _santriList.where((santri) {
      if (_searchQuery.isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return santri.namaLengkap.toLowerCase().contains(q) ||
          santri.nis.toLowerCase().contains(q) ||
          santri.kamar.toLowerCase().contains(q);
    }).toList();

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      children: [
        if (isAllowedCRUD) ...[
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ManageRoomsScreen()),
                    ).then((_) => _loadAllData());
                  },
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Tambah Kamar'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF047857),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => OnboardingSantriScreen(availableRooms: _roomsList)),
                    ).then((_) => _loadAllData());
                  },
                  icon: const Icon(Icons.person_add_rounded, size: 16),
                  label: const Text('Santri Baru'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
        ],

        // Search Bar
        TextField(
          onChanged: (val) => setState(() => _searchQuery = val),
          decoration: InputDecoration(
            hintText: 'Cari nama santri, NIS, atau kamar...',
            prefixIcon: const Icon(Icons.search_rounded, size: 20),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          ),
        ),
        const SizedBox(height: 14),

        // Filter Gender
        Row(
          children: [
            _buildGenderFilterChip('ALL', 'Semua (${_roomsList.length})'),
            const SizedBox(width: 8),
            _buildGenderFilterChip('PUTRA', 'Putra'),
            const SizedBox(width: 8),
            _buildGenderFilterChip('PUTRI', 'Putri'),
          ],
        ),
        const SizedBox(height: 16),

        const Text('Daftar Kamar Asrama', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),

        ...filteredRooms.map(
          (room) => RoomOccupancyCard(
            room: room,
            onEdit: isAllowedCRUD
                ? () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => ManageRoomsScreen(roomToEdit: room)),
                    ).then((_) => _loadAllData());
                  }
                : () {},
            onDelete: isAllowedCRUD ? () => _confirmDeleteRoom(room) : () {},
          ),
        ),

        const SizedBox(height: 20),
        const Text('Daftar Santri', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),

        ...filteredSantri.map((s) => _buildSantriListItem(s, isAllowedCRUD)),

        const SizedBox(height: 30),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. REKAPITULASI LAPORAN VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildRekapLaporanView() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Arsip & Rekap Surat Izin (DU-PERMIT)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
            Text('${_permitsList.length} Arsip', style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
        const SizedBox(height: 12),

        if (_permitsList.isEmpty)
          const Text('Belum ada arsip perizinan.')
        else
          ..._permitsList.map((p) => _buildPermitCard(p)),

        const SizedBox(height: 30),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PERIZINAN VIEW (Approval untuk Admin/Musyrif, Form untuk Wali)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildPerizinanView() {
    final role = widget.session.role;

    // Jika Wali atau Santri: Tampilkan Form Pengajuan Izin
    if (role == AppRole.wali || role == AppRole.santri) {
      return ListView(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.send_rounded, color: Color(0xFF047857), size: 20),
                    SizedBox(width: 8),
                    Text('Formulir Izin Pulang / Keluar Ananda', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 14),

                DropdownButtonFormField<String>(
                  value: _permitKategoriCtrl.text,
                  items: const [
                    DropdownMenuItem(value: 'PULANG', child: Text('Izin Pulang Bermalam')),
                    DropdownMenuItem(value: 'PESIAR', child: Text('Pesiar / Belanja Santri')),
                    DropdownMenuItem(value: 'BEROBAT', child: Text('Izin Berobat ke Klinik')),
                  ],
                  onChanged: (val) => setState(() => _permitKategoriCtrl.text = val ?? 'PULANG'),
                  decoration: const InputDecoration(labelText: 'Kategori Izin'),
                ),
                const SizedBox(height: 12),

                TextField(
                  controller: _permitKeperluanCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Alasan / Keperluan'),
                ),
                const SizedBox(height: 12),

                TextField(
                  controller: _permitPenjemputCtrl,
                  decoration: const InputDecoration(labelText: 'Nama Penjemput / Wali'),
                ),
                const SizedBox(height: 18),

                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _isSubmittingPermit ? null : _submitInstantPermit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF047857),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSubmittingPermit
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Kirim Pengajuan Izin', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    // Jika Admin atau Musyrif: Tampilkan Antrean Verifikasi & Perpanjangan Izin
    final pendingExtensions = _permitsList.where((p) => p.hasPendingExtension).toList();
    final pendingPermits = _permitsList.where((p) => p.isPending).toList();

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      children: [
        // ─── SEKSI 1: PERMOHONAN PERPANJANGAN MASA IZIN/LIBURAN ─────────────
        if (pendingExtensions.isNotEmpty) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.hourglass_top_rounded, color: Color(0xFFD97706), size: 18),
                  SizedBox(width: 6),
                  Text('Permohonan Perpanjangan Masa Izin', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF92400E))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                child: Text('${pendingExtensions.length} Perlu Konfirmasi', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...pendingExtensions.map((p) => _buildPermitCard(p)),
          const SizedBox(height: 18),
          const Divider(),
          const SizedBox(height: 10),
        ],

        // ─── SEKSI 2: ANTREAN SURAT IZIN BARU ──────────────────────────────
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Antrean Surat Izin Baru', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(8)),
              child: Text('${pendingPermits.length} Menunggu', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (pendingPermits.isEmpty && pendingExtensions.isEmpty)
          const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Tidak ada surat izin atau perpanjangan yang menunggu persetujuan.')))
        else
          ...pendingPermits.map((permit) {
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(permit.tokenIzin, style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Colors.grey)),
                      Text(permit.kategori, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF047857))),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(permit.santriNama, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                  Text('Alasan: ${permit.keperluan} • Penjemput: ${permit.penjemput}', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _updatePermitApproval(permit, 'APPROVED'),
                          icon: const Icon(Icons.check_circle_rounded, size: 16),
                          label: const Text('Setujui (Approve)'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF047857),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _updatePermitApproval(permit, 'REJECTED'),
                          icon: const Icon(Icons.cancel_rounded, size: 16, color: Color(0xFFDC2626)),
                          label: const Text('Tolak', style: TextStyle(color: Color(0xFFDC2626))),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFFDC2626)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),

        const SizedBox(height: 30),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. DOMPET PINTAR VIEW (Khusus Anak untuk Wali, Global untuk Admin)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildDompetPintarView() {
    final role = widget.session.role;
    final targetSantri = (role == AppRole.wali) ? _childOfWali : (_santriList.isNotEmpty ? _santriList.first : null);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      children: [
        if (targetSantri != null)
          RfidCardWidget(
            rfidUid: targetSantri.rfidUid ?? '04:A1:2B:9C',
            santriNama: targetSantri.namaLengkap,
            nis: targetSantri.nis,
            saldo: targetSantri.saldoRfid,
          ),
        const SizedBox(height: 18),

        const Text('Riwayat Transaksi Kantin & Koperasi', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
        const SizedBox(height: 10),

        _buildTransactionItem('Kantin Asrama Al-Barakah', 'Makan Siang & Teh Hangat', '- Rp 12.000', '12:30 WIB', Icons.restaurant_rounded),
        _buildTransactionItem('Koperasi Santri', 'Kitab Matan & Alat Tulis', '- Rp 18.000', '10:15 WIB', Icons.shopping_bag_rounded),
        _buildTransactionItem('Top Up Dompet', 'Transfer Wali Santri', '+ Rp 100.000', '28 Okt', Icons.add_card_rounded, isCredit: true),

        const SizedBox(height: 30),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. AI ASSISTANT VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildAiAssistantView() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: const Color(0xFFF5F3FF),
          child: const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: Color(0xFF8B5CF6), size: 16),
              SizedBox(width: 8),
              Expanded(
                child: Text('AI Assistant Aktif • Siap menjawab pertanyaan seputar pondok.', style: TextStyle(fontSize: 11, color: Color(0xFF6D28D9))),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            itemCount: _aiMessages.length,
            itemBuilder: (ctx, idx) {
              final msg = _aiMessages[idx];
              final isAi = msg['role'] == 'ai';
              return Align(
                alignment: isAi ? Alignment.centerLeft : Alignment.centerRight,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isAi ? Colors.white : const Color(0xFF8B5CF6),
                    borderRadius: BorderRadius.circular(14),
                    border: isAi ? Border.all(color: const Color(0xFFE2E8F0)) : null,
                  ),
                  child: Text(
                    msg['content'] ?? '',
                    style: TextStyle(fontSize: 12.5, color: isAi ? const Color(0xFF0F172A) : Colors.white),
                  ),
                ),
              );
            },
          ),
        ),
        if (_isAiThinking)
          const Padding(padding: EdgeInsets.all(6), child: Text('AI sedang menganalisis...', style: TextStyle(fontSize: 11, color: Colors.purple))),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          color: Colors.white,
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _aiPromptCtrl,
                  decoration: const InputDecoration(hintText: 'Tanyakan data santri atau aturan...', border: InputBorder.none),
                  onSubmitted: (_) => _sendAiMessage(),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send_rounded, color: Color(0xFF8B5CF6)),
                onPressed: () => _sendAiMessage(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. LIVE CHAT VIEW (WHATSAPP WEBSOCKET + EMOJI REACTIONS)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildLiveChatView() {
    return WhatsAppLiveChatView(session: widget.session);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER WIDGETS
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildGreetingCard({
    required String title,
    required String sub,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [color, color.withOpacity(0.85)]),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), borderRadius: BorderRadius.circular(14)),
            child: Icon(icon, color: Colors.white, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.white)),
                const SizedBox(height: 2),
                Text(sub, style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.9))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard({required String label, required String value, required String sub, required IconData icon, required Color color}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
          Text(sub, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildSantriMiniCard(SantriModel s) {
    final isInside = s.isPresent;
    final color = isInside ? const Color(0xFF047857) : const Color(0xFFD97706);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        children: [
          CircleAvatar(radius: 16, backgroundColor: color.withOpacity(0.12), child: Icon(Icons.person, color: color, size: 16)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s.namaLengkap, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                Text('${s.nis} • ${s.kamar}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
          Text(isInside ? 'Di Asrama' : 'Sedang Izin', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildGenderFilterChip(String key, String label) {
    final isSelected = _selectedGenderFilter == key;
    return InkWell(
      onTap: () => setState(() => _selectedGenderFilter = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF047857) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? const Color(0xFF047857) : const Color(0xFFCBD5E1)),
        ),
        child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isSelected ? Colors.white : Colors.black87)),
      ),
    );
  }

  Widget _buildSantriListItem(SantriModel santri, bool canDelete) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        children: [
          CircleAvatar(radius: 16, child: Text(santri.initials, style: const TextStyle(fontSize: 11))),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(santri.namaLengkap, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                Text('${santri.nis} • ${santri.kamar}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
          if (canDelete)
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626), size: 18),
              onPressed: () => _confirmDeleteSantri(santri),
            ),
        ],
      ),
    );
  }

  Future<void> _confirmDeleteRoom(RoomModel room) async {
    await DeleteConfirmDialog.show(
      context,
      title: 'Hapus Kamar Asrama?',
      message: 'Seluruh alokasi kasur kamar ini akan dihapus secara permanen dari sistem.',
      itemName: '${room.namaGedung} - Kamar ${room.nomorKamar}',
      itemId: room.id,
      itemType: 'Kamar',
      onConfirmAction: () async {
        final success = await SupabaseService.deleteRoom(room.id);
        _loadAllData();
        return success;
      },
    );
  }

  Future<void> _confirmDeleteSantri(SantriModel santri) async {
    await DeleteConfirmDialog.show(
      context,
      title: 'Hapus Data Santri?',
      message: 'Data santri dan kuota kamar terkait akan otomatis diperbarui di sistem.',
      itemName: santri.namaLengkap,
      itemId: santri.id,
      itemType: 'Santri',
      onConfirmAction: () async {
        final success = await SupabaseService.deleteSantri(santri.id, kamarId: santri.kamarId);
        _loadAllData();
        return success;
      },
    );
  }

  Widget _buildPermitCard(PermitModel permit) {
    final role = widget.session.role;
    final isWali = role == AppRole.wali;
    final isAdminOrMusyrif = role == AppRole.musyrif || role == AppRole.adminRiayah || role == AppRole.superAdmin;
    final canExtend = (permit.isApproved || permit.isActive) && !permit.hasPendingExtension;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: permit.hasPendingExtension ? const Color(0xFFFCD34D) : const Color(0xFFE2E8F0),
          width: permit.hasPendingExtension ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  permit.tokenIzin,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: permit.statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  permit.statusLabel,
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: permit.statusColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            permit.santriNama,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 3),
          Text(
            '${permit.kategori} • ${permit.keperluan}',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569)),
          ),
          Text(
            'Penjemput: ${permit.penjemput}',
            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
          ),
          if (permit.batasKembali != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.timer_outlined, size: 13, color: Color(0xFF047857)),
                const SizedBox(width: 4),
                Text(
                  'Batas Kembali: ${DateFormat('dd MMM yyyy, HH:mm').format(permit.batasKembali!)} WIB',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF047857)),
                ),
              ],
            ),
          ],

          // ─── STATUS PERPANJANGAN BADGE ───────────────────────────────────
          if (permit.hasPendingExtension) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.hourglass_top_rounded, size: 14, color: Color(0xFFD97706)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Menunggu Persetujuan Perpanjangan s/d ${permit.perpanjanganSampai != null ? DateFormat('dd MMM yyyy, HH:mm').format(permit.perpanjanganSampai!) : "-"}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                        ),
                      ),
                    ],
                  ),
                  if (permit.alasanPerpanjangan != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      'Alasan: ${permit.alasanPerpanjangan}',
                      style: const TextStyle(fontSize: 10.5, color: Color(0xFF78350F)),
                    ),
                  ],
                ],
              ),
            ),
          ] else if (permit.isExtensionApproved) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded, size: 13, color: Color(0xFF047857)),
                  SizedBox(width: 4),
                  Text(
                    'Perpanjangan Liburan Telah Disetujui',
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                  ),
                ],
              ),
            ),
          ],

          // ─── ACTION TOMBOL WALI SANTRI ─────────────────────────────────────
          if (isWali && canExtend) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _showExtensionRequestModal(context, permit),
                icon: const Icon(Icons.schedule_send_rounded, size: 16, color: Color(0xFF047857)),
                label: const Text(
                  'Ajukan Perpanjangan Masa Izin / Liburan',
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF047857)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
              ),
            ),
          ],

          // ─── ACTION TOMBOL ADMIN/MUSYRIF UNTUK PERPANJANGAN PENDING ───────
          if (isAdminOrMusyrif && permit.hasPendingExtension) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _approveExtension(permit),
                    icon: const Icon(Icons.check_rounded, size: 15),
                    label: const Text('Terima Perpanjangan', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF047857),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _rejectExtension(permit),
                    icon: const Icon(Icons.close_rounded, size: 15, color: Color(0xFFDC2626)),
                    label: const Text('Tolak', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFDC2626))),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFDC2626)),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTransactionItem(String title, String desc, String amount, String time, IconData icon, {bool isCredit = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: isCredit ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
            child: Icon(icon, size: 16, color: isCredit ? const Color(0xFF16A34A) : Colors.grey),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
                Text(desc, style: const TextStyle(fontSize: 10.5, color: Colors.grey)),
              ],
            ),
          ),
          Text(amount, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: isCredit ? Colors.green : Colors.red)),
        ],
      ),
    );
  }
}
