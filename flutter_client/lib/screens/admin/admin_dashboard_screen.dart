import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../models/user_session_model.dart';
import '../../models/santri_model.dart';
import '../../models/room_model.dart';
import '../../services/supabase_service.dart';
import '../../services/session_service.dart';
import '../../widgets/room_occupancy_card.dart';
import '../../widgets/delete_confirm_dialog.dart';
import 'onboarding_santri_screen.dart';
import 'manage_rooms_screen.dart';
import '../common/rfid_tap_screen.dart';
import '../auth/login_screen.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - DASHBOARD ADMIN PONDOK / PENGURUS ASRAMA
 * Setara persis dengan versi web:
 * - Ringkasan statistik santri & asrama
 * - Status kuota kamar asrama putra/putri real-time
 * - Kontrol penuh data master (Tambah, Edit, Hapus data kamar serta santri)
 * - Supabase Realtime Channel aktif (Auto-update tanpa pull-to-refresh)
 * ============================================================================
 */

class AdminDashboardScreen extends StatefulWidget {
  final UserSessionModel session;

  const AdminDashboardScreen({super.key, required this.session});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  int _currentTabIndex = 0; // 0: Kamar & Asrama, 1: Data Santri, 2: Smart Gate
  bool _isLoading = true;
  List<RoomModel> _roomsList = [];
  List<SantriModel> _santriList = [];
  String _searchQuery = '';
  String _selectedGenderFilter = 'ALL'; // 'ALL', 'PUTRA', 'PUTRI'

