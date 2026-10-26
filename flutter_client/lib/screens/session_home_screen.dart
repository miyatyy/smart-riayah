import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/santri_model.dart';
import '../api_service.dart';
import '../widgets/santri_card.dart';
import '../widgets/stat_card.dart';
import '../widgets/quick_action_grid.dart';
import '../widgets/app_sidebar_drawer.dart';
import '../widgets/mudir_charts.dart';
import '../widgets/ai_agent_modal.dart';
import 'login_screen.dart';
import 'submit_izin_screen.dart';
import 'chat_admin_screen.dart';
import 'riwayat_izin_screen.dart';

// ─── HomeScreen with Session (Login-aware) ────────────────────────────────────
class HomeScreenWithSession extends StatelessWidget {
  final AppSession session;
  const HomeScreenWithSession({super.key, required this.session});

  @override
  Widget build(BuildContext context) {
    return _SessionHomeScreen(session: session);
  }
}

class _SessionHomeScreen extends StatefulWidget {
  final AppSession session;
  const _SessionHomeScreen({required this.session});

  @override
  State<_SessionHomeScreen> createState() => _SessionHomeScreenState();
}

class _SessionHomeScreenState extends State<_SessionHomeScreen>
    with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  bool _isServerOnline = false;
  List<SantriModel> _allSantriList = [];
  String _errorMessage = '';
  int _selectedTab = 0;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late AppSession _session;
  String _activeMenuId = 'active_permits';

  // Search & Filter state for Santri Directory
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'Semua';
  bool _showBalance = true;
  String _santriPermitStatus = 'DI_ASRAMA'; // 'DI_ASRAMA', 'IZIN', 'DI_LUAR'
  String? _userAvatarUrl;
  bool _isSyncingCloud = false;
  String _cloudSyncTime = 'Baru saja';

  String _getDefaultAvatarForRole(UserRole role) {
    switch (role) {
      case UserRole.santri:
        return 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80';
      case UserRole.wali:
        return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80';
      case UserRole.musyrif:
        return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80';
      case UserRole.mudir:
        return 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80';
      case UserRole.adminRiayah:
        return 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80';
      case UserRole.superAdmin:
        return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
      case UserRole.security:
        return 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80';
    }
  }

  String _getOfficialEmailForRole(UserRole role) {
    if (_session.email != null && _session.email!.isNotEmpty) {
      return _session.email!;
    }
    switch (role) {
      case UserRole.santri: return 'mnurmiyaty2@gmail.com';
      case UserRole.wali: return 'nurmiyaty.14@gmail.com';
      case UserRole.musyrif: return 'musyrif@smartriayah.com';
      case UserRole.mudir: return 'mudir@smartriayah.com';
      case UserRole.adminRiayah: return 'riayah@smartriayah.com';
      case UserRole.superAdmin: return 'superadmin@smartriayah.com';
      case UserRole.security: return 'security@smartriayah.com';
    }
  }

  Color get _santriPermitColor {
    switch (_santriPermitStatus) {
      case 'DI_ASRAMA': return const Color(0xFF10B981);
      case 'IZIN':      return const Color(0xFFF59E0B);
      case 'DI_LUAR':   return const Color(0xFF38BDF8);
      default:          return const Color(0xFF10B981);
    }
  }

  String get _santriPermitLabel {
    switch (_santriPermitStatus) {
      case 'DI_ASRAMA': return 'Sedang di Asrama';
      case 'IZIN':      return 'Sedang Berizin';
      case 'DI_LUAR':   return 'Sedang di Luar';
      default:          return 'Sedang di Asrama';
    }
  }

  @override
  void initState() {
    super.initState();
    _session = widget.session;
    _userAvatarUrl = _session.photoUrl ?? _getDefaultAvatarForRole(_session.role);
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic);
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  // ─── Role Scoping Logic ─────────────────────────────────────────────────────
  /// Santri dan Wali Santri HANYA melihat data Nurmiyaty (anak / diri sendiri).
  /// Semua role lainnya (Musyrif, Admin Ri'ayah, Mudir, Super Admin, Satpam)
  /// melihat DATA SEMUA SANTRI di pondok secara utuh.
  bool get _isScopedRole =>
      _session.role == UserRole.santri || _session.role == UserRole.wali;

  List<SantriModel> get _roleSantriList {
    if (_isScopedRole) {
      final nur = _allSantriList.where((s) =>
          s.namaLengkap.toLowerCase().contains('nurmiyaty') ||
          s.nis == '125460').toList();
      if (nur.isNotEmpty) {
        final s = nur.first;
        return [
          SantriModel(
            id: s.id,
            nis: s.nis,
            namaLengkap: s.namaLengkap,
            gender: s.gender,
            kelas: s.kelas,
            kamar: s.kamar,
            statusAsrama: _santriPermitStatus,
            poinDisiplin: s.poinDisiplin,
            rfidUid: s.rfidUid,
            namaWali: s.namaWali,
            noWali: s.noWali,
            saldoRfid: s.saldoRfid,
          )
        ];
      }
      return [
        SantriModel(
          id: 'S-105',
          nis: '125460',
          namaLengkap: 'Nurmiyaty',
          gender: 'P',
          kelas: '11 IPA 1',
          kamar: 'Kamar Khadijah (RF-103)',
          statusAsrama: _santriPermitStatus,
          poinDisiplin: 100,
          rfidUid: '73:E2:4F:9A',
          namaWali: 'Hj. Mardiah (Wali Nurmiyaty)',
          noWali: '081234567890',
          saldoRfid: 185000,
        )
      ];
    }
    return _allSantriList;
  }

  List<SantriModel> get _filteredSantriList {
    var list = _roleSantriList;
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.toLowerCase().trim();
      list = list.where((s) =>
          s.namaLengkap.toLowerCase().contains(q) ||
          s.nis.toLowerCase().contains(q) ||
          s.kamar.toLowerCase().contains(q) ||
          s.kelas.toLowerCase().contains(q)).toList();
    }
    if (_selectedCategory == 'Di Asrama') {
      list = list.where((s) => s.isPresent).toList();
    } else if (_selectedCategory == 'Izin / Luar') {
      list = list.where((s) => s.isIzin).toList();
    } else if (_selectedCategory == 'Ikhwan') {
      list = list.where((s) => s.isIkhwan).toList();
    } else if (_selectedCategory == 'Akhwat') {
      list = list.where((s) => s.isAkhwat).toList();
    } else if (_selectedCategory != 'Semua') {
      list = list.where((s) => s.kamar.toLowerCase().contains(_selectedCategory.toLowerCase())).toList();
    }
    return list;
  }

  int get _totalSantri => _isScopedRole ? 1 : _allSantriList.length;
  int get _diAsrama => _isScopedRole
      ? (_roleSantriList.firstOrNull?.isPresent == true ? 1 : 0)
      : _allSantriList.where((s) => s.isPresent).length;
  int get _izin => _isScopedRole
      ? (_roleSantriList.firstOrNull?.isIzin == true ? 1 : 0)
      : _allSantriList.where((s) => s.isIzin).length;
  double get _avgPoin {
    if (_isScopedRole) {
      return (_roleSantriList.firstOrNull?.poinDisiplin ?? 100).toDouble();
    }
    if (_allSantriList.isEmpty) return 100.0;
    final total = _allSantriList.map((s) => s.poinDisiplin).reduce((a, b) => a + b);
    return total / _allSantriList.length;
  }

  SantriModel? get _primarySantri {
    if (_roleSantriList.isNotEmpty) return _roleSantriList.first;
    if (_allSantriList.isNotEmpty) return _allSantriList.first;
    return null;
  }

  // ─── Data Loading ───────────────────────────────────────────────────────────
  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    _animCtrl.reset();

    final online = await SmartRiayahApiService.checkHealth();
    setState(() => _isServerOnline = online);

    // Ambil status real-time langsung dari Vercel Sync DB
    try {
      final syncData = await SmartRiayahApiService.fetchRealtimeOnlineSync();
      if (syncData != null && syncData['statusAsrama'] != null) {
        setState(() {
          _santriPermitStatus = syncData['statusAsrama'].toString();
          _cloudSyncTime = 'Baru saja';
        });
      }
    } catch (_) {}

    try {
      final raw = await SmartRiayahApiService.getSantriList();
      final list = raw.map((j) => SantriModel.fromJson(j)).toList();
      setState(() {
        _allSantriList = list;
        _isLoading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      // Fallback demo data jika offline agar UI tidak pernah blank
      setState(() {
        _errorMessage = e.toString();
        _allSantriList = _getFallbackSantriList();
        _isLoading = false;
      });
      _animCtrl.forward();
    }
  }

  Future<void> _syncWithCloud() async {
    HapticFeedback.lightImpact();
    setState(() => _isSyncingCloud = true);
    try {
      final syncData = await SmartRiayahApiService.fetchRealtimeOnlineSync();
      if (syncData != null && syncData['statusAsrama'] != null) {
        setState(() {
          _santriPermitStatus = syncData['statusAsrama'].toString();
          _cloudSyncTime = '${DateTime.now().hour.toString().padLeft(2, '0')}:${DateTime.now().minute.toString().padLeft(2, '0')} WIB';
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.cloud_done_rounded, color: Colors.white, size: 18),
                  const SizedBox(width: 8),
                  Text('Cloud real-time tersinkron: $_santriPermitLabel'),
                ],
              ),
              backgroundColor: _santriPermitColor,
              duration: const Duration(seconds: 2),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Terhubung ke Cloud Vercel & Supabase • Data mutakhir'),
              backgroundColor: const Color(0xFF059669),
              duration: const Duration(seconds: 1),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _isSyncingCloud = false);
  }

  List<SantriModel> _getFallbackSantriList() {
    return [
      SantriModel(
        id: 'S-105',
        nis: '125460',
        namaLengkap: 'Nurmiyaty',
        gender: 'P',
        kelas: '11 IPA 1',
        kamar: 'Kamar Khadijah (RF-103)',
        statusAsrama: 'DI_ASRAMA',
        poinDisiplin: 100,
        rfidUid: '73:E2:4F:9A',
        namaWali: 'Hj. Mardiah (Wali Nurmiyaty)',
        noWali: '081234567890',
        saldoRfid: 185000,
      ),
      SantriModel(
        id: 'S-101',
        nis: '125456',
        namaLengkap: 'Muhammad Fatih Robbani',
        gender: 'L',
        kelas: '10 IPA 1',
        kamar: 'Kamar Umar bin Khattab (RM-204)',
        statusAsrama: 'DI_ASRAMA',
        poinDisiplin: 98,
        rfidUid: '04:A1:2B:9C',
        namaWali: 'H. Bambang Sudarsono',
        noWali: '081234567895',
        saldoRfid: 125000,
      ),
      SantriModel(
        id: 'S-102',
        nis: '125457',
        namaLengkap: 'Aisyah Putri Azzahra',
        gender: 'P',
        kelas: '11 Keagamaan',
        kamar: 'Kamar Khadijah (RF-102)',
        statusAsrama: 'DI_ASRAMA',
        poinDisiplin: 100,
        rfidUid: '53:67:89:EF',
        namaWali: 'Hj. Nuraini',
        noWali: '081298765432',
        saldoRfid: 85000,
      ),
      SantriModel(
        id: 'S-103',
        nis: '125458',
        namaLengkap: 'Rayhan Dwi Prasetyo',
        gender: 'L',
        kelas: '10 IPA 2',
        kamar: 'Kamar Ali bin Abi Thalib (RM-105)',
        statusAsrama: 'DI_LUAR',
        poinDisiplin: 88,
        rfidUid: '64:98:C1:2A',
        namaWali: 'Drs. Subroto',
        noWali: '085712348899',
        saldoRfid: 45000,
      ),
      SantriModel(
        id: 'S-104',
        nis: '125459',
        namaLengkap: 'Fatima Zahra El-Farabi',
        gender: 'P',
        kelas: '12 IPS 1',
        kamar: 'Kamar Aisyah (RF-201)',
        statusAsrama: 'DI_ASRAMA',
        poinDisiplin: 95,
        rfidUid: '12:89:D4:5B',
        namaWali: 'Ir. H. Syamsudin',
        noWali: '081377889900',
        saldoRfid: 150000,
      ),
    ];
  }

  void _handleSwitchRole(UserRole newRole) {
    // Sekat Privasi 7 Role: Tidak diizinkan pindah role langsung di dalam sesi!
    // Langsung alihkan kembali ke LoginScreen untuk otentikasi role baru.
    _doLogout();
  }

  void _handleMenuSelection(String menuId) {
    setState(() => _activeMenuId = menuId);
    switch (menuId) {
      case 'approval':
      case 'permit':
      case 'permit_form':
      case 'my_permit':
        _goToIzin();
        break;
      case 'riwayat_izin':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => RiwayatIzinScreen(
              filterSantriName: _isScopedRole ? 'Nurmiyaty' : null,
            ),
          ),
        );
        break;
      case 'chat_admin':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChatAdminRiayahScreen(
              namaPengirim: _session.namaLengkap,
              namaSantri: 'Nurmiyaty',
            ),
          ),
        );
        break;
      case 'diagram_mudir':
      case 'ringkasan':
        setState(() => _selectedTab = 2);
        break;
      case 'ai_santri':
      case 'ai_analytics':
      case 'aktivitas':
      case 'ai_tanya':
      case 'dss_pimpinan':
        AiAgentModal.show(context, namaSantri: 'Nurmiyaty', roleUser: _session.role.label);
        break;
      case 'diagnostics':
      case 'rfid_pairing':
      case 'gate_logs':
        _showIotGateSheet();
        break;
      default:
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Membuka modul: $menuId'),
            backgroundColor: const Color(0xFF10B981),
            duration: const Duration(milliseconds: 1500),
          ),
        );
        break;
    }
  }

  void _doLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Keluar dari Akun',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800),
        ),
        content: Text(
          'Yakin ingin keluar dari akun ${_session.namaLengkap} (${_session.role.label})?',
          style: const TextStyle(color: Color(0xFF475569), fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
  }

  void _goToIzin() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => SubmitIzinScreen(santriList: _roleSantriList)),
    );
    if (result == true) _loadData();
  }

  void _showSantriDetail(SantriModel s) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SantriDetailSheet(
        santri: s,
        onSubmitIzin: () {
          Navigator.pop(context);
          _goToIzin();
        },
        onSimulateTap: () {
          Navigator.pop(context);
          _simulateGateTap(s);
        },
      ),
    );
  }

  void _simulateGateTap(SantriModel s) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF059669), Color(0xFF047857)],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF059669).withValues(alpha: 0.3),
                    blurRadius: 16,
                  ),
                ],
              ),
              child: const Icon(Icons.sensor_door_rounded, size: 36, color: Colors.white),
            ),
            const SizedBox(height: 16),
            const Text(
              'Gate 01 Terbuka!',
              style: TextStyle(color: Color(0xFF0F172A), fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              'Kartu RFID ${s.rfidUid ?? "13.56 MHz"} berhasil diverifikasi.',
              style: const TextStyle(color: Color(0xFF059669), fontSize: 12, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Text(s.namaLengkap, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text('Status: Di Asrama • Saldo: ${s.saldoFormatted}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('OK'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showIotGateSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.memory_rounded, color: Color(0xFF059669), size: 22),
                ),
                const SizedBox(width: 12),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Diagnostik IoT Smart Gate 01', style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.w800)),
                    Text('Hardware RC522 RFID & ESP32 NodeMCU', style: TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildIotDetailRow('Mikrokontroler', 'NodeMCU ESP32 (38-pin, 240MHz)'),
            _buildIotDetailRow('Sensor RFID', 'RC522 13.56 MHz (SPI Protocol)'),
            _buildIotDetailRow('Servo Gate Barrier', 'MG996R Metal Gear (Pin D18)'),
            _buildIotDetailRow('Buzzer & LED Indikator', 'Pin D19 / D21 (Buzzer Bip 80dB)'),
            _buildIotDetailRow('Koneksi Server Lokal', _isServerOnline ? 'Terhubung (Online via Port 5000)' : 'Offline / Standby'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.pop(ctx),
                icon: const Icon(Icons.check_rounded),
                label: const Text('Selesai'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIotDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
          Text(value, style: const TextStyle(color: Color(0xFF0F172A), fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  // ─── Main Scaffold Build ────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: AppSidebarDrawer(
        session: _session,
        currentRoute: _activeMenuId,
        onSelectMenu: _handleMenuSelection,
        onSwitchRole: _handleSwitchRole,
        onLogout: _doLogout,
      ),
      body: Column(
        children: [
          _buildSessionAppBar(),
          Expanded(
            child: _isLoading
                ? _buildLoadingState()
                : RefreshIndicator(
                    onRefresh: _loadData,
                    color: const Color(0xFF059669),
                    backgroundColor: Colors.white,
                    child: FadeTransition(
                      opacity: _fadeAnim,
                      child: _buildBody(),
                    ),
                  ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(),
      floatingActionButton: _buildFloatingActions(),
    );
  }

  // ─── Header / App Bar (Clean Emerald Pesantren Styling) ────────────────────
  Widget _buildSessionAppBar() {
    final role = _session.role;
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF065F46), Color(0xFF047857)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x1A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
          child: Row(
            children: [
              // ☰ Hamburger Button
              Builder(
                builder: (ctx) => InkWell(
                  onTap: () => Scaffold.of(ctx).openDrawer(),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                    ),
                    child: const Icon(Icons.menu_rounded, color: Colors.white, size: 20),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // User Avatar Photo -> navigates to Tab 4 (Profil & Sistem di Pojok Kanan)
              InkWell(
                onTap: () => setState(() => _selectedTab = 4),
                borderRadius: BorderRadius.circular(18),
                child: CircleAvatar(
                  radius: 17,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  backgroundImage: _userAvatarUrl != null ? NetworkImage(_userAvatarUrl!) : null,
                  child: _userAvatarUrl == null
                      ? Text(
                          _session.namaLengkap.isNotEmpty ? _session.namaLengkap[0] : 'U',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                        )
                      : null,
                ),
              ),
              const SizedBox(width: 10),

              // User Info with clean badge
              Expanded(
                child: Builder(
                  builder: (ctx) => InkWell(
                    onTap: () => Scaffold.of(ctx).openDrawer(),
                    borderRadius: BorderRadius.circular(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _session.namaLengkap,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 0.8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(role.icon, size: 10, color: Colors.white),
                                  const SizedBox(width: 4),
                                  Text(
                                    role.label,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 6),
                            Flexible(child: _buildGateLivePulse()),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Server Status Pill
              _buildServerChip(),
              const SizedBox(width: 8),

              // Quick AI trigger
              InkWell(
                onTap: () => AiAgentModal.show(
                  context,
                  namaSantri: 'Nurmiyaty',
                  roleUser: _session.role.label,
                ),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                  ),
                  child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 18),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGateLivePulse() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFFA7F3D0),
          ),
        ),
        const SizedBox(width: 4),
        const Text(
          'Gate 01 Siap',
          style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 10, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildServerChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _isServerOnline
            ? Colors.white.withValues(alpha: 0.2)
            : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: _isServerOnline
              ? Colors.white.withValues(alpha: 0.35)
              : const Color(0xFFEF4444),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isServerOnline ? const Color(0xFFA7F3D0) : const Color(0xFFDC2626),
            ),
          ),
          const SizedBox(width: 4),
          Text(
            _isServerOnline ? 'Online' : 'Offline',
            style: TextStyle(
              color: _isServerOnline ? Colors.white : const Color(0xFFDC2626),
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Body Switcher (Dilindungi Dinding Sekat 7 Role) ────────────────────────
  Widget _buildBody() {
    switch (_selectedTab) {
      case 0: return _buildDashboardTab();
      case 1: return _buildSantriDirectoryTab(); // Tab 1: Direktori Santri
      case 2: return _buildRoleDedicatedTab();
      case 3: return _buildIzinAndChatTab();
      default: return _buildRoleProfileTab(); // Tab 4 (Pojok Kanan): Profil & Sistem Jadi 1
    }
  }

  // ─── TAB 4 (POJOK KANAN): PROFIL RESMI PER ROLE & SISTEM ────────────────────
  Widget _buildRoleProfileTab() {
    final role = _session.role;
    final email = _getOfficialEmailForRole(role);
    final avatar = _userAvatarUrl ?? _getDefaultAvatarForRole(role);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // ─── Header: Profil & Sistem Terpadu (Pojok Kanan Nav Bar) ───────────
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Icon(Icons.manage_accounts_rounded, color: Color(0xFF059669), size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Profil & Sistem Terpadu',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.3,
                      ),
                    ),
                    Text(
                      'Kelola foto profil, akun Google resmi & ekosistem cloud',
                      style: TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ─── 1. Hero Profile Card ─────────────────────────────────────────────
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              // Top banner accent
              Container(
                height: 75,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [role.accentColor.withValues(alpha: 0.85), role.accentColor],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(23)),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      right: 16,
                      top: 14,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.cloud_done_rounded, color: Colors.white, size: 12),
                            SizedBox(width: 4),
                            Text(
                              'Live Cloud',
                              style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Avatar with camera badge
              Transform.translate(
                offset: const Offset(0, -42),
                child: Column(
                  children: [
                    Center(
                      child: Stack(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: CircleAvatar(
                              radius: 44,
                              backgroundColor: const Color(0xFFF1F5F9),
                              backgroundImage: NetworkImage(avatar),
                            ),
                          ),
                          Positioned(
                            bottom: 2,
                            right: 2,
                            child: InkWell(
                              onTap: _showAvatarChangeModal,
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.all(7),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF059669), Color(0xFF10B981)],
                                  ),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2.5),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF059669).withValues(alpha: 0.35),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 16),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),

                    // User name
                    Text(
                      _session.namaLengkap,
                      style: const TextStyle(
                        color: Color(0xFF0F172A),
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 4),

                    // Role Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: role.accentColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: role.accentColor.withValues(alpha: 0.25)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(role.icon, size: 12, color: role.accentColor),
                          const SizedBox(width: 5),
                          Text(
                            role.label,
                            style: TextStyle(
                              color: role.accentColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // "Ganti Foto Profil" button
                    OutlinedButton.icon(
                      onPressed: _showAvatarChangeModal,
                      icon: const Icon(Icons.photo_library_rounded, size: 15, color: Color(0xFF059669)),
                      label: const Text(
                        'Ganti Foto Profil',
                        style: TextStyle(color: Color(0xFF059669), fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFA7F3D0)),
                        backgroundColor: const Color(0xFFECFDF5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ─── 2. Akun Google Resmi Terhubung Card ─────────────────────────────
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Center(
                  child: Text(
                    'G',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      foreground: Paint()
                        ..shader = const LinearGradient(
                          colors: [Color(0xFF4285F4), Color(0xFFEA4335), Color(0xFFFBBC05), Color(0xFF34A853)],
                        ).createShader(const Rect.fromLTWH(0.0, 0.0, 24.0, 24.0)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Akun Google Resmi Terhubung',
                      style: TextStyle(
                        color: Color(0xFF0F172A),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      email,
                      style: const TextStyle(
                        color: Color(0xFF2563EB),
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Terverifikasi • Cloud Vercel & Supabase',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 10),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Text(
                  'Aktif',
                  style: TextStyle(color: Color(0xFF059669), fontSize: 10, fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ─── 3. Identity Detail per Role ─────────────────────────────────────
        _buildRoleSpecificIdentityGrid(role),
        const SizedBox(height: 14),

        // ─── 4. Cloud & Server Status ─────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(16),
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
                  Icon(Icons.cloud_sync_rounded, color: Color(0xFF059669), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Status Cloud Database',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildProfileDetailRow('Deploy Web Vercel', 'smart-riayah.vercel.app'),
              _buildProfileDetailRow('Sync Endpoint', '/api/sync (Realtime Online)'),
              _buildProfileDetailRow('Database Utama', 'Supabase PostgreSQL Cloud'),
              _buildProfileDetailRow('Sinkronisasi Terakhir', _cloudSyncTime),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _syncWithCloud,
                  icon: const Icon(Icons.sync_rounded, size: 16),
                  label: const Text('Sinkronkan Cloud Sekarang'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF059669),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ─── 5. Info Sistem Terpadu ──────────────────────────────────────────
        _buildInfoCard(
          title: 'Smart Riayah Mobile',
          subtitle: 'Versi 2.0.0 • Pesantren Edition',
          icon: Icons.school_rounded,
          color: const Color(0xFF059669),
        ),
        const SizedBox(height: 10),
        _buildInfoCard(
          title: 'Server Backend Online',
          subtitle: SmartRiayahApiService.baseUrl,
          icon: Icons.dns_rounded,
          color: _isServerOnline ? const Color(0xFF059669) : const Color(0xFFDC2626),
          statusBadge: _isServerOnline ? 'Online' : 'Offline',
        ),
        const SizedBox(height: 10),
        _buildInfoCard(
          title: 'Cakupan Data Santri',
          subtitle: _isScopedRole ? 'Mode Terisolasi: Nurmiyaty' : 'Mode Lengkap: ${_allSantriList.length} Santri Pondok',
          icon: Icons.groups_rounded,
          color: const Color(0xFF0284C7),
        ),
        const SizedBox(height: 18),

        // ─── 6. Actions: Switch Role & Logout ────────────────────────────────
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _handleSwitchRole(UserRole.santri),
                icon: const Icon(Icons.swap_horiz_rounded, size: 16),
                label: const Text('Beralih Role', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF0284C7),
                  side: const BorderSide(color: Color(0xFFBAE6FD)),
                  backgroundColor: const Color(0xFFF0F9FF),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _doLogout,
                icon: const Icon(Icons.logout_rounded, size: 16),
                label: const Text('Keluar Akun', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFFECACA)),
                  backgroundColor: const Color(0xFFFEF2F2),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRoleSpecificIdentityGrid(UserRole role) {
    List<Map<String, String>> items = [];

    switch (role) {
      case UserRole.santri:
        items = [
          {'label': 'NIS Santri', 'value': '125460'},
          {'label': 'Kelas Formal', 'value': '11 IPA 1 (Aliyah)'},
          {'label': 'Kamar Asrama', 'value': 'Khadijah RF-103'},
          {'label': 'Status Kehadiran', 'value': _santriPermitLabel},
          {'label': 'Poin Disiplin', 'value': '100 / 100 Pts'},
          {'label': 'Saldo RFID', 'value': 'Rp 185.000'},
          {'label': 'UID RFID Gate', 'value': '73:E2:4F:9A'},
          {'label': 'Nama Wali', 'value': 'Hj. Mardiah'},
        ];
        break;

      case UserRole.wali:
        items = [
          {'label': 'Hubungan Keluarga', 'value': 'Ibu Kandung Resmi'},
          {'label': 'Santri Binaan', 'value': 'Nurmiyaty (11 IPA 1)'},
          {'label': 'Kamar Santri', 'value': 'Khadijah RF-103'},
          {'label': 'Status Anak', 'value': _santriPermitLabel},
          {'label': 'No. WhatsApp', 'value': '0812-3456-7890'},
          {'label': 'Saldo Jajan Anak', 'value': 'Rp 185.000'},
          {'label': 'Alamat Rumah', 'value': 'Surabaya, Jawa Timur'},
          {'label': 'Perizinan Terakhir', 'value': 'IZN-2026-089 (Disetujui)'},
        ];
        break;

      case UserRole.mudir:
        items = [
          {'label': 'Jabatan', 'value': 'Pimpinan Pesantren Modern'},
          {'label': 'NIP Pimpinan', 'value': 'DU-MDR-001'},
          {'label': 'Otoritas', 'value': 'DSS AI Analytics & Audit Penuh'},
          {'label': 'Cakupan Asrama', 'value': 'Seluruh Kompleks Pondok'},
          {'label': 'Jumlah Santri', 'value': '${_allSantriList.length} Santri Terdaftar'},
          {'label': 'Kondisi Gerbang', 'value': 'Gate 01 Siap Standby'},
        ];
        break;

      case UserRole.musyrif:
        items = [
          {'label': 'Jabatan', 'value': 'Pengasuh Asrama & Evaluasi Adab'},
          {'label': 'NIP Musyrif', 'value': 'DU-MSR-004'},
          {'label': 'Asrama Binaan', 'value': 'Gedung Umar & Khadijah'},
          {'label': 'Kapasitas Binaan', 'value': '32 Santri Aktif'},
          {'label': 'Pemeriksaan Malam', 'value': 'Setiap 22:00 WIB'},
          {'label': 'Otorisasi Izin', 'value': 'Akses Penuh Lapangan'},
        ];
        break;

      case UserRole.adminRiayah:
        items = [
          {'label': 'Jabatan', 'value': 'Administrasi Surat Izin & Asrama'},
          {'label': 'NIP Admin', 'value': 'DU-ADM-002'},
          {'label': 'Sistem Notifikasi', 'value': 'Fonnte WhatsApp Gateway'},
          {'label': 'Server Terhubung', 'value': 'Vercel Serverless Sync'},
          {'label': 'Basis Data', 'value': 'Supabase PostgreSQL'},
          {'label': 'Pelayanan Wali', 'value': '08:00 - 17:00 WIB'},
        ];
        break;

      case UserRole.superAdmin:
        items = [
          {'label': 'Level Akses', 'value': 'Root Super Administrator'},
          {'label': 'NIP', 'value': 'DU-SA-001'},
          {'label': 'Hardware IoT', 'value': 'ESP32 Smart Gate (38-pin)'},
          {'label': 'Reader RFID', 'value': 'RC522 13.56 MHz (SPI)'},
          {'label': 'Multi-Role Engine', 'value': '7 Role Dinding Sekat Aktif'},
          {'label': 'Cloud Hosting', 'value': 'Vercel Production & Supabase'},
        ];
        break;

      case UserRole.security:
        items = [
          {'label': 'Pos Keamanan', 'value': 'Pos Gerbang Utama (Gate 01)'},
          {'label': 'NIP Satpam', 'value': 'DU-SEC-001'},
          {'label': 'Perangkat Gate', 'value': 'Barrier Gate Otomatis Servo'},
          {'label': 'Status RFID', 'value': 'RC522 Mode Pembacaan Aktif'},
          {'label': 'Verifikasi Izin', 'value': 'QR Code & RFID Matching'},
          {'label': 'Prosedur Keluar', 'value': 'Wajib Didampingi Wali Resmi'},
        ];
        break;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(role.icon, color: role.accentColor, size: 18),
              const SizedBox(width: 8),
              Text(
                'Data Profil ${role.label}',
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: items.map((item) {
              return Container(
                width: 155,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['label']!,
                      style: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item['value']!,
                      style: const TextStyle(
                        color: Color(0xFF0F172A),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11.5)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 11.5, fontWeight: FontWeight.w700),
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  void _showAvatarChangeModal() {
    HapticFeedback.mediumImpact();
    final List<Map<String, String>> avatarPresets = [
      {
        'title': 'Santriwati Khadijah',
        'url': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
        'desc': 'Hijab Hijau',
      },
      {
        'title': 'Santriwati Aisyah',
        'url': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        'desc': 'Hijab Syar\'i',
      },
      {
        'title': 'Ibu Muslimah / Wali',
        'url': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
        'desc': 'Wali Santri',
      },
      {
        'title': 'Santri Putra Teladan',
        'url': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
        'desc': 'Peci Putih',
      },
      {
        'title': 'Ustadz Pengasuh',
        'url': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        'desc': 'Peci Hitam',
      },
      {
        'title': 'Kyai / Pimpinan',
        'url': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
        'desc': 'Pengasuh',
      },
      {
        'title': 'Admin Ri\'ayah IT',
        'url': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
        'desc': 'Staf IT',
      },
      {
        'title': 'Petugas Keamanan',
        'url': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
        'desc': 'Satpam Gate',
      },
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Pilih Foto Profil / Avatar',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close_rounded, size: 20),
                    style: IconButton.styleFrom(
                      padding: const EdgeInsets.all(4),
                      minimumSize: const Size(28, 28),
                    ),
                  ),
                ],
              ),
              const Text(
                'Sesuaikan foto profil untuk role aktif Anda di Smart Riayah',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 11.5),
              ),
              const SizedBox(height: 18),

              // Avatar Grid
              Wrap(
                spacing: 12,
                runSpacing: 14,
                children: avatarPresets.map((preset) {
                  final isSelected = _userAvatarUrl == preset['url'];
                  return InkWell(
                    onTap: () {
                      _changeProfileAvatar(preset['url']!, preset['title']!);
                      Navigator.pop(ctx);
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 76,
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFECFDF5) : Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF059669) : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundImage: NetworkImage(preset['url']!),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            preset['desc']!,
                            style: TextStyle(
                              color: isSelected ? const Color(0xFF059669) : const Color(0xFF334155),
                              fontSize: 10,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            ),
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Custom Photo Upload Option
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _changeProfileAvatar(
                      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
                      'Foto Baru Diunggah',
                    );
                  },
                  icon: const Icon(Icons.add_a_photo_rounded, size: 16),
                  label: const Text('Ambil Foto Baru (Kamera / Galeri)'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF059669),
                    side: const BorderSide(color: Color(0xFF059669)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _changeProfileAvatar(String newUrl, String avatarName) {
    HapticFeedback.mediumImpact();
    setState(() {
      _userAvatarUrl = newUrl;
      _session = _session.copyWith(photoUrl: newUrl);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text('Foto profil diperbarui: $avatarName'),
          ],
        ),
        backgroundColor: const Color(0xFF059669),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  // ─── Dinding Sekat: Tab 2 Khusus Sesuai Hak Akses Role ───────────────────────
  Widget _buildRoleDedicatedTab() {
    switch (_session.role) {
      case UserRole.santri:
        return _buildSantriMutabaahTab();
      case UserRole.wali:
        return _buildWaliRaporTab();
      case UserRole.musyrif:
        return _buildMusyrifPresensiTab();
      case UserRole.security:
        return _buildSecurityGateTab();
      case UserRole.adminRiayah:
        return _buildAdminRiayahTab();
      case UserRole.mudir:
      case UserRole.superAdmin:
        return const MudirChartsView();
    }
  }

  // ─── TAB 2: SANTRI (Mutaba'ah & Ibadah Harian Nurmiyaty) ─────────────────────
  Widget _buildSantriMutabaahTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Role Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF065F46), Color(0xFF059669)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF059669).withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
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
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'ROLE: SANTRI AKTIF',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  const Text(
                    'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا',
                    style: TextStyle(
                      color: Color(0xFFA7F3D0),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Buku Mutaba\'ah & Ibadah Harian',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Catatan kedisiplinan sholat berjamaah, setoran Qur\'an tahfidz, dan adab harian santri Nurmiyaty.',
                style: TextStyle(color: Color(0xFFD1FAE5), fontSize: 11.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Live Real-Time Permit Status Card
        _buildSantriRealtimePermitStatusCard(),
        const SizedBox(height: 16),

        // KPI Ringkasan Ibadah
        Row(
          children: [
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Sholat 5 Waktu',
                value: '5/5 Waktu',
                sub: 'Berjamaah tepat waktu',
                icon: Icons.mosque_rounded,
                color: const Color(0xFF059669),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Halaqah Tahfidz',
                value: 'Mumtaz',
                sub: 'Juz 30 Lancar',
                icon: Icons.menu_book_rounded,
                color: const Color(0xFF0284C7),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Poin Adab',
                value: '100 Pts',
                sub: '0 Pelanggaran',
                icon: Icons.military_tech_rounded,
                color: const Color(0xFFD97706),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Presensi Sholat 5 Waktu
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.access_time_rounded, color: Color(0xFF059669), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Presensi Sholat Berjamaah Hari Ini',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildSholatCheckItem('Shubuh', '04:35 WIB', 'Musholla Putri Khadijah', true),
              _buildSholatCheckItem('Dzuhur', '12:05 WIB', 'Masjid Jami\' Pondok', true),
              _buildSholatCheckItem('Ashar', '15:30 WIB', 'Musholla Putri Khadijah', true),
              _buildSholatCheckItem('Maghrib', '18:15 WIB', 'Masjid Jami\' Pondok', true),
              _buildSholatCheckItem('Isya\' & Tadarus', '19:30 WIB', 'Masjid Jami\' Pondok', true),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Setoran Tahfidz Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.auto_stories_rounded, color: Color(0xFF0284C7), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Setoran Tahfidz & Ziyadah Qur\'an',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Surat An-Naba\' (1-40)', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 13)),
                        Text('Mumtaz (A)', style: TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.w800, fontSize: 12)),
                      ],
                    ),
                    SizedBox(height: 4),
                    Text('Penguji: Ustadzah Maryam S.Ag • Kemarin, 16:30 WIB', style: TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                    SizedBox(height: 6),
                    Text('"Makharijul huruf sangat fasih, waqaf wal ibtida\' tepat. Lanjutkan ke Surat An-Nazi\'at."',
                        style: TextStyle(color: Color(0xFF334155), fontSize: 11.5, fontStyle: FontStyle.italic)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── TAB 2: WALI SANTRI (Rapor & Evaluasi Ananda Nurmiyaty) ───────────────────
  Widget _buildWaliRaporTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Role Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F766E), Color(0xFF0D9488)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0D9488).withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
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
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text(
                      'ROLE: WALI SANTRI',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  const Text(
                    'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ',
                    style: TextStyle(
                      color: Color(0xFF99F6E4),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Rapor & Evaluasi Ananda Nurmiyaty',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Pemantauan adab, perkembangan tahfidz, dan saldo saku ananda tercinta di Pondok Pesantren.',
                style: TextStyle(color: Color(0xFFCCFBF1), fontSize: 11.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // KPI Ringkasan
        Row(
          children: [
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Kedisiplinan',
                value: '98.2%',
                sub: 'Sangat Disiplin',
                icon: Icons.verified_rounded,
                color: const Color(0xFF0D9488),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Saldo RFID Saku',
                value: 'Rp 185.000',
                sub: 'Koperasi & Kantin',
                icon: Icons.account_balance_wallet_rounded,
                color: const Color(0xFF059669),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Status Keberadaan',
                value: 'Di Asrama',
                sub: 'Kamar Khadijah',
                icon: Icons.night_shelter_rounded,
                color: const Color(0xFF0284C7),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Catatan Musyrifah untuk Orang Tua
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.rate_review_rounded, color: Color(0xFF0D9488), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Catatan Musyrifah untuk Wali Santri',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ustadzah Maryam S.Ag (Musyrifah Asrama Khadijah)',
                      style: TextStyle(color: Color(0xFF0D9488), fontWeight: FontWeight.w700, fontSize: 12),
                    ),
                    SizedBox(height: 4),
                    Text(
                      '"Alhamdulillah ananda Nurmiyaty sangat istiqomah dalam halaqah sholat berjamaah dan muroja\'ah Qur\'an. Bersikap santun kepada asatidz dan teman sekamar. Saldo uang saku ananda tercukupi dengan baik."',
                      style: TextStyle(color: Color(0xFF334155), fontSize: 11.5, height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChatAdminRiayahScreen(
                              namaPengirim: _session.namaLengkap,
                              namaSantri: 'Nurmiyaty',
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.chat_rounded, size: 16),
                      label: const Text('Hubungi Pengasuh'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0D9488),
                        side: const BorderSide(color: Color(0xFF0D9488)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _goToIzin,
                      icon: const Icon(Icons.send_rounded, size: 16),
                      label: const Text('Kirim Izin Ananda'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0D9488),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── TAB 2: MUSYRIF (Presensi & Kontrol Kamar Binaan) ─────────────────────────
  Widget _buildMusyrifPresensiTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Role Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF3730A3), Color(0xFF4338CA)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF4338CA).withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'ROLE: MUSYRIF / PENGASUH ASRAMA',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Presensi Asrama & Kamar Binaan',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Kontrol apel malam, kepatuhan jam malam santri, dan validasi izin kamar.',
                style: TextStyle(color: Color(0xFFE0E7FF), fontSize: 11.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // KPI Ringkasan
        Row(
          children: [
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Total Binaan',
                value: '${_allSantriList.length} Santri',
                sub: '4 Kamar Asrama',
                icon: Icons.groups_rounded,
                color: const Color(0xFF4338CA),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Di Asrama',
                value: '4 Santri',
                sub: 'Presensi Lengkap',
                icon: Icons.verified_user_rounded,
                color: const Color(0xFF059669),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Izin Luar',
                value: '1 Santri',
                sub: 'Izin Berobat RS',
                icon: Icons.medical_services_rounded,
                color: const Color(0xFFD97706),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Kamar List Presensi
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.bed_rounded, color: Color(0xFF4338CA), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Status Kamar Asrama',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildKamarRow('Kamar Khadijah (RF-102)', 'Nurmiyaty & Siti Aisyah', '2/2 Hadir', true),
              _buildKamarRow('Kamar Ali bin Abi Thalib', 'Rayhan Dwi Prasetyo', '1 Izin RS', false),
              _buildKamarRow('Kamar Umar bin Khattab', 'Muhammad Fatih Robbani', '1/1 Hadir', true),
              _buildKamarRow('Kamar Aisyah (RF-201)', 'Fatima Zahra El-Farabi', '1/1 Hadir', true),
            ],
          ),
        ),
      ],
    );
  }

  // ─── TAB 2: SATPAM (Smart Gate 01 Scanner & Monitor) ─────────────────────────
  Widget _buildSecurityGateTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Role Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFB45309), Color(0xFFD97706)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFD97706).withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'ROLE: SATPAM / KEAMANAN GERBANG',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Smart Gate 01 Scanner & Monitor',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Pos Jaga Gerbang Utama Pesantren • Kontrol Barrier Gate IoT & Verifikasi RFID.',
                style: TextStyle(color: Color(0xFFFEF3C7), fontSize: 11.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // KPI Ringkasan
        Row(
          children: [
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Barrier Gate 01',
                value: 'Terkunci',
                sub: 'Auto Safe Mode',
                icon: Icons.shield_rounded,
                color: const Color(0xFF059669),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'RFID Hardware',
                value: 'Online',
                sub: '13.56 MHz Reader',
                icon: Icons.nfc_rounded,
                color: const Color(0xFF0284C7),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Santri Keluar',
                value: '1 Santri',
                sub: 'Semua Izin Resmi',
                icon: Icons.exit_to_app_rounded,
                color: const Color(0xFFD97706),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Aksi Palang Pintu Gerbang
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.sensor_door_rounded, color: Color(0xFFD97706), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Kontrol Manual Barrier Gate Pos Jaga',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        final nur = _allSantriList.firstWhere(
                          (s) => s.namaLengkap.toLowerCase().contains('nurmiyaty'),
                          orElse: () => _allSantriList.first,
                        );
                        _simulateGateTap(nur);
                      },
                      icon: const Icon(Icons.tap_and_play_rounded, size: 16),
                      label: const Text('Simulasi Tap RFID'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _showIotGateSheet,
                      icon: const Icon(Icons.settings_remote_rounded, size: 16),
                      label: const Text('Status IoT Gerbang'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFD97706),
                        side: const BorderSide(color: Color(0xFFD97706)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── TAB 2: ADMIN RI'AYAH (Pusat Rekapitulasi Perizinan & Asrama) ──────────────
  Widget _buildAdminRiayahTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Role Banner
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF065F46), Color(0xFF047857)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF059669).withValues(alpha: 0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'ROLE: ADMINISTRASI RI\'AYAH',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Pusat Rekapitulasi Perizinan Pondok',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Manajemen master perizinan santri, penugasan kamar asrama, dan arsip legalitas santri.',
                style: TextStyle(color: Color(0xFFD1FAE5), fontSize: 11.5),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // KPI Ringkasan
        Row(
          children: [
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Total Santri',
                value: '${_allSantriList.length} Santri',
                sub: 'Terdaftar Aktif',
                icon: Icons.groups_rounded,
                color: const Color(0xFF059669),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Di Asrama',
                value: '4 Santri',
                sub: '80% Berada di Pondok',
                icon: Icons.night_shelter_rounded,
                color: const Color(0xFF0284C7),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildRoleMiniStat(
                title: 'Izin Luar',
                value: '1 Santri',
                sub: 'Rayhan (Sakit RS)',
                icon: Icons.exit_to_app_rounded,
                color: const Color(0xFFD97706),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Action Menu Administrasi
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.assignment_rounded, color: Color(0xFF059669), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Arsip & Pembuatan Surat Izin',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _goToIzin,
                      icon: const Icon(Icons.add_circle_outline_rounded, size: 16),
                      label: const Text('Buat Surat Izin'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => const RiwayatIzinScreen(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.folder_shared_rounded, size: 16),
                      label: const Text('Buka Arsip Izin'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF059669),
                        side: const BorderSide(color: Color(0xFF059669)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  // Helper widgets for dedicated role tabs
  Widget _buildRoleMiniStat({
    required String title,
    required String value,
    required String sub,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w800),
          ),
          Text(
            title,
            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 11, fontWeight: FontWeight.w600),
          ),
          Text(
            sub,
            style: const TextStyle(color: Color(0xFF64748B), fontSize: 9.5),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildSholatCheckItem(String waktu, String jam, String tempat, bool hadir) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            hadir ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            color: hadir ? const Color(0xFF059669) : const Color(0xFF94A3B8),
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(waktu, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 12.5)),
                Text(tempat, style: const TextStyle(color: Color(0xFF64748B), fontSize: 10.5)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              jam,
              style: const TextStyle(color: Color(0xFF059669), fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKamarRow(String namaKamar, String santri, String status, bool lengkap) {
    final color = lengkap ? const Color(0xFF059669) : const Color(0xFFD97706);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(namaKamar, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 12.5)),
                Text(santri, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: color.withValues(alpha: 0.25)),
            ),
            child: Text(
              status,
              style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Status Izin & Kehadiran Santri Real-Time ─────────────────────────────
  Widget _buildSantriRealtimePermitStatusCard() {
    Color bgCard;
    Color borderColor;
    Color iconColor;
    IconData statusIcon;
    String statusTitle;
    String statusDesc;
    String badgeText;
    String liveTime;

    switch (_santriPermitStatus) {
      case 'DI_ASRAMA':
        bgCard = const Color(0xFFECFDF5);
        borderColor = const Color(0xFFA7F3D0);
        iconColor = const Color(0xFF059669);
        statusIcon = Icons.apartment_rounded;
        statusTitle = 'SEDANG DI ASRAMA';
        statusDesc = 'Nurmiyaty tercatat berada di dalam lingkungan asrama (Kamar Khadijah RF-103). Presensi sholat berjamaah & mutaba\'ah aktif.';
        badgeText = '🟢 Di Asrama (Tap IN)';
        liveTime = 'Terakhir Tap Gate: 17:30 WIB';
        break;
      case 'IZIN':
        bgCard = const Color(0xFFFFFBEB);
        borderColor = const Color(0xFFFDE68A);
        iconColor = const Color(0xFFD97706);
        statusIcon = Icons.assignment_turned_in_rounded;
        statusTitle = 'SEDANG BERIZIN';
        statusDesc = 'Surat Izin IZN-2026-089 telah disetujui Musyrif & Admin. Kartu RFID UID 73:E2:4F:9A aktif dan siap tap di Gate 01.';
        badgeText = '🟡 Izin Disetujui (Siap Keluar)';
        liveTime = 'Batas Waktu Keluar: Hari ini 16:30 WIB';
        break;
      case 'DI_LUAR':
      default:
        bgCard = const Color(0xFFEFF6FF);
        borderColor = const Color(0xFFBFDBFE);
        iconColor = const Color(0xFF2563EB);
        statusIcon = Icons.exit_to_app_rounded;
        statusTitle = 'SEDANG DI LUAR ASRAMA';
        statusDesc = 'Santri telah tap OUT di Gate 01 bersama penjemput resmi (Hj. Mardiah). Sisa batas waktu kembali sedang dihitung sistem.';
        badgeText = '🔵 Sedang di Luar Asrama';
        liveTime = 'Batas Waktu Kembali: Ahad, 17:00 WIB';
        break;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'STATUS REAL-TIME SANTRI',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: bgCard,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderColor),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(color: iconColor, fontSize: 10, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Main Status Highlight Box
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: bgCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderColor),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: borderColor),
                  ),
                  child: Icon(statusIcon, color: iconColor, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        statusTitle,
                        style: TextStyle(
                          color: iconColor,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        statusDesc,
                        style: const TextStyle(
                          color: Color(0xFF334155),
                          fontSize: 11.5,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        liveTime,
                        style: TextStyle(
                          color: iconColor,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ─── Realtime Cloud Sync Bar (Vercel & Supabase Connected) ───────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Container(
                  width: 9,
                  height: 9,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFF10B981),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Cloud Sync: smart-riayah.vercel.app',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        'Status real-time otomatis dari database web terdeploy • $_cloudSyncTime',
                        style: const TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
                InkWell(
                  onTap: _syncWithCloud,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: _isSyncingCloud
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF059669)),
                          )
                        : const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.sync_rounded, size: 14, color: Color(0xFF059669)),
                              SizedBox(width: 4),
                              Text(
                                'Sinkron',
                                style: TextStyle(
                                  color: Color(0xFF059669),
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashboardTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        if (_errorMessage.isNotEmpty) ...[
          _buildErrorBanner(),
          const SizedBox(height: 12),
        ],
        // Role Scope Indicator Banner
        _buildRoleScopeBanner(),
        const SizedBox(height: 14),

        // Live Real-Time Permit & Presence Status Card (Khusus Santri & Wali)
        if (_isScopedRole) ...[
          _buildSantriRealtimePermitStatusCard(),
          const SizedBox(height: 14),
        ],

        // Hero Component: Kartu Santri Digital (Santri/Wali) OR Status Kehadiran Asrama (Lainnya)
        if (_isScopedRole && _primarySantri != null)
          _buildHolographicCard(_primarySantri!)
        else
          _buildCommandCenterHero(),

        const SizedBox(height: 20),

        // Quick Actions Grid
        _buildSectionHeader('Aksi Cepat Smart Riayah', Icons.flash_on_rounded),
        const SizedBox(height: 10),
        _buildDashboardQuickActions(),

        const SizedBox(height: 22),

        // Stats Grid
        _buildSectionHeader(
          _isScopedRole ? 'Status Disiplin Santri' : 'Statistik Pondok & Asrama',
          Icons.analytics_rounded,
        ),
        const SizedBox(height: 10),
        _buildStatsGrid(),

        const SizedBox(height: 22),

        // Real-Time Activity Feed
        _buildRealTimeActivityFeed(),

        const SizedBox(height: 22),

        // Santri Directory Preview
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildSectionHeader(
              _isScopedRole ? 'Data Profil Santri' : 'Daftar Santri (${_roleSantriList.length})',
              Icons.badge_rounded,
            ),
            if (!_isScopedRole)
              GestureDetector(
                onTap: () => setState(() => _selectedTab = 1),
                child: const Text(
                  'Lihat semua santri →',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF059669),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        ..._roleSantriList.take(_isScopedRole ? 1 : 3).map(
          (s) => SantriCard(santri: s, onTap: () => _showSantriDetail(s)),
        ),
      ],
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Mode Offline: Menggunakan data cache lokal. ($_errorMessage)',
              style: const TextStyle(color: Color(0xFF92400E), fontSize: 11),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoleScopeBanner() {
    if (_isScopedRole) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFA7F3D0)),
        ),
        child: Row(
          children: [
            const Icon(Icons.verified_user_rounded, color: Color(0xFF059669), size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _session.role == UserRole.santri
                    ? 'Akses Terverifikasi: Menampilkan data pribadi Anda (Nurmiyaty).'
                    : 'Akses Wali Terverifikasi: Menampilkan data ananda Nurmiyaty.',
                style: const TextStyle(color: Color(0xFF065F46), fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Row(
        children: [
          const Icon(Icons.admin_panel_settings_rounded, color: Color(0xFF475569), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Akses Manajemen (${_session.role.label}): Mencakup seluruh data (${_allSantriList.length} santri) & kontrol gerbang.',
              style: const TextStyle(color: Color(0xFF1E293B), fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF059669)),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
            letterSpacing: -0.2,
          ),
        ),
      ],
    );
  }

  // Kartu Santri Digital untuk Santri & Wali
  Widget _buildHolographicCard(SantriModel santri) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          colors: [
            Color(0xFF065F46),
            Color(0xFF059669),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF059669).withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: Chip RFID & Active Status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.nfc_rounded, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'KARTU SANTRI DIGITAL',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.0,
                        ),
                      ),
                      Text(
                        'Pondok Pesantren Smart Ri\'ayah',
                        style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 9.5),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(Icons.circle, size: 7, color: _santriPermitColor),
                    const SizedBox(width: 5),
                    Text(
                      _santriPermitLabel.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Santri Name & Info
          Text(
            santri.namaLengkap,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'NIS: ${santri.nis}  •  ${santri.kelas}  •  ${santri.kamar}',
            style: const TextStyle(color: Color(0xFFA7F3D0), fontSize: 11.5),
          ),

          const SizedBox(height: 16),
          Container(height: 1, color: Colors.white.withValues(alpha: 0.15)),
          const SizedBox(height: 14),

          // Metrics: Saldo with hide/show toggle & Poin Disiplin
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text('Saldo Dompet RFID', style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 10.5)),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => setState(() => _showBalance = !_showBalance),
                          child: Icon(
                            _showBalance ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _showBalance ? santri.saldoFormatted : '••••••••',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              Container(width: 1, height: 32, color: Colors.white.withValues(alpha: 0.2)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Poin Ri\'ayah', style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 10.5)),
                    const SizedBox(height: 4),
                    Text(
                      santri.poinLabel,
                      style: const TextStyle(
                        color: Color(0xFFFEF08A),
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Ringkasan Kehadiran Santri Asrama for Admin, Mudir, Musyrif, Security
  Widget _buildCommandCenterHero() {
    final diAsramaCount = _allSantriList.where((s) => s.isPresent).length;
    final totalCount = _allSantriList.isEmpty ? 5 : _allSantriList.length;
    final pct = (diAsramaCount / totalCount).clamp(0.0, 1.0);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Live IoT Gate 01 & Hardware
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.security_rounded, color: Color(0xFF059669), size: 18),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'STATUS KEHADIRAN ASRAMA',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text('Smart Gate 01 • Roster Real-time', style: TextStyle(color: Color(0xFF64748B), fontSize: 10)),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Text('GATE AKTIF', style: TextStyle(color: Color(0xFF059669), fontSize: 9.5, fontWeight: FontWeight.w800)),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Headcount Progress Bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Di Asrama: $diAsramaCount dari $totalCount Santri (${(pct * 100).toInt()}%)',
                style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13, fontWeight: FontWeight.w700),
              ),
              Text(
                '$_izin Izin',
                style: const TextStyle(color: Color(0xFFD97706), fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF059669)),
            ),
          ),

          const SizedBox(height: 16),

          // Interactive Quick Simulator Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                if (_allSantriList.isNotEmpty) {
                  _simulateGateTap(_allSantriList.first);
                }
              },
              icon: const Icon(Icons.flash_on_rounded, size: 16),
              label: const Text('⚡ Uji Simulasi Tap Kartu RFID'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashboardQuickActions() {
    return QuickActionGrid(actions: [
      QuickAction(
        label: 'Ajukan\nIzin',
        icon: Icons.assignment_turned_in_rounded,
        color: const Color(0xFF059669),
        onTap: () => _goToIzin(),
      ),
      QuickAction(
        label: 'Pusat Chat\nWali',
        icon: Icons.forum_rounded,
        color: const Color(0xFF0284C7),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ChatAdminRiayahScreen(
                namaPengirim: _session.namaLengkap,
                namaSantri: 'Nurmiyaty',
              ),
            ),
          );
        },
      ),
      QuickAction(
        label: 'AI Agent\nEvaluasi',
        icon: Icons.auto_awesome_rounded,
        color: const Color(0xFF4F46E5),
        onTap: () => AiAgentModal.show(context, namaSantri: 'Nurmiyaty', roleUser: _session.role.label),
      ),
      QuickAction(
        label: 'Database\nIzin',
        icon: Icons.history_edu_rounded,
        color: const Color(0xFF7C3AED),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => RiwayatIzinScreen(
                filterSantriName: _isScopedRole ? 'Nurmiyaty' : null,
              ),
            ),
          );
        },
      ),
    ]);
  }

  Widget _buildStatsGrid() {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      childAspectRatio: 1.12,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        StatCard(
          label: _isScopedRole ? 'Santri Terdaftar' : 'Total Santri',
          value: _totalSantri.toString(),
          icon: Icons.people_rounded,
          color: const Color(0xFF059669),
          subtitle: _isScopedRole ? 'Nurmiyaty (11 IPA)' : 'Pondok Pesantren',
        ),
        StatCard(
          label: 'Status Asrama',
          value: _isScopedRole ? 'Di Asrama' : '$_diAsrama Santri',
          icon: Icons.night_shelter_rounded,
          color: const Color(0xFF0284C7),
          subtitle: _isScopedRole ? 'Kamar Khadijah' : 'Hadir Lengkap',
        ),
        StatCard(
          label: 'Izin / Di Luar',
          value: _isScopedRole ? '0 Aktif' : '$_izin Santri',
          icon: Icons.exit_to_app_rounded,
          color: const Color(0xFFD97706),
          subtitle: _isScopedRole ? 'Tidak ada izin luar' : 'Rayhan (S-103)',
        ),
        StatCard(
          label: 'Rata-rata Poin',
          value: _avgPoin.toStringAsFixed(1),
          icon: Icons.verified_rounded,
          color: const Color(0xFF7C3AED),
          subtitle: 'Kategori Prima',
        ),
      ],
    );
  }

  Widget _buildRealTimeActivityFeed() {
    final activities = _isScopedRole
        ? [
            {
              'time': '17:30',
              'title': 'Gate 01 Tap Masuk Asrama',
              'desc': 'Nurmiyaty (RF-103) verifikasi RFID pintu masuk asrama.',
              'status': 'Terbuka',
              'icon': Icons.sensor_door_rounded,
              'color': const Color(0xFF059669),
            },
            {
              'time': '16:00',
              'title': 'Setoran Tahfidz Qur\'an',
              'desc': 'Nurmiyaty setoran Surat An-Naba\' (Predikat: Mumtaz).',
              'status': 'Mumtaz',
              'icon': Icons.menu_book_rounded,
              'color': const Color(0xFF4F46E5),
            },
            {
              'time': '12:15',
              'title': 'Sholat Dzuhur Berjamaah',
              'desc': 'Presensi Asrama Khadijah hadir tepat waktu.',
              'status': 'Hadir',
              'icon': Icons.mosque_rounded,
              'color': const Color(0xFF059669),
            },
          ]
        : [
            {
              'time': '17:30',
              'title': 'Gate 01 Tap RFID Gerbang',
              'desc': 'Nurmiyaty tap kartu RF-103 masuk Asrama Khadijah.',
              'status': 'Masuk',
              'icon': Icons.sensor_door_rounded,
              'color': const Color(0xFF059669),
            },
            {
              'time': '16:45',
              'title': 'Izin Keluar Disetujui',
              'desc': 'Rayhan Dwi Prasetyo (S-103) izin berobat ke RS ditemani wali.',
              'status': 'Di Luar',
              'icon': Icons.exit_to_app_rounded,
              'color': const Color(0xFFD97706),
            },
            {
              'time': '16:00',
              'title': 'Setoran Tahfidz Qur\'an',
              'desc': 'Muhammad Fatih Robbani setoran Juz 30 (Mumtaz).',
              'status': 'Mumtaz',
              'icon': Icons.menu_book_rounded,
              'color': const Color(0xFF4F46E5),
            },
            {
              'time': '12:15',
              'title': 'Presensi Sholat Dzuhur',
              'desc': 'Semua asrama (Khadijah, Umar, Ali, Aisyah) 100% hadir.',
              'status': 'Lengkap',
              'icon': Icons.mosque_rounded,
              'color': const Color(0xFF059669),
            },
          ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
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
              const Row(
                children: [
                  Icon(Icons.bolt_rounded, color: Color(0xFF059669), size: 18),
                  SizedBox(width: 6),
                  Text(
                    'Aktivitas Terkini Santri',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.circle, size: 6, color: Color(0xFF059669)),
                    SizedBox(width: 4),
                    Text(
                      'REAL-TIME',
                      style: TextStyle(
                        color: Color(0xFF059669),
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...activities.map((act) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: (act['color'] as Color).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(act['icon'] as IconData, size: 16, color: act['color'] as Color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            act['title'] as String,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
                          ),
                          Text(
                            act['time'] as String,
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        act['desc'] as String,
                        style: const TextStyle(color: Color(0xFF64748B), fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )),
        ],
      ),
    );
  }

  // ─── TAB 1: SANTRI DIRECTORY (ALL SANTRI ROSTER) ────────────────────────────
  Widget _buildSantriDirectoryTab() {
    final list = _filteredSantriList;
    final categories = _isScopedRole
        ? ['Semua', 'Di Asrama']
        : ['Semua', 'Di Asrama', 'Izin / Luar', 'Ikhwan', 'Akhwat', 'Khadijah', 'Umar', 'Ali'];

    return Column(
      children: [
        // Search & Filter Box
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Column(
            children: [
              // Search Text Field
              Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        onChanged: (val) => setState(() => _searchQuery = val),
                        style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13),
                        decoration: InputDecoration(
                          hintText: _isScopedRole ? 'Cari profil Anda...' : 'Cari nama, NIS, atau kamar santri...',
                          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                          border: InputBorder.none,
                          isDense: true,
                        ),
                      ),
                    ),
                    if (_searchQuery.isNotEmpty)
                      GestureDetector(
                        onTap: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                        child: const Icon(Icons.close_rounded, color: Color(0xFF64748B), size: 16),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 10),

              // Filter Chips
              SizedBox(
                height: 32,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: categories.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (ctx, i) {
                    final cat = categories[i];
                    final active = _selectedCategory == cat;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedCategory = cat),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: active ? const Color(0xFF059669) : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: active ? const Color(0xFF059669) : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Text(
                          cat,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                            color: active ? Colors.white : const Color(0xFF475569),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),

        // Santri List View
        Expanded(
          child: list.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  itemCount: list.length,
                  itemBuilder: (ctx, i) => SantriCard(
                    santri: list[i],
                    onTap: () => _showSantriDetail(list[i]),
                  ),
                ),
        ),
      ],
    );
  }

  // ─── TAB 3: IZIN & CHAT ─────────────────────────────────────────────────────
  Widget _buildIzinAndChatTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Card 1: Kirim Izin Langsung
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF065F46), Color(0xFF059669)],
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF059669).withValues(alpha: 0.2),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Kirim Izin Langsung',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Ajukan surat izin pesiar, pulang bermalam, atau berobat secara instan ke Musyrif asrama dengan verifikasi digital.',
                style: TextStyle(color: Color(0xFFD1FAE5), fontSize: 12),
              ),
              const SizedBox(height: 14),
              ElevatedButton.icon(
                onPressed: _goToIzin,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Isi Form Izin Sekarang'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF065F46),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Card 2: Chatting ke Admin Ri'ayah
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F766E), Color(0xFF0D9488)],
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0D9488).withValues(alpha: 0.2),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.forum_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Pusat Chat Admin Ri\'ayah',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Konsultasi langsung antara Wali Santri dan Pengurus Asrama terkait kepulangan, saldo RFID, atau mutaba\'ah santri.',
                style: TextStyle(color: Color(0xFFCCFBF1), fontSize: 12),
              ),
              const SizedBox(height: 14),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ChatAdminRiayahScreen(
                        namaPengirim: _session.namaLengkap,
                        namaSantri: 'Nurmiyaty',
                      ),
                    ),
                  );
                },
                icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                label: const Text('Buka Pusat Chat WhatsApp'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF0F766E),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Card 3: Database Riwayat Surat Izin
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
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
                  const Text(
                    'Database Surat Izin Santri',
                    style: TextStyle(color: Color(0xFF0F172A), fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => RiwayatIzinScreen(
                            filterSantriName: _isScopedRole ? 'Nurmiyaty' : null,
                          ),
                        ),
                      );
                    },
                    child: const Text('Buka Semua →', style: TextStyle(color: Color(0xFF059669), fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
              const Text(
                'Pantau status verifikasi Musyrif, tanggal kepulangan, serta QR Code gerbang aktif.',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 11.5),
              ),
            ],
          ),
        ),
      ],
    );
  }



  Widget _buildInfoCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    String? statusBadge,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A))),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
          ),
          if (statusBadge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: color.withValues(alpha: 0.25)),
              ),
              child: Text(statusBadge, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
            ),
        ],
      ),
    );
  }

  IconData get _tab2Icon {
    switch (_session.role) {
      case UserRole.santri: return Icons.menu_book_rounded;
      case UserRole.wali: return Icons.fact_check_rounded;
      case UserRole.musyrif: return Icons.checklist_rounded;
      case UserRole.security: return Icons.sensor_door_rounded;
      case UserRole.adminRiayah: return Icons.assignment_rounded;
      case UserRole.mudir:
      case UserRole.superAdmin: return Icons.analytics_rounded;
    }
  }

  String get _tab2Label {
    switch (_session.role) {
      case UserRole.santri: return 'Mutaba\'ah';
      case UserRole.wali: return 'Rapor';
      case UserRole.musyrif: return 'Presensi';
      case UserRole.security: return 'Gate Satpam';
      case UserRole.adminRiayah: return 'Perizinan';
      case UserRole.mudir:
      case UserRole.superAdmin: return 'Analitik';
    }
  }

  // ─── Floating Frosted Bottom Navigation Dock (Clean Light Style) ────────────
  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x0D000000),
            blurRadius: 10,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(0, Icons.dashboard_rounded, 'Beranda'),
              _buildNavItem(1, Icons.groups_rounded, _isScopedRole ? 'Data Nur' : 'Santri'),
              _buildNavItem(2, _tab2Icon, _tab2Label),
              _buildNavItem(3, Icons.forum_rounded, 'Izin & Chat'),
              _buildNavItem(4, Icons.account_circle_rounded, 'Profil'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final active = _selectedTab == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFECFDF5) : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          border: active
              ? Border.all(color: const Color(0xFFA7F3D0))
              : Border.all(color: Colors.transparent),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: active ? const Color(0xFF059669) : const Color(0xFF64748B),
              size: 21,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                color: active ? const Color(0xFF059669) : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFloatingActions() {
    if (_selectedTab == 1) {
      return FloatingActionButton.extended(
        onPressed: _goToIzin,
        backgroundColor: const Color(0xFF059669),
        elevation: 4,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Ajukan Izin', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
      );
    }
    return FloatingActionButton.extended(
      onPressed: () => AiAgentModal.show(
        context,
        namaSantri: 'Nurmiyaty',
        roleUser: _session.role.label,
      ),
      backgroundColor: const Color(0xFF059669),
      elevation: 4,
      icon: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 20),
      label: const Text('Bantuan AI', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(color: Color(0xFF059669), strokeWidth: 3),
          ),
          SizedBox(height: 16),
          Text('Memuat ekosistem Smart Riayah...', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.person_search_rounded, size: 54, color: Color(0xFFCBD5E1)),
          SizedBox(height: 12),
          Text('Tidak ada santri yang sesuai', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 14)),
          SizedBox(height: 4),
          Text('Coba ubah kata kunci atau filter kategori', style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
        ],
      ),
    );
  }
}

