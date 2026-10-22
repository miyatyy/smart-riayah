import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/app_theme.dart';
import 'api_service.dart';
import 'models/santri_model.dart';
import 'widgets/rfid_hero_card.dart';
import 'widgets/stat_card.dart';
import 'widgets/santri_card.dart';
import 'widgets/quick_action_grid.dart';
import 'widgets/app_sidebar_drawer.dart';
import 'screens/submit_izin_screen.dart';
import 'screens/login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: AppColors.emerald900,
    statusBarIconBrightness: Brightness.light,
  ));
  // Daftarkan builder agar login_screen.dart bisa navigate ke HomeScreenWithSession
  registerHomeScreenBuilder((session) => HomeScreenWithSession(session: session));
  runApp(const SmartRiayahApp());
}

class SmartRiayahApp extends StatelessWidget {
  const SmartRiayahApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart Riayah',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const LoginScreen(),
    );
  }
}

// ─── Main Home Screen ────────────────────────────────────────────────────────

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  bool _isServerOnline = false;
  List<SantriModel> _santriList = [];
  String _errorMessage = '';
  int _selectedTab = 0;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _loadData();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    _animCtrl.reset();

    final online = await SmartRiayahApiService.checkHealth();
    setState(() => _isServerOnline = online);

    try {
      final raw = await SmartRiayahApiService.getSantriList();
      setState(() {
        _santriList = raw.map((j) => SantriModel.fromJson(j)).toList();
        _isLoading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
      _animCtrl.forward();
    }
  }

  // ─── Stat helpers ──────────────────────────────────────────────────────────
  int get _totalSantri => _santriList.length;
  int get _diAsrama => _santriList.where((s) => s.isPresent).length;
  int get _izin => _santriList.where((s) => s.isIzin).length;
  double get _avgPoin => _santriList.isEmpty
      ? 0
      : _santriList.map((s) => s.poinDisiplin).reduce((a, b) => a + b) / _santriList.length;

  SantriModel? get _firstSantri => _santriList.isNotEmpty ? _santriList.first : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          _buildAppBar(),
          Expanded(
            child: _isLoading
                ? _buildLoadingState()
                : RefreshIndicator(
                    onRefresh: _loadData,
                    color: AppColors.emerald600,
                    child: FadeTransition(
                      opacity: _fadeAnim,
                      child: _buildBody(),
                    ),
                  ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(),
      floatingActionButton: _selectedTab == 1 ? _buildFab() : null,
    );
  }

  // ─── App Bar ────────────────────────────────────────────────────────────────
  Widget _buildAppBar() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.emerald950, AppColors.emerald900],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Row(
            children: [
              // Logo
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.emerald600.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.emerald600.withValues(alpha: 0.4)),
                ),
                child: const Icon(Icons.mosque_rounded, color: AppColors.emerald300, size: 22),
              ),
              const SizedBox(width: 12),
              // Title
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Smart Riayah',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                    ),
                    Text(
                      'Pesantren Modern Darul Ulum',
                      style: TextStyle(color: AppColors.emerald300, fontSize: 11),
                    ),
                  ],
                ),
              ),
              // Server status chip
              _buildServerChip(),
              const SizedBox(width: 8),
              // Refresh
              GestureDetector(
                onTap: _loadData,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.refresh_rounded, color: Colors.white, size: 18),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildServerChip() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: _isServerOnline
            ? AppColors.emerald600.withValues(alpha: 0.2)
            : AppColors.danger.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: _isServerOnline
              ? AppColors.emerald400.withValues(alpha: 0.5)
              : AppColors.danger.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isServerOnline ? AppColors.emerald400 : AppColors.danger,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            _isServerOnline ? 'Online' : 'Offline',
            style: TextStyle(
              color: _isServerOnline ? AppColors.emerald300 : AppColors.danger,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Body ───────────────────────────────────────────────────────────────────
  Widget _buildBody() {
    if (_selectedTab == 0) return _buildDashboardTab();
    if (_selectedTab == 1) return _buildSantriTab();
    return _buildInfoTab();
  }

  // ─── Dashboard Tab ──────────────────────────────────────────────────────────
  Widget _buildDashboardTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        // Error banner
        if (_errorMessage.isNotEmpty) _buildErrorBanner(),
        if (_errorMessage.isNotEmpty) const SizedBox(height: 12),

        // RFID Hero Card
        RfidHeroCard(santri: _firstSantri),
        const SizedBox(height: 20),

        // Quick Actions
        const Text(
          'Aksi Cepat',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 10),
        QuickActionGrid(actions: [
          QuickAction(
            label: 'Ajukan\nIzin',
            icon: Icons.assignment_turned_in_rounded,
            color: AppColors.emerald700,
            onTap: () => _goToIzin(),
          ),
          const QuickAction(
            label: 'Scan\nRFID',
            icon: Icons.nfc_rounded,
            color: AppColors.info,
          ),
          const QuickAction(
            label: 'Poin\nDisiplin',
            icon: Icons.military_tech_rounded,
            color: AppColors.gold500,
          ),
          const QuickAction(
            label: 'Riwayat\nIzin',
            icon: Icons.history_rounded,
            color: Color(0xFF8B5CF6),
          ),
        ]),
        const SizedBox(height: 20),

        // Stats
        const Text(
          'Statistik Asrama',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 10),
        _buildStatsGrid(),
        const SizedBox(height: 20),

        // Recent list preview
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Santri Terbaru',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            ),
            GestureDetector(
              onTap: () => setState(() => _selectedTab = 1),
              child: const Text(
                'Lihat semua →',
                style: TextStyle(fontSize: 12, color: AppColors.emerald600, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ..._santriList.take(3).map((s) => SantriCard(santri: s, onTap: () => _showSantriDetail(s))),
      ],
    );
  }

  Widget _buildStatsGrid() {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      childAspectRatio: 1.5,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        StatCard(
          label: 'Total Santri',
          value: _totalSantri.toString(),
          icon: Icons.people_rounded,
          color: AppColors.emerald700,
        ),
        StatCard(
          label: 'Di Asrama',
          value: _diAsrama.toString(),
          icon: Icons.home_rounded,
          color: AppColors.info,
        ),
        StatCard(
          label: 'Izin Keluar',
          value: _izin.toString(),
          icon: Icons.exit_to_app_rounded,
          color: AppColors.warning,
        ),
        StatCard(
          label: 'Rata-rata Poin',
          value: _avgPoin.toStringAsFixed(1),
          icon: Icons.bar_chart_rounded,
          color: const Color(0xFF8B5CF6),
        ),
      ],
    );
  }

  // ─── Santri Tab ─────────────────────────────────────────────────────────────
  Widget _buildSantriTab() {
    return Column(
      children: [
        // Filter bar
        _buildFilterBar(),
        // List
        Expanded(
          child: _santriList.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                  itemCount: _santriList.length,
                  itemBuilder: (ctx, i) => SantriCard(
                    santri: _santriList[i],
                    onTap: () => _showSantriDetail(_santriList[i]),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildFilterBar() {
    return Container(
      color: AppColors.cardBg,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: const Row(
                children: [
                  Icon(Icons.search_rounded, color: AppColors.textMuted, size: 18),
                  SizedBox(width: 8),
                  Text('Cari santri...', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
              color: AppColors.emerald50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.emerald200),
            ),
            child: const Icon(Icons.filter_list_rounded, color: AppColors.emerald700, size: 18),
          ),
        ],
      ),
    );
  }

  // ─── Info Tab ───────────────────────────────────────────────────────────────
  Widget _buildInfoTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoCard(
          title: 'Smart Riayah Mobile',
          subtitle: 'Versi 1.0.0',
          icon: Icons.info_outline_rounded,
          color: AppColors.emerald700,
        ),
        const SizedBox(height: 12),
        _buildInfoCard(
          title: 'Pesantren Modern Darul Ulum',
          subtitle: 'Sistem Manajemen Asrama Digital',
          icon: Icons.mosque_rounded,
          color: AppColors.gold500,
        ),
        const SizedBox(height: 12),
        _buildInfoCard(
          title: 'Server Backend',
          subtitle: SmartRiayahApiService.baseUrl,
          icon: Icons.dns_rounded,
          color: _isServerOnline ? AppColors.emerald600 : AppColors.danger,
          statusBadge: _isServerOnline ? 'Online' : 'Offline',
        ),
        const SizedBox(height: 24),
        _buildApiConnectCard(),
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
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary)),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          if (statusBadge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                statusBadge,
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildApiConnectCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.emerald900, AppColors.emerald800],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Koneksi API', style: TextStyle(color: AppColors.emerald200, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
          const SizedBox(height: 6),
          const Text('Pastikan backend aktif', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          const Text(
            'npm run server',
            style: TextStyle(
              color: AppColors.emerald300,
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.wifi_tethering_rounded, size: 16),
              label: const Text('Tes Koneksi Ulang'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.emerald600,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── States ─────────────────────────────────────────────────────────────────
  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 40,
            height: 40,
            child: CircularProgressIndicator(
              color: AppColors.emerald600,
              strokeWidth: 3,
            ),
          ),
          SizedBox(height: 16),
          Text('Memuat data...', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline_rounded, size: 64, color: AppColors.textMuted.withValues(alpha: 0.5)),
          const SizedBox(height: 12),
          const Text('Tidak ada data santri', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
          const Text('Periksa koneksi backend', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Backend tidak terhubung. Jalankan: npm run server',
              style: TextStyle(color: Colors.amber.shade900, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Bottom Nav ─────────────────────────────────────────────────────────────
  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        border: Border(top: BorderSide(color: AppColors.borderColor)),
        boxShadow: [
          BoxShadow(color: Color(0x0A000000), blurRadius: 10, offset: Offset(0, -2)),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(0, Icons.dashboard_rounded, 'Dashboard'),
              _buildNavItem(1, Icons.people_rounded, 'Santri'),
              _buildNavItem(2, Icons.info_rounded, 'Info'),
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
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        decoration: BoxDecoration(
          color: active ? AppColors.emerald50 : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: active ? AppColors.emerald700 : AppColors.textMuted, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? AppColors.emerald700 : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── FAB ────────────────────────────────────────────────────────────────────
  Widget _buildFab() {
    return FloatingActionButton.extended(
      onPressed: _goToIzin,
      backgroundColor: AppColors.emerald700,
      elevation: 4,
      icon: const Icon(Icons.add_rounded, color: Colors.white),
      label: const Text('Ajukan Izin', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
    );
  }

  // ─── Actions ────────────────────────────────────────────────────────────────
  void _goToIzin() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => SubmitIzinScreen(santriList: _santriList)),
    );
    if (result == true) _loadData();
  }

  void _showSantriDetail(SantriModel s) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SantriDetailSheet(santri: s, onSubmitIzin: () {
        Navigator.pop(context);
        _goToIzin();
      }),
    );
  }
}

// ─── Santri Detail Bottom Sheet ──────────────────────────────────────────────

class _SantriDetailSheet extends StatelessWidget {
  final SantriModel santri;
  final VoidCallback onSubmitIzin;

  const _SantriDetailSheet({required this.santri, required this.onSubmitIzin});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.borderColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Container(
            margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.emerald900, AppColors.emerald800],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.emerald600.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(
                      santri.initials,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        santri.namaLengkap,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                      Text(
                        '${santri.nis} • ${santri.kelas}',
                        style: const TextStyle(color: AppColors.emerald200, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Details
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildDetailRow(Icons.home_rounded, 'Kamar', santri.kamar),
                const SizedBox(height: 10),
                _buildDetailRow(Icons.person_pin_circle_rounded, 'Status', santri.statusLabel),
                const SizedBox(height: 10),
                _buildDetailRow(Icons.military_tech_rounded, 'Poin Ri\'ayah', santri.poinLabel),
                if (santri.saldoRfid != null) ...[
                  const SizedBox(height: 10),
                  _buildDetailRow(Icons.account_balance_wallet_rounded, 'Saldo RFID', santri.saldoFormatted),
                ],
                if (santri.namaWali != null) ...[
                  const SizedBox(height: 10),
                  _buildDetailRow(Icons.family_restroom_rounded, 'Wali', santri.namaWali!),
                ],
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close_rounded, size: 16),
                        label: const Text('Tutup'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textSecondary,
                          side: const BorderSide(color: AppColors.borderColor),
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
                          backgroundColor: AppColors.emerald700,
                          foregroundColor: Colors.white,
                          elevation: 0,
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
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.emerald600),
        const SizedBox(width: 10),
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        const Spacer(),
        Text(value, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
      ],
    );
  }
}


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
  List<SantriModel> _santriList = [];
  String _errorMessage = '';
  int _selectedTab = 0;
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late AppSession _session;
  String _activeMenuId = 'active_permits';

  @override
  void initState() {
    super.initState();
    _session = widget.session;
    _animCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _fadeAnim =
        CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _loadData();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  void _handleSwitchRole(UserRole newRole) {
    setState(() {
      _session = AppSession(
        namaLengkap: _session.namaLengkap,
        role: newRole,
        token: _session.token,
      );
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Beralih ke mode simulasi: ${newRole.label}'),
        backgroundColor: newRole.accentColor,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _handleMenuSelection(String menuId) {
    setState(() => _activeMenuId = menuId);
    switch (menuId) {
      case 'approval':
      case 'permit':
      case 'my_permit':
        _goToIzin();
        break;
      case 'ai_santri':
      case 'ai_analytics':
      case 'aktivitas':
      case 'ai_tanya':
        _showAiAgentSheet();
        break;
      case 'diagnostics':
      case 'rfid_pairing':
      case 'gate_logs':
        _showIotGateSheet();
        break;
      case 'points':
      case 'my_points':
        _showPointsSheet();
        break;
      case 'kamar':
        _showKamarInspectionSheet();
        break;
      default:
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Membuka modul: $menuId'),
            backgroundColor: AppColors.emerald700,
            duration: const Duration(milliseconds: 1500),
          ),
        );
        break;
    }
  }

  void _showAiAgentSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
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
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF06B6D4)],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Smart Riayah AI Agent',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        'Evaluasi Adab & Disiplin Santri Holistik',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ListView(
                children: [
                  _buildAiInsightCard(
                    title: 'Rata-rata Poin Disiplin Santri',
                    value: '${_avgPoin.toStringAsFixed(1)} / 100 Poin',
                    insight: 'Sebagian besar santri berada pada kategori Disiplin Tinggi (Ri\'ayah Prima).',
                    color: const Color(0xFF10B981),
                  ),
                  const SizedBox(height: 12),
                  _buildAiInsightCard(
                    title: 'Analisis Izin & Pulang',
                    value: '$_izin Santri Aktif Izin',
                    insight: 'Prediksi kepulangan tepat waktu 96.4%. Tidak ada anomali keterlambatan jam malam.',
                    color: const Color(0xFF38BDF8),
                  ),
                  const SizedBox(height: 12),
                  _buildAiInsightCard(
                    title: 'Rekomendasi AI untuk ${_session.role.label}',
                    value: 'Prioritas: Evaluasi Kamar A3 & B2',
                    insight: 'Pantau riwayat adab santri yang mendekati batas toleransi poin izin.',
                    color: const Color(0xFFA855F7),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAiInsightCard({
    required String title,
    required String value,
    required String insight,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 12)),
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            insight,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
          ),
        ],
      ),
    );
  }

  void _showIotGateSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
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
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              '📡 Diagnostik Hardware Gate IoT',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            _buildIotDetailRow('Mikrokontroler', 'NodeMCU ESP32 (38-pin)'),
            _buildIotDetailRow('Sensor RFID', 'RC522 13.56 MHz (SPI Protocol)'),
            _buildIotDetailRow('Servo Gate Barrier', 'MG996R Metal Gear (Pin D18)'),
            _buildIotDetailRow('Status Koneksi', _isServerOnline ? 'Terhubung (Online)' : 'Standby Offline'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => Navigator.pop(ctx),
                icon: const Icon(Icons.check_rounded),
                label: const Text('Tutup Diagnostik'),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIotDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  void _showPointsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🏆 Buku Poin & Adab Santri',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Sistem penilaian kedisiplinan dan kepatuhan jam malam asrama.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
            const SizedBox(height: 14),
            Text('Total Santri Teregistrasi: $_totalSantri Santri',
                style: const TextStyle(color: Color(0xFF34D399), fontWeight: FontWeight.w700)),
            Text('Rata-rata Disiplin Asrama: ${_avgPoin.toStringAsFixed(1)} Pts',
                style: const TextStyle(color: Color(0xFF38BDF8), fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _showKamarInspectionSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🏠 Inspeksi Kamar Asrama',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Pantau kebersihan dan kerapian kamar asrama santri.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
            const SizedBox(height: 14),
            const Text('• Gedung Al-Fatih: Kamar 101 - 108 (Lengkap)', style: TextStyle(color: Colors.white)),
            const Text('• Gedung Ibnu Sina: Kamar 201 - 206 (Lengkap)', style: TextStyle(color: Colors.white)),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    _animCtrl.reset();

    final online = await SmartRiayahApiService.checkHealth();
    setState(() => _isServerOnline = online);

    try {
      final raw = await SmartRiayahApiService.getSantriList();
      setState(() {
        _santriList = raw.map((j) => SantriModel.fromJson(j)).toList();
        _isLoading = false;
      });
      _animCtrl.forward();
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
      _animCtrl.forward();
    }
  }

  int get _totalSantri => _santriList.length;
  int get _diAsrama => _santriList.where((s) => s.isPresent).length;
  int get _izin => _santriList.where((s) => s.isIzin).length;
  double get _avgPoin => _santriList.isEmpty
      ? 0
      : _santriList.map((s) => s.poinDisiplin).reduce((a, b) => a + b) /
          _santriList.length;
  SantriModel? get _firstSantri =>
      _santriList.isNotEmpty ? _santriList.first : null;

  void _doLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Keluar', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text(
          'Yakin ingin keluar dari akun ${_session.namaLengkap}?',
          style: const TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
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
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
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
                    color: AppColors.emerald600,
                    child: FadeTransition(
                      opacity: _fadeAnim,
                      child: _buildBody(),
                    ),
                  ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(),
      floatingActionButton: _selectedTab == 1 ? _buildFab() : null,
    );
  }

  Widget _buildSessionAppBar() {
    final role = _session.role;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.emerald950,
            role.gradient[0],
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Row(
            children: [
              // ☰ Hamburger Button untuk buka Sidebar / Drawer (Sama Seperti di Web)
              Builder(
                builder: (ctx) => InkWell(
                  onTap: () => Scaffold.of(ctx).openDrawer(),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: const Icon(Icons.menu_rounded,
                        color: Colors.white, size: 22),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // User Info (Tap untuk buka drawer juga)
              Expanded(
                child: Builder(
                  builder: (ctx) => InkWell(
                    onTap: () => Scaffold.of(ctx).openDrawer(),
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
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: role.accentColor.withValues(alpha: 0.25),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                role.label,
                                style: TextStyle(
                                  color: role.accentColor,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text(
                              'Smart Riayah ▾',
                              style: TextStyle(
                                  color: AppColors.emerald300, fontSize: 10),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              // Server status
              _buildServerChip(),
              const SizedBox(width: 6),
              // Refresh
              GestureDetector(
                onTap: _loadData,
                child: Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Icon(Icons.refresh_rounded,
                      color: Colors.white, size: 17),
                ),
              ),
              const SizedBox(width: 6),
              // Logout
              GestureDetector(
                onTap: _doLogout,
                child: Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.25)),
                  ),
                  child: const Icon(Icons.logout_rounded,
                      color: AppColors.danger, size: 17),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildServerChip() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _isServerOnline
            ? AppColors.emerald600.withValues(alpha: 0.2)
            : AppColors.danger.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: _isServerOnline
              ? AppColors.emerald400.withValues(alpha: 0.5)
              : AppColors.danger.withValues(alpha: 0.5),
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
              color:
                  _isServerOnline ? AppColors.emerald400 : AppColors.danger,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            _isServerOnline ? 'Online' : 'Offline',
            style: TextStyle(
              color:
                  _isServerOnline ? AppColors.emerald300 : AppColors.danger,
              fontSize: 9,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_selectedTab == 0) return _buildDashboardTab();
    if (_selectedTab == 1) return _buildSantriTab();
    return _buildInfoTab();
  }

  Widget _buildDashboardTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      children: [
        if (_errorMessage.isNotEmpty) _buildErrorBanner(),
        if (_errorMessage.isNotEmpty) const SizedBox(height: 12),
        RfidHeroCard(santri: _firstSantri),
        const SizedBox(height: 20),
        const Text('Aksi Cepat',
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary)),
        const SizedBox(height: 10),
        QuickActionGrid(actions: [
          QuickAction(
            label: 'Ajukan\nIzin',
            icon: Icons.assignment_turned_in_rounded,
            color: AppColors.emerald700,
            onTap: () => _goToIzin(),
          ),
          const QuickAction(
              label: 'Scan\nRFID',
              icon: Icons.nfc_rounded,
              color: AppColors.info),
          const QuickAction(
              label: 'Poin\nDisiplin',
              icon: Icons.military_tech_rounded,
              color: AppColors.gold500),
          const QuickAction(
              label: 'Riwayat\nIzin',
              icon: Icons.history_rounded,
              color: Color(0xFF8B5CF6)),
        ]),
        const SizedBox(height: 20),
        const Text('Statistik Asrama',
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary)),
        const SizedBox(height: 10),
        _buildStatsGrid(),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Santri Terbaru',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary)),
            GestureDetector(
              onTap: () => setState(() => _selectedTab = 1),
              child: const Text('Lihat semua →',
                  style: TextStyle(
                      fontSize: 12,
                      color: AppColors.emerald600,
                      fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ..._santriList
            .take(3)
            .map((s) => SantriCard(santri: s, onTap: () => _showSantriDetail(s))),
      ],
    );
  }

  Widget _buildStatsGrid() {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      childAspectRatio: 1.35,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        StatCard(
            label: 'Total Santri',
            value: _totalSantri.toString(),
            icon: Icons.people_rounded,
            color: AppColors.emerald700),
        StatCard(
            label: 'Di Asrama',
            value: _diAsrama.toString(),
            icon: Icons.home_rounded,
            color: AppColors.info),
        StatCard(
            label: 'Izin Keluar',
            value: _izin.toString(),
            icon: Icons.exit_to_app_rounded,
            color: AppColors.warning),
        StatCard(
            label: 'Rata-rata Poin',
            value: _avgPoin.toStringAsFixed(1),
            icon: Icons.bar_chart_rounded,
            color: const Color(0xFF8B5CF6)),
      ],
    );
  }

  Widget _buildSantriTab() {
    return Column(children: [
      _buildFilterBar(),
      Expanded(
        child: _santriList.isEmpty
            ? _buildEmptyState()
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                itemCount: _santriList.length,
                itemBuilder: (ctx, i) => SantriCard(
                  santri: _santriList[i],
                  onTap: () => _showSantriDetail(_santriList[i]),
                ),
              ),
      ),
    ]);
  }

  Widget _buildFilterBar() {
    return Container(
      color: AppColors.cardBg,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(children: [
        Expanded(
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.borderColor),
            ),
            child: const Row(children: [
              Icon(Icons.search_rounded, color: AppColors.textMuted, size: 18),
              SizedBox(width: 8),
              Text('Cari santri...',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
            ]),
          ),
        ),
        const SizedBox(width: 10),
        Container(
          height: 40,
          width: 40,
          decoration: BoxDecoration(
            color: AppColors.emerald50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.emerald200),
          ),
          child: const Icon(Icons.filter_list_rounded,
              color: AppColors.emerald700, size: 18),
        ),
      ]),
    );
  }

  Widget _buildInfoTab() {
    return ListView(padding: const EdgeInsets.all(16), children: [
      _buildInfoCard(
          title: 'Smart Riayah Mobile',
          subtitle: 'Versi 1.0.0',
          icon: Icons.info_outline_rounded,
          color: AppColors.emerald700),
      const SizedBox(height: 12),
      _buildInfoCard(
          title: widget.session.namaLengkap,
          subtitle: widget.session.role.label,
          icon: widget.session.role.icon,
          color: widget.session.role.accentColor),
      const SizedBox(height: 12),
      _buildInfoCard(
          title: 'Server Backend',
          subtitle: SmartRiayahApiService.baseUrl,
          icon: Icons.dns_rounded,
          color: _isServerOnline ? AppColors.emerald600 : AppColors.danger,
          statusBadge: _isServerOnline ? 'Online' : 'Offline'),
      const SizedBox(height: 24),
      _buildApiConnectCard(),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: _doLogout,
          icon: const Icon(Icons.logout_rounded, size: 18),
          label: const Text('Keluar dari Akun'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.danger,
            side: const BorderSide(color: AppColors.danger),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ),
    ]);
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
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.textPrimary)),
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ),
        if (statusBadge != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(statusBadge,
                style: TextStyle(
                    fontSize: 10, fontWeight: FontWeight.w700, color: color)),
          ),
      ]),
    );
  }

  Widget _buildApiConnectCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            colors: [AppColors.emerald900, AppColors.emerald800]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Koneksi API',
            style: TextStyle(
                color: AppColors.emerald200,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5)),
        const SizedBox(height: 6),
        const Text('Status Koneksi Backend',
            style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Text(
          SmartRiayahApiService.baseUrl,
          style: const TextStyle(
            color: AppColors.emerald300,
            fontSize: 12,
            fontFamily: 'monospace',
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _loadData,
            icon: const Icon(Icons.wifi_tethering_rounded, size: 16),
            label: const Text('Tes Koneksi Ulang'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.emerald600,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        SizedBox(
          width: 40,
          height: 40,
          child: CircularProgressIndicator(
              color: AppColors.emerald600, strokeWidth: 3),
        ),
        SizedBox(height: 16),
        Text('Memuat data...',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
      ]),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.people_outline_rounded,
            size: 64,
            color: AppColors.textMuted.withValues(alpha: 0.5)),
        const SizedBox(height: 12),
        const Text('Tidak ada data santri',
            style: TextStyle(
                color: AppColors.textSecondary, fontWeight: FontWeight.w600)),
        const Text('Periksa koneksi backend',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
      ]),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(children: [
        const Icon(Icons.warning_amber_rounded,
            color: AppColors.warning, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Server offline. Mode demo aktif.',
            style: TextStyle(color: Colors.amber.shade900, fontSize: 11),
          ),
        ),
      ]),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        border: Border(top: BorderSide(color: AppColors.borderColor)),
        boxShadow: [
          BoxShadow(
              color: Color(0x0A000000),
              blurRadius: 10,
              offset: Offset(0, -2)),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _buildNavItem(0, Icons.dashboard_rounded, 'Dashboard'),
            _buildNavItem(1, Icons.people_rounded, 'Santri'),
            _buildNavItem(2, Icons.info_rounded, 'Info'),
          ]),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final active = _selectedTab == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        decoration: BoxDecoration(
          color: active ? AppColors.emerald50 : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon,
              color: active ? AppColors.emerald700 : AppColors.textMuted,
              size: 22),
          const SizedBox(height: 3),
          Text(label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? AppColors.emerald700 : AppColors.textMuted,
              )),
        ]),
      ),
    );
  }

  Widget _buildFab() {
    return FloatingActionButton.extended(
      onPressed: _goToIzin,
      backgroundColor: AppColors.emerald700,
      elevation: 4,
      icon: const Icon(Icons.add_rounded, color: Colors.white),
      label: const Text('Ajukan Izin',
          style:
              TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
    );
  }

  void _goToIzin() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
          builder: (_) => SubmitIzinScreen(santriList: _santriList)),
    );
    if (result == true) _loadData();
  }

  void _showSantriDetail(SantriModel s) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SantriDetailSheetSession(
          santri: s,
          onSubmitIzin: () {
            Navigator.pop(context);
            _goToIzin();
          }),
    );
  }
}