  RealtimeChannel? _roomsChannel;
  RealtimeChannel? _santriChannel;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _setupRealtimeListeners();
  }

  @override
  void dispose() {
    _roomsChannel?.unsubscribe();
    _santriChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      SupabaseService.getRoomsList(),
      SupabaseService.getSantriList(),
    ]);

    if (mounted) {
      setState(() {
        _roomsList = results[0] as List<RoomModel>;
        _santriList = results[1] as List<SantriModel>;
        _isLoading = false;
      });
    }
  }

  void _setupRealtimeListeners() {
    // 1. Listen to 'rooms' table changes
    _roomsChannel = SupabaseService.subscribeTableChanges(
      tableName: 'rooms',
      onChange: (payload) {
        print('⚡ [Flutter Realtime] Rooms table changed: ${payload.eventType}');
        _loadInitialData();
      },
    );

    // 2. Listen to 'santri' table changes
    _santriChannel = SupabaseService.subscribeTableChanges(
      tableName: 'santri',
      onChange: (payload) {
        print('⚡ [Flutter Realtime] Santri table changed: ${payload.eventType}');
        _loadInitialData();
      },
    );
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Konfirmasi Keluar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text('Apakah Anda yakin ingin keluar dari akun ini?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await SessionService.clearSession();
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    }
  }

  // Action Hapus Santri dengan dialog konfirmasi
  Future<void> _confirmDeleteSantri(SantriModel santri) async {
    final success = await DeleteConfirmDialog.show(
      context,
      title: 'Hapus Data Santri',
      message: 'Apakah Anda yakin ingin menghapus data santri ini? Data kartu RFID dan riwayat asrama akan dihapus.',
      itemName: santri.namaLengkap,
      itemId: santri.id,
      itemType: 'Santri',
      onConfirmAction: () async {
        return await SupabaseService.deleteSantri(santri.id, kamarId: santri.kamarId);
      },
    );

    if (success == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('🗑️ Data "${santri.namaLengkap}" berhasil dihapus dari Supabase & Firebase!'),
          backgroundColor: const Color(0xFF047857),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadInitialData();
    }
  }

  // Action Hapus Kamar dengan dialog konfirmasi
  Future<void> _confirmDeleteRoom(RoomModel room) async {
    final success = await DeleteConfirmDialog.show(
      context,
      title: 'Hapus Kamar Asrama',
      message: 'Apakah Anda yakin ingin menghapus kamar ini? Kuota kamar akan dibersihkan dari database.',
      itemName: '${room.nomorKamar} (${room.namaGedung})',
      itemId: room.id,
      itemType: 'Kamar',
      onConfirmAction: () async {
        return await SupabaseService.deleteRoom(room.id);
      },
    );

    if (success == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('🗑️ Kamar "${room.nomorKamar}" berhasil dihapus dari database!'),
          backgroundColor: const Color(0xFF047857),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadInitialData();
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.role;
    final primaryColor = role.primaryColor;

    // Filtered rooms
    final filteredRooms = _roomsList.filter((r) {
      if (_selectedGenderFilter == 'PUTRA' && r.isPutri) return false;
      if (_selectedGenderFilter == 'PUTRI' && !r.isPutri) return false;
      return true;
    }).toList();

    // Filtered santri
    final filteredSantri = _santriList.where((s) {
      if (_searchQuery.isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return s.namaLengkap.toLowerCase().contains(q) ||
          s.nis.contains(q) ||
          s.kamar.toLowerCase().contains(q) ||
          (s.rfidUid != null && s.rfidUid!.toLowerCase().contains(q));
    }).toList();

    // Statistics
    final totalSantri = _santriList.length;
    final diAsrama = _santriList.where((s) => s.isPresent).length;
    final diLuar = _santriList.where((s) => s.isIzin).length;
    final totalKasur = _roomsList.fold<int>(0, (sum, r) => sum + r.kapasitas);
    final kasurTerisi = _roomsList.fold<int>(0, (sum, r) => sum + r.terisi);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: primaryColor.withOpacity(0.12),
              child: Icon(role.icon, color: primaryColor, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.session.namaLengkap,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Row(
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Color(0xFF10B981),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${role.title} • Supabase Live',
                        style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: 'Refresh Data',
            onPressed: _loadInitialData,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
            tooltip: 'Keluar',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF047857)))
          : RefreshIndicator(
              onRefresh: _loadInitialData,
              color: const Color(0xFF047857),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Statistics Grid (4 Cards)
                    Row(
                      children: [
                        Expanded(
                          child: _buildStatCard(
                            label: 'Total Santri',
                            value: '$totalSantri',
                            subtext: 'Buku Induk',
                            color: const Color(0xFF047857),
                            icon: Icons.people_alt_rounded,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildStatCard(
                            label: 'Di Asrama',
                            value: '$diAsrama',
                            subtext: 'Real-time Hadir',
                            color: const Color(0xFF0D9488),
                            icon: Icons.home_rounded,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _buildStatCard(
                            label: 'Izin / Di Luar',
                            value: '$diLuar',
                            subtext: 'Pesiar & Pulang',
                            color: const Color(0xFFD97706),
                            icon: Icons.time_to_leave_rounded,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildStatCard(
                            label: 'Keterisian Kasur',
                            value: '$kasurTerisi / $totalKasur',
                            subtext: '${totalKasur > 0 ? ((kasurTerisi / totalKasur) * 100).round() : 0}% Terisi',
                            color: const Color(0xFF2563EB),
                            icon: Icons.bed_rounded,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Navigation Segmented Tabs
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          _buildTabItem(0, 'Kamar (${_roomsList.length})', Icons.meeting_room_rounded),
                          _buildTabItem(1, 'Santri (${_santriList.length})', Icons.school_rounded),
                          _buildTabItem(2, 'Smart Gate', Icons.contactless_rounded),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // TAB 0: KAMAR ASRAMA
                    if (_currentTabIndex == 0) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Kamar & Kuota Asrama',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          ),
                          ElevatedButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const ManageRoomsScreen()),
                              ).then((_) => _loadInitialData());
                            },
                            icon: const Icon(Icons.add, size: 16),
                            label: const Text('Tambah Kamar'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF047857),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                              textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Filter Gender Chips
                      Row(
                        children: [
                          _buildFilterChip('ALL', 'Semua (${_roomsList.length})'),
                          const SizedBox(width: 6),
                          _buildFilterChip('PUTRA', 'Asrama Putra'),
                          const SizedBox(width: 6),
                          _buildFilterChip('PUTRI', 'Asrama Putri'),
                        ],
                      ),
                      const SizedBox(height: 14),

                      if (filteredRooms.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(32),
                          alignment: Alignment.center,
                          child: Column(
                            children: [
                              Icon(Icons.meeting_room_outlined, size: 48, color: Colors.grey.shade400),
                              const SizedBox(height: 8),
                              const Text('Belum ada data kamar.', style: TextStyle(color: Colors.grey)),
                            ],
                          ),
                        )
                      else
                        ...filteredRooms.map(
                          (room) => RoomOccupancyCard(
                            room: room,
                            onEdit: () {
                              // Dialog Edit Kamar
                              _showEditRoomDialog(room);
                            },
                            onDelete: () => _confirmDeleteRoom(room),
                          ),
                        ),
                    ],

                    // TAB 1: DATA SANTRI & ONBOARDING
                    if (_currentTabIndex == 1) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Buku Induk Santri',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          ),
                          ElevatedButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => OnboardingSantriScreen(availableRooms: _roomsList),
                                ),
                              ).then((_) => _loadInitialData());
                            },
                            icon: const Icon(Icons.person_add_rounded, size: 16),
                            label: const Text('Daftar Santri Baru'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF047857),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                              textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Search Field
                      TextField(
                        onChanged: (val) => setState(() => _searchQuery = val),
                        decoration: InputDecoration(
                          hintText: 'Cari nama, NIS, kamar, atau UID kartu...',
                          prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
                          filled: true,
                          fillColor: Colors.white,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      if (filteredSantri.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(32.0),
                          child: Center(child: Text('Tidak ada santri yang cocok dengan pencarian.')),
                        )
                      else
                        ...filteredSantri.map(
                          (santri) => _buildSantriListItem(santri),
                        ),
                    ],

                    // TAB 2: SMART GATE & RFID
                    if (_currentTabIndex == 2) ...[
                      const Text(
                        'Simulasi Hardware Smart Gate ESP32-S3',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Uji coba tap kartu RFID 13.56 MHz untuk absensi keluar/masuk asrama secara live.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 16),

                      Center(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => RfidTapScreen(session: widget.session)),
                            ).then((_) => _loadInitialData());
                          },
                          icon: const Icon(Icons.contactless_rounded, size: 24),
                          label: const Text('Buka Terminal Smart Gate'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F766E),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required String value,
    required String subtext,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color, fontFamily: 'monospace'),
          ),
          const SizedBox(height: 2),
          Text(subtext, style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }

  Widget _buildTabItem(int index, String label, IconData icon) {
    final isSelected = _currentTabIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _currentTabIndex = index),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: isSelected ? const Color(0xFF047857) : const Color(0xFF64748B),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String value, String label) {
    final isSelected = _selectedGenderFilter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => setState(() => _selectedGenderFilter = value),
      selectedColor: const Color(0xFF047857),
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
        color: isSelected ? Colors.white : const Color(0xFF475569),
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isSelected ? const Color(0xFF047857) : const Color(0xFFE2E8F0)),
      ),
    );
  }

  Widget _buildSantriListItem(SantriModel santri) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundImage: NetworkImage(santri.fotoUrl ?? santri.defaultAvatar),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  santri.namaLengkap,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                ),
                Text(
                  'NIS: ${santri.nis} • ${santri.kamar}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: santri.isPresent ? const Color(0xFFD1FAE5) : const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        santri.statusLabel,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          color: santri.isPresent ? const Color(0xFF065F46) : const Color(0xFF92400E),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'UID: ${santri.rfidUid ?? '-'}',
                      style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF047857)),
                    ),
                  ],
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

  void _showEditRoomDialog(RoomModel room) {
    final noKamarCtrl = TextEditingController(text: room.nomorKamar);
    final kapasitasCtrl = TextEditingController(text: room.kapasitas.toString());
    final ketuaCtrl = TextEditingController(text: room.ketuaKamar);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Edit Data ${room.nomorKamar}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: noKamarCtrl,
              decoration: const InputDecoration(labelText: 'Nomor Kamar'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: kapasitasCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Kapasitas (Kasur)'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: ketuaCtrl,
              decoration: const InputDecoration(labelText: 'Ketua Kamar'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF047857), foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              final cap = int.tryParse(kapasitasCtrl.text) ?? room.kapasitas;
              await SupabaseService.updateRoom(
                roomId: room.id,
                nomorKamar: noKamarCtrl.text,
                kapasitas: cap,
                ketuaKamar: ketuaCtrl.text,
              );
              _loadInitialData();
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }
}

extension IterableExtension<T> on Iterable<T> {
  Iterable<T> filter(bool Function(T element) test) => where(test);
}

