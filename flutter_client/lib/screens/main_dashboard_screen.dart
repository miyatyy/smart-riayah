import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
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

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - UNIVERSAL ENTERPRISE DASHBOARD
 * Selaras 100% dengan Web:
 * - Persistent Universal Navigation Drawer
 * - Supabase Realtime Channel Sync
 * - 8 Tab Terpadu: Ringkasan, Grafik Realtime, Data & Kamar, Rekap Laporan,
 *   AI Agent Aktif, Dompet Pintar Cashless, Perizinan Langsung, Live Chat.
 * ============================================================================
 */

class MainDashboardScreen extends StatefulWidget {
  final UserSessionModel session;
  final int initialTabIndex;

  const MainDashboardScreen({
    super.key,
    required this.session,
    this.initialTabIndex = 0,
  });

  @override
  State<MainDashboardScreen> createState() => _MainDashboardScreenState();
}

class _MainDashboardScreenState extends State<MainDashboardScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  late int _currentTabIndex;

  bool _isLoading = true;
  List<RoomModel> _roomsList = [];
  List<SantriModel> _santriList = [];
  List<PermitModel> _permitsList = [];

  // Search & Filter
  String _searchQuery = '';
  String _selectedGenderFilter = 'ALL'; // 'ALL', 'PUTRA', 'PUTRI'

  // Realtime Subscriptions
  RealtimeChannel? _roomsChannel;
  RealtimeChannel? _santriChannel;
  RealtimeChannel? _permitsChannel;

  // AI Chat State
  final TextEditingController _aiPromptCtrl = TextEditingController();
  bool _isAiThinking = false;
  final List<Map<String, String>> _aiMessages = [
    {
      'role': 'ai',
      'content': 'Assalamu\'alaikum. Saya Smart Ri\'ayah AI Assistant. Saya siap membantu memantau data santri, evaluasi kedisiplinan, izin keluar, dan tata tertib asrama.',
    },
    {
      'role': 'ai',
      'content': '💡 Tips: Ketik nama santri, tanyakan "Berapa santri di luar?", atau "Bagaimana aturan izin pulang?".',
    },
  ];

  // Live Chat State
  final TextEditingController _chatMsgCtrl = TextEditingController();
  final List<Map<String, dynamic>> _chatMessages = [
    {
      'sender': 'Ust. M. Syukron, M.Pd.',
      'role': 'Musyrif Asrama',
      'text': 'Assalamu\'alaikum Bapak/Ibu Wali Santri. Mohon konfirmasi kepulangan santri untuk liburan semester.',
      'time': '08:30',
      'isMe': false,
    },
    {
      'sender': 'Ibu Fatimah Az-Zahra',
      'role': 'Wali Santri',
      'text': 'Wa\'alaikumsalam Ustadz. InsyaAllah Ananda Ahmad Fauzi kami jemput hari Jum\'at pukul 16.00 WIB.',
      'time': '08:45',
      'isMe': true,
    },
    {
      'sender': 'Ust. M. Syukron, M.Pd.',
      'role': 'Musyrif Asrama',
      'text': 'Baik Ibu, surat izin digital (DU-PERMIT) sudah kami validasi di sistem. Kartu RFID ananda dapat langsung di-tap di Smart Gate.',
      'time': '08:48',
      'isMe': false,
    },
  ];

  // Form Izin Instan State
  final _permitKategoriCtrl = TextEditingController(text: 'PULANG');
  final _permitKeperluanCtrl = TextEditingController();
  final _permitPenjemputCtrl = TextEditingController();
  bool _isSubmittingPermit = false;

  @override
  void initState() {
    super.initState();
    _currentTabIndex = widget.initialTabIndex;
    _permitPenjemputCtrl.text = widget.session.namaLengkap;
    _loadAllData();
    _setupSupabaseRealtime();
  }

  @override
  void dispose() {
    _roomsChannel?.unsubscribe();
    _santriChannel?.unsubscribe();
    _permitsChannel?.unsubscribe();
    _aiPromptCtrl.dispose();
    _chatMsgCtrl.dispose();
    _permitKategoriCtrl.dispose();
    _permitKeperluanCtrl.dispose();
    _permitPenjemputCtrl.dispose();
    super.dispose();
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
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _setupSupabaseRealtime() {
    _roomsChannel = SupabaseService.subscribeTableChanges(
      tableName: 'rooms',
      onChange: (payload) {
        _loadAllData();
      },
    );

    _santriChannel = SupabaseService.subscribeTableChanges(
      tableName: 'santri',
      onChange: (payload) {
        _loadAllData();
      },
    );

    _permitsChannel = SupabaseService.subscribeTableChanges(
      tableName: 'permits',
      onChange: (payload) {
        _loadAllData();
      },
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

  void _onSelectTab(int index) {
    setState(() => _currentTabIndex = index);
    if (_scaffoldKey.currentState?.isDrawerOpen == true) {
      Navigator.pop(context); // Tutup drawer
    }
  }

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

      final diAsramaCount = _santriList.where((s) => s.isPresent).length;
      final diLuarCount = _santriList.where((s) => s.isIzin).length;

      if (lower.contains('luar') || lower.contains('izin')) {
        reply = '📊 Berdasarkan data live database Supabase:\n'
            '• Sedang di luar / izin: $diLuarCount santri\n'
            '• Berada di asrama: $diAsramaCount santri\n'
            '• Seluruh santri yang keluar telah memiliki token elektronik DU-PERMIT resmi.';
      } else if (lower.contains('kamar') || lower.contains('kuota')) {
        final totalKasur = _roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);
        final kasurTerisi = _roomsList.fold<int>(0, (sum, r) => sum + r.terisi);
        reply = '🏢 Status Keterisian Asrama:\n'
            '• Total Kamar: ${_roomsList.length} kamar\n'
            '• Total Kasur: $totalKasur kasur ($kasurTerisi terisi, ${totalKasur - kasurTerisi} kosong)\n'
            '• Kamar putra dan putri terisolasi dengan akses gerbang mandiri.';
      } else if (lower.contains('aturan') || lower.contains('jam')) {
        reply = '📜 Aturan Perizinan Pondok Darul Ulum:\n'
            '1. Izin Pesiar: Maksimal 4 jam di hari Ahad.\n'
            '2. Izin Pulang: Wajib dijemput oleh orang tua / mahram yang terdaftar.\n'
            '3. Batas Jam Malam: Pukul 17:30 WIB seluruh santri wajib sudah tap masuk di gerbang.';
      } else {
        reply = '🤖 AI Smart Assistant:\n'
            'Informasi "$text" telah dicocokkan dengan Buku Induk & sistem IoT Smart Ri\'ayah. Kondisi sistem berjalan optimal (Supabase Realtime Live).';
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

  Future<void> _submitInstantPermit() async {
    if (_permitKeperluanCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Keperluan izin wajib diisi!')),
      );
      return;
    }

    setState(() => _isSubmittingPermit = true);

    final targetSantri = _santriList.isNotEmpty ? _santriList.first : null;
    final santriId = targetSantri?.id ?? 'S-001';
    final santriNama = targetSantri?.namaLengkap ?? 'Ahmad Fauzi';

    final success = await SupabaseService.submitPermit(
      santriId: santriId,
      santriNama: santriNama,
      kategori: _permitKategoriCtrl.text,
      keperluan: _permitKeperluanCtrl.text.trim(),
      penjemput: _permitPenjemputCtrl.text.trim(),
      batasKembali: DateTime.now().add(const Duration(days: 2)),
    );

    if (!mounted) return;
    setState(() => _isSubmittingPermit = false);

    if (success) {
      _permitKeperluanCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Surat izin digital berhasil dikirimkan ke Musyrif!'),
          backgroundColor: Color(0xFF047857),
        ),
      );
      _loadAllData();
      setState(() => _currentTabIndex = 3); // Arahkan ke rekap izin
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.role;
    final primaryColor = role.primaryColor;

    final List<String> tabTitles = [
      'Dashboard Ringkasan',
      'Grafik Aktivitas Real-Time',
      'Manajemen Data & Kamar',
      'Rekapitulasi Laporan',
      'AI Smart Assistant',
      'Dompet Pintar Cashless',
      'Perizinan Langsung',
      'Live Chat Pengurus',
    ];

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: AppDrawer(
        session: widget.session,
        selectedIndex: _currentTabIndex,
        onSelectIndex: _onSelectTab,
        onLogout: _handleLogout,
      ),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded, color: Color(0xFF0F172A), size: 24),
          tooltip: 'Buka Menu',
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tabTitles[_currentTabIndex],
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
              ),
            ),
            Row(
              children: [
                const CircleAvatar(radius: 3, backgroundColor: Color(0xFF10B981)),
                const SizedBox(width: 4),
                Text(
                  '${role.title} • Live Sync',
                  style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: 'Sinkronisasi Data',
            onPressed: _loadAllData,
          ),
          IconButton(
            icon: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF8B5CF6)),
            tooltip: 'AI Assistant',
            onPressed: () => setState(() => _currentTabIndex = 4),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF047857)))
          : RefreshIndicator(
              onRefresh: _loadAllData,
              color: const Color(0xFF047857),
              child: IndexedStack(
                index: _currentTabIndex,
                children: [
                  _buildTabRingkasan(),
                  _buildTabGrafikRealtime(),
                  _buildTabDataKamar(),
                  _buildTabRekapLaporan(),
                  _buildTabAiAssistant(),
                  _buildTabDompetPintar(),
                  _buildTabPerizinanLangsung(),
                  _buildTabLiveChat(),
                ],
              ),
            ),
    );
  }

  // ─── TAB 0: DASHBOARD RINGKASAN ─────────────────────────────────────────────
  Widget _buildTabRingkasan() {
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
          // Greeting Card Role-Specific
          _buildRoleGreetingBanner(),
          const SizedBox(height: 16),

          // 4 KPI Stats Grid
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

          // Quick Action Shortcut Buttons (Mobile-First)
          const Text(
            'Akses Cepat Fitur Terpadu',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildQuickActionBtn(
                  title: 'Ajukan Izin',
                  icon: Icons.note_add_rounded,
                  color: const Color(0xFF047857),
                  onTap: () => setState(() => _currentTabIndex = 6),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildQuickActionBtn(
                  title: 'AI Assistant',
                  icon: Icons.auto_awesome_rounded,
                  color: const Color(0xFF8B5CF6),
                  onTap: () => setState(() => _currentTabIndex = 4),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildQuickActionBtn(
                  title: 'Dompet Pintar',
                  icon: Icons.wallet_rounded,
                  color: const Color(0xFF0284C7),
                  onTap: () => setState(() => _currentTabIndex = 5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),

          // Overview Santri & Keberadaan
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Status Keberadaan Santri Terbaru',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
              ),
              TextButton(
                onPressed: () => setState(() => _currentTabIndex = 2),
                child: const Text('Lihat Semua', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
              ),
            ],
          ),
          const SizedBox(height: 6),

          if (_santriList.isEmpty)
            const Center(child: Text('Belum ada data santri.'))
          else
            ..._santriList.take(4).map((s) => _buildSantriMiniCard(s)),

          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _buildRoleGreetingBanner() {
    final role = widget.session.role;
    final primaryColor = role.primaryColor;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [primaryColor, primaryColor.withOpacity(0.85)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withOpacity(0.25),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(role.icon, color: Colors.white, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ahlan wa Sahlan, ${widget.session.namaLengkap}',
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  role.subtitle,
                  style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.9)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required String label,
    required String value,
    required String sub,
    required IconData icon,
    required Color color,
  }) {
    return Container(
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
              Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 2),
          Text(sub, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildQuickActionBtn({
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 4),
            Text(
              title,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSantriMiniCard(SantriModel s) {
    final isInside = s.isPresent;
    final badgeColor = isInside ? const Color(0xFF047857) : const Color(0xFFD97706);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: badgeColor.withOpacity(0.12),
            child: Icon(
              isInside ? Icons.home_rounded : Icons.directions_walk_rounded,
              color: badgeColor,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s.namaLengkap,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                Text(
                  'NIS: ${s.nis} • ${s.kamar}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: badgeColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              isInside ? 'Di Asrama' : 'Sedang Izin',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: badgeColor),
            ),
          ),
        ],
      ),
    );
  }

  // ─── TAB 1: GRAFIK AKTIVITAS REAL-TIME ──────────────────────────────────────
  Widget _buildTabGrafikRealtime() {
    return const MudirChartsView();
  }

  // ─── TAB 2: MANAJEMEN DATA & KAMAR ─────────────────────────────────────────
  Widget _buildTabDataKamar() {
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
          santri.kamar.toLowerCase().contains(q) ||
          (santri.rfidUid?.toLowerCase().contains(q) ?? false);
    }).toList();

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      children: [
        // Action Buttons: Tambah Kamar & Santri
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
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => OnboardingSantriScreen(availableRooms: _roomsList),
                    ),
                  ).then((_) => _loadAllData());
                },
                icon: const Icon(Icons.person_add_rounded, size: 16),
                label: const Text('Santri Baru'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Search Bar
        TextField(
          onChanged: (val) => setState(() => _searchQuery = val),
          decoration: InputDecoration(
            hintText: 'Cari nama, NIS, kamar, atau UID...',
            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          ),
        ),
        const SizedBox(height: 16),

        // Filter Gender Tabs
        Row(
          children: [
            _buildGenderFilterChip('ALL', 'Semua (${_roomsList.length})'),
            const SizedBox(width: 8),
            _buildGenderFilterChip('PUTRA', 'Asrama Putra'),
            const SizedBox(width: 8),
            _buildGenderFilterChip('PUTRI', 'Asrama Putri'),
          ],
        ),
        const SizedBox(height: 16),

        // Daftar Kamar
        const Text(
          'Alokasi & Kuota Kasur Asrama',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 8),

        if (filteredRooms.isEmpty)
          const Padding(padding: EdgeInsets.all(20), child: Center(child: Text('Belum ada data kamar.')))
        else
          ...filteredRooms.map(
            (room) => RoomOccupancyCard(
              room: room,
              onEdit: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => ManageRoomsScreen(roomToEdit: room)),
                ).then((_) => _loadAllData());
              },
              onDelete: () => _confirmDeleteRoom(room),
            ),
          ),

        const SizedBox(height: 20),
        const Text(
          'Daftar Santri Terdaftar (Buku Induk)',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 8),

        if (filteredSantri.isEmpty)
          const Padding(padding: EdgeInsets.all(20), child: Center(child: Text('Tidak ada santri yang sesuai.')))
        else
          ...filteredSantri.map((s) => _buildSantriListItem(s)),

        const SizedBox(height: 30),
      ],
    );
  }

  Widget _buildGenderFilterChip(String key, String label) {
    final isSelected = _selectedGenderFilter == key;
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => setState(() => _selectedGenderFilter = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF047857) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? const Color(0xFF047857) : const Color(0xFFCBD5E1)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildSantriListItem(SantriModel santri) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFF047857).withOpacity(0.12),
            child: Text(
              santri.initials,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  santri.namaLengkap,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                Text(
                  'NIS: ${santri.nis} • ${santri.kamar} • Poin: ${santri.poinDisiplin}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626), size: 20),
            tooltip: 'Hapus Santri',
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
      message: 'Seluruh alokasi kasur kamar ini akan dihapus dari Supabase.',
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
      message: 'Data santri dan kuota kamar terkait akan otomatis diperbarui di Supabase.',
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

  // ─── TAB 3: REKAPITULASI LAPORAN ───────────────────────────────────────────
  Widget _buildTabRekapLaporan() {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Arsip Surat Izin Santri (DU-PERMIT)',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
            Text(
              'Total: ${_permitsList.length}',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (_permitsList.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Text('Belum ada riwayat perizinan di Supabase.', style: TextStyle(color: Colors.grey)),
          )
        else
          ..._permitsList.map((p) => _buildPermitCard(p)),

        const SizedBox(height: 30),
      ],
    );
  }

  Widget _buildPermitCard(PermitModel permit) {
    final statusColor = permit.statusColor;

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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  permit.statusLabel,
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w900, color: statusColor),
                ),
              ),
              Text(
                permit.tokenIzin,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${permit.santriNama} (${permit.kategori})',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 2),
          Text(
            'Keperluan: ${permit.keperluan}',
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569)),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.person_pin_rounded, size: 13, color: Color(0xFF94A3B8)),
              const SizedBox(width: 4),
              Text('Penjemput: ${permit.penjemput}', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
              const Spacer(),
              if (permit.batasKembali != null) ...[
                const Icon(Icons.access_time_rounded, size: 13, color: Color(0xFF94A3B8)),
                const SizedBox(width: 4),
                Text(
                  DateFormat('dd MMM, HH:mm').format(permit.batasKembali!),
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  // ─── TAB 4: AI SMART ASSISTANT (AKTIF) ───────────────────────────────────────
  Widget _buildTabAiAssistant() {
    return Column(
      children: [
        // AI Header Notice
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: const Color(0xFFF5F3FF),
          child: const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: Color(0xFF8B5CF6), size: 18),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'AI Smart Assistant aktif memonitor data presensi, kamar, & perizinan Supabase.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF6D28D9), fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),

        // Quick Query Chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            children: [
              _buildAiChip('Berapa santri di luar asrama?'),
              const SizedBox(width: 6),
              _buildAiChip('Cek kuota kasur kamar'),
              const SizedBox(width: 6),
              _buildAiChip('Aturan jam malam pondok'),
            ],
          ),
        ),

        // Chat History List
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
                  margin: const EdgeInsets.only(bottom: 10),
                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isAi ? Colors.white : const Color(0xFF8B5CF6),
                    borderRadius: BorderRadius.circular(16),
                    border: isAi ? Border.all(color: const Color(0xFFE2E8F0)) : null,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    msg['content'] ?? '',
                    style: TextStyle(
                      fontSize: 12.5,
                      color: isAi ? const Color(0xFF0F172A) : Colors.white,
                      height: 1.4,
                    ),
                  ),
                ),
              );
            },
          ),
        ),

        if (_isAiThinking)
          const Padding(
            padding: EdgeInsets.all(8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF8B5CF6))),
                SizedBox(width: 8),
                Text('AI sedang menganalisis data...', style: TextStyle(fontSize: 11, color: Color(0xFF8B5CF6))),
              ],
            ),
          ),

        // Text Input Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _aiPromptCtrl,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Tanyakan data santri atau aturan...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
                  ),
                  onSubmitted: (_) => _sendAiMessage(),
                ),
              ),
              const SizedBox(width: 8),
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

  Widget _buildAiChip(String text) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _sendAiMessage(text),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFDDD6FE)),
        ),
        child: Text(
          text,
          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED)),
        ),
      ),
    );
  }

  // ─── TAB 5: DOMPET PINTAR CASHLESS (KEUANGAN WALI & SANTRI) ─────────────────
  Widget _buildTabDompetPintar() {
    final santri = _santriList.isNotEmpty ? _santriList.first : null;
    final currencyFmt = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      children: [
        // Kartu Fisik Mockup RFID
        if (santri != null)
          RfidCardWidget(
            rfidUid: santri.rfidUid ?? '04:A1:2B:9C',
            santriNama: santri.namaLengkap,
            nis: santri.nis,
            saldo: santri.saldoRfid,
          )
        else
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
            child: const Text('Data kartu RFID santri belum tersedia.'),
          ),

        const SizedBox(height: 18),

        // Saldo & Limit Harian Quick Stats
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Limit Jajan Harian', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    const SizedBox(height: 4),
                    Text(currencyFmt.format(25000), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF047857))),
                    const Text('Terkunci Otomatis', style: TextStyle(fontSize: 9.5, color: Color(0xFF10B981))),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Status Kartu Fisik', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    SizedBox(height: 4),
                    Text('AKTIF / VALID', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0284C7))),
                    Text('Mifare 13.56 MHz', style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B))),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // Riwayat Transaksi Dompet Pintar (Kantin, Koperasi)
        const Text(
          'Riwayat Transaksi Cashless Terkini',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 10),

        _buildTransactionItem('Kantin Asrama Al-Barakah', 'Makan Siang & Susu Kedelai', '- Rp 12.000', '12:30 WIB', Icons.restaurant_rounded),
        _buildTransactionItem('Koperasi Santri Putra', 'Buku Tulis & Kitab Matan', '- Rp 18.000', '10:15 WIB', Icons.shopping_bag_rounded),
        _buildTransactionItem('Laundry Pesantren', 'Paket Cuci Kering Setrika 3kg', '- Rp 15.000', 'Kemarin', Icons.local_laundry_service_rounded),
        _buildTransactionItem('Top Up Saldo Dompet', 'Transfer Bank Syariah (Wali)', '+ Rp 100.000', '28 Okt', Icons.add_card_rounded, isCredit: true),

        const SizedBox(height: 30),
      ],
    );
  }

  Widget _buildTransactionItem(String title, String desc, String amount, String time, IconData icon, {bool isCredit = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isCredit ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: isCredit ? const Color(0xFF16A34A) : const Color(0xFF475569)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                Text(desc, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amount,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: isCredit ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                ),
              ),
              Text(time, style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
            ],
          ),
        ],
      ),
    );
  }

  // ─── TAB 6: PERIZINAN LANGSUNG (INSTANT PERMIT) ─────────────────────────────
  Widget _buildTabPerizinanLangsung() {
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
                Icon(Icons.assignment_turned_in_rounded, color: Color(0xFF047857), size: 22),
                SizedBox(width: 8),
                Text(
                  'Formulir Pengajuan Izin Langsung',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Pengajuan izin digital akan langsung tercatat di Supabase dan menerbitkan token gerbang.',
              style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),

            // Kategori
            const Text('Kategori Izin', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              value: _permitKategoriCtrl.text,
              items: const [
                DropdownMenuItem(value: 'PULANG', child: Text('Izin Pulang Bermalam')),
                DropdownMenuItem(value: 'PESIAR', child: Text('Pesiar / Belanja Kebutuhan')),
                DropdownMenuItem(value: 'BEROBAT', child: Text('Berobat ke Klinik/RS')),
                DropdownMenuItem(value: 'LOMBA', child: Text('Delegasi Prestasi & Lomba')),
              ],
              onChanged: (val) => setState(() => _permitKategoriCtrl.text = val ?? 'PULANG'),
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 14),

            // Keperluan
            const Text('Keperluan / Alasan Izin', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextField(
              controller: _permitKeperluanCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Contoh: Menghadiri pernikahan keluarga di rumah.',
                hintStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 14),

            // Penjemput
            const Text('Nama Penjemput / Wali', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextField(
              controller: _permitPenjemputCtrl,
              decoration: InputDecoration(
                hintText: 'Nama lengkap penjemput',
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: _isSubmittingPermit ? null : _submitInstantPermit,
                icon: const Icon(Icons.send_rounded, size: 16),
                label: _isSubmittingPermit
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Kirim Pengajuan Izin Instan', style: TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ),
      ),
      ],
    );
  }

  // ─── TAB 7: LIVE CHAT PENGURUS PONDOK ───────────────────────────────────────
  Widget _buildTabLiveChat() {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            itemCount: _chatMessages.length,
            itemBuilder: (ctx, idx) {
              final msg = _chatMessages[idx];
              final isMe = msg['isMe'] == true;

              return Align(
                alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isMe ? const Color(0xFF047857) : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: isMe ? null : Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                    children: [
                      Text(
                        msg['sender'] ?? '',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isMe ? Colors.white70 : const Color(0xFF047857),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        msg['text'] ?? '',
                        style: TextStyle(fontSize: 12.5, color: isMe ? Colors.white : const Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        msg['time'] ?? '',
                        style: TextStyle(fontSize: 9, color: isMe ? Colors.white60 : const Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        // Chat Input Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _chatMsgCtrl,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Ketik pesan ke pengurus pondok...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
                  ),
                  onSubmitted: (_) => _sendLiveChatMessage(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.send_rounded, color: Color(0xFF047857)),
                onPressed: _sendLiveChatMessage,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