class _SantriDetailSheetSession extends StatelessWidget {
  final SantriModel santri;
  final VoidCallback onSubmitIzin;
  const _SantriDetailSheetSession(
      {required this.santri, required this.onSubmitIzin});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          margin: const EdgeInsets.only(top: 12),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: AppColors.borderColor,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Container(
          margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                colors: [AppColors.emerald900, AppColors.emerald800]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: AppColors.emerald600.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Text(santri.initials,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(santri.namaLengkap,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16)),
                Text('${santri.nis} • ${santri.kelas}',
                    style: const TextStyle(
                        color: AppColors.emerald200, fontSize: 12)),
              ]),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            _row(Icons.home_rounded, 'Kamar', santri.kamar),
            const SizedBox(height: 10),
            _row(Icons.person_pin_circle_rounded, 'Status', santri.statusLabel),
            const SizedBox(height: 10),
            _row(Icons.military_tech_rounded, 'Poin Ri\'ayah', santri.poinLabel),
            if (santri.saldoRfid != null) ...[
              const SizedBox(height: 10),
              _row(Icons.account_balance_wallet_rounded, 'Saldo RFID', santri.saldoFormatted),
            ],
            if (santri.namaWali != null) ...[
              const SizedBox(height: 10),
              _row(Icons.family_restroom_rounded, 'Wali', santri.namaWali!),
            ],
            const SizedBox(height: 20),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text('Tutup'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: AppColors.borderColor),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
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
                    backgroundColor: AppColors.emerald700,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ]),
            SizedBox(height: MediaQuery.of(context).padding.bottom),
          ]),
        ),
      ]),
    );
  }

  Widget _row(IconData icon, String label, String value) {
    return Row(children: [
      Icon(icon, size: 16, color: AppColors.emerald600),
      const SizedBox(width: 10),
      Text(label,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
      const Spacer(),
      Text(value,
          style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 13)),
    ]);
  }
}