// ─── Modal Santri Detail Dossier ──────────────────────────────────────────────
class _SantriDetailSheet extends StatelessWidget {
  final SantriModel santri;
  final VoidCallback onSubmitIzin;
  final VoidCallback onSimulateTap;

  const _SantriDetailSheet({
    required this.santri,
    required this.onSubmitIzin,
    required this.onSimulateTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Container(
            margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF065F46), Color(0xFF059669)],
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: Text(
                      santri.initials,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        santri.namaLengkap,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'NIS: ${santri.nis}  •  ${santri.kelas}',
                        style: const TextStyle(color: Color(0xFFD1FAE5), fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Body Dossier Rows
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildRow(Icons.night_shelter_rounded, 'Kamar Asrama', santri.kamar),
                const SizedBox(height: 10),
                _buildRow(Icons.pin_drop_rounded, 'Status Keberadaan', santri.statusLabel),
                const SizedBox(height: 10),
                _buildRow(Icons.military_tech_rounded, 'Poin Ri\'ayah', santri.poinLabel),
                const SizedBox(height: 10),
                _buildRow(Icons.account_balance_wallet_rounded, 'Saldo RFID', santri.saldoFormatted),
                if (santri.rfidUid != null) ...[
                  const SizedBox(height: 10),
                  _buildRow(Icons.nfc_rounded, 'RFID UID Hardware', santri.rfidUid!),
                ],
                if (santri.namaWali != null) ...[
                  const SizedBox(height: 10),
                  _buildRow(Icons.family_restroom_rounded, 'Wali Santri', santri.namaWali!),
                ],
                const SizedBox(height: 22),

                // Action Buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onSimulateTap,
                        icon: const Icon(Icons.flash_on_rounded, size: 16),
                        label: const Text('Simulasi Tap'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF059669),
                          side: const BorderSide(color: Color(0xFF059669)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: onSubmitIzin,
                        icon: const Icon(Icons.assignment_turned_in_rounded, size: 16),
                        label: const Text('Ajukan Izin'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF059669),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: MediaQuery.of(context).padding.bottom + 6),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF059669)),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
        const Spacer(),
        Text(value, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 13)),
      ],
    );
  }
}
