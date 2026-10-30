import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../models/user_session_model.dart';
import '../../models/santri_model.dart';
import '../../models/permit_model.dart';
import '../../services/supabase_service.dart';
import '../../services/session_service.dart';
import '../../widgets/rfid_card_widget.dart';
import '../auth/login_screen.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - DASHBOARD SANTRI & WALI SANTRI
 * Desain Material 3 / Human Interface Guidelines kelas enterprise:
 * - Panel Informasi Personal Santri & Status Keberadaan Asrama Real-time
 * - Smart Card Mifare RFID & Dompet Pintar Cashless
 * - Pengajuan & Token Perizinan Elektronik (DU-PERMIT)
 * - Timeline Aktivitas Harian & Riwayat Gate
 * - Terkoneksi Real-time Supabase Database
 * ============================================================================
 */

class SantriWaliDashboardScreen extends StatefulWidget {
  final UserSessionModel session;

  const SantriWaliDashboardScreen({super.key, required this.session});

  @override
  State<SantriWaliDashboardScreen> createState() => _SantriWaliDashboardScreenState();
}

class _SantriWaliDashboardScreenState extends State<SantriWaliDashboardScreen> {
  bool _isLoading = true;
  SantriModel? _santri;
  List<PermitModel> _permitsList = [];
  RealtimeChannel? _santriChannel;
  RealtimeChannel? _permitsChannel;

  @override
  void initState() {
    super.initState();
    _loadSantriData();
    _setupRealtime();
  }

  @override
  void dispose() {
    _santriChannel?.unsubscribe();
    _permitsChannel?.unsubscribe();
    super.dispose();
  }

  Future<void> _loadSantriData() async {
    setState(() => _isLoading = true);

    try {
      final allSantri = await SupabaseService.getSantriList();
      if (allSantri.isNotEmpty) {
        // Cocokkan berdasarkan santriId pada session, atau ambil yang pertama jika testing/wali
        final found = allSantri.firstWhere(
          (s) => s.id == widget.session.santriId || s.nis == widget.session.username,
          orElse: () => allSantri.first,
        );
        _santri = found;

        // Ambil riwayat izin untuk santri ini
        _permitsList = await SupabaseService.getPermitsList(santriId: _santri?.id);
      }
    } catch (e) {
      print('❌ [SantriWaliDashboard] Error loading data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _setupRealtime() {
    _santriChannel = SupabaseService.subscribeTableChanges(
      tableName: 'santri',
      onChange: (payload) {
        print('⚡ [Realtime Santri Dashboard] santri updated');
        _loadSantriData();
      },
    );

    _permitsChannel = SupabaseService.subscribeTableChanges(
      tableName: 'permits',
      onChange: (payload) {
        print('⚡ [Realtime Santri Dashboard] permits updated');
        _loadSantriData();
      },
    );
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Konfirmasi Keluar', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Apakah Anda yakin ingin keluar dari akun Smart Ri\'ayah?'),
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

  void _showPermitDialog() {
    if (_santri == null) return;

    final kategoriController = TextEditingController(text: 'PULANG');
    final keperluanController = TextEditingController();
    final penjemputController = TextEditingController(text: widget.session.namaLengkap);
    DateTime batasKembali = DateTime.now().add(const Duration(days: 2));
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(context).viewInsets.bottom + 24,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Formulir Pengajuan Izin Keluar',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
                const Text(
                  'Izin akan divalidasi oleh Musyrif dan diterbitkan token gate digital.',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 16),

                // Kategori
                const Text('Kategori Izin', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: kategoriController.text,
                  items: const [
                    DropdownMenuItem(value: 'PULANG', child: Text('Izin Pulang ke Rumah')),
                    DropdownMenuItem(value: 'PESIAR', child: Text('Pesiar / Belanja Keperluan')),
                    DropdownMenuItem(value: 'BEROBAT', child: Text('Berobat ke Rumah Sakit/Klinik')),
                    DropdownMenuItem(value: 'LOMBA', child: Text('Delegasi Lomba / Acara Luar')),
                  ],
                  onChanged: (val) => setModalState(() => kategoriController.text = val ?? 'PULANG'),
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),

                // Keperluan
                const Text('Keperluan / Alasan Izin', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                TextField(
                  controller: keperluanController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'Contoh: Menghadiri walimah keluarga di kampung halaman.',
                    hintStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),

                // Penjemput
                const Text('Nama Penjemput / Wali', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                TextField(
                  controller: penjemputController,
                  decoration: InputDecoration(
                    hintText: 'Nama lengkap orang yang menjemput',
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 20),

                // Submit Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            if (keperluanController.text.trim().isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Keperluan izin wajib diisi!')),
                              );
                              return;
                            }
                            setModalState(() => isSubmitting = true);
                            final success = await SupabaseService.submitPermit(
                              santriId: _santri!.id,
                              santriNama: _santri!.namaLengkap,
                              kategori: kategoriController.text,
                              keperluan: keperluanController.text,
                              penjemput: penjemputController.text,
                              batasKembali: batasKembali,
                            );
                            if (context.mounted) {
                              Navigator.pop(ctx);
                              if (success) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Pengajuan izin berhasil dikirimkan ke Musyrif!'),
                                    backgroundColor: Color(0xFF047857),
                                  ),
                                );
                                _loadSantriData();
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF047857),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : const Text('Ajukan Izin Sekarang', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currencyFmt = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
    const primaryColor = Color(0xFF047857);

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
              backgroundColor: const Color(0xFF0369A1).withOpacity(0.12),
              child: const Icon(Icons.person_rounded, color: Color(0xFF0369A1), size: 20),
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
                  Text(
                    '${widget.session.role.title} • Portal Pintar',
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: 'Refresh',
            onPressed: _loadSantriData,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
            tooltip: 'Keluar',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: primaryColor))
          : RefreshIndicator(
              onRefresh: _loadSantriData,
              color: primaryColor,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Kartu Status Keberadaan Santri (Live Presence Badge)
                    _buildPresenceBanner(),
                    const SizedBox(height: 16),

                    // Visualisasi Kartu RFID Fisik & Dompet Pintar Cashless
                    if (_santri != null)
                      RfidCardWidget(
                        rfidUid: _santri!.rfidUid ?? '04:A1:2B:9C',
                        santriNama: _santri!.namaLengkap,
                        nis: _santri!.nis,
                        saldo: _santri!.saldoRfid,
                      ),
                    const SizedBox(height: 18),

                    // Quick Stats Santri (Poin Disiplin, Kamar, Limit Jajan)
                    if (_santri != null)
                      Row(
                        children: [
                          Expanded(
                            child: _buildInfoCard(
                              title: 'Poin Disiplin',
                              value: '${_santri!.poinDisiplin}',
                              subtitle: 'Sangat Baik (A)',
                              icon: Icons.star_rounded,
                              color: const Color(0xFF047857),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildInfoCard(
                              title: 'Kamar Asrama',
                              value: _santri!.kamar,
                              subtitle: 'Kelas ${_santri!.kelas}',
                              icon: Icons.bed_rounded,
                              color: const Color(0xFF0284C7),
                            ),
                          ),
                        ],
                      ),
                    const SizedBox(height: 20),

                    // Quick Action: Ajukan Perizinan
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.02),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFF047857).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.note_alt_outlined, color: Color(0xFF047857), size: 24),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Perizinan Keluar Santri',
                                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                ),
                                Text(
                                  'Ajukan izin pulang, berobat, atau pesiar secara online',
                                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          ElevatedButton(
                            onPressed: _showPermitDialog,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF047857),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                            child: const Text('Ajukan', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Riwayat Perizinan & Timeline Aktivitas
                    const Text(
                      'Riwayat Perizinan & Token Smart Gate',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 10),

                    if (_permitsList.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(28),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          children: [
                            Icon(Icons.event_available_rounded, size: 40, color: Colors.grey.shade400),
                            const SizedBox(height: 8),
                            const Text(
                              'Belum ada riwayat perizinan aktif.',
                              style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      )
                    else
                      ..._permitsList.map((permit) => _buildPermitCard(permit)),

                    const SizedBox(height: 30),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildPresenceBanner() {
    final bool isPresent = _santri?.isPresent ?? true;
    final Color badgeColor = isPresent ? const Color(0xFF047857) : const Color(0xFFD97706);
    final String statusText = isPresent ? 'STATUS: DI DALAM ASRAMA' : 'STATUS: SEDANG DI LUAR ASRAMA';
    final String descText = isPresent
        ? 'Santri tercatat berada di lingkungan pondok ri\'ayah.'
        : 'Santri tercatat keluar asrama melalui Smart Turnstile Gate.';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: badgeColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: badgeColor.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: badgeColor,
              shape: BoxShape.circle,
            ),
            child: Icon(
              isPresent ? Icons.check_circle_rounded : Icons.departure_board_rounded,
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
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                    color: badgeColor,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  descText,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF475569)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required String title,
    required String value,
    required String subtitle,
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
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                title,
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
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
                'Token: ${permit.tokenIzin}',
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 10.5,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF475569),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${permit.kategori} - ${permit.keperluan}',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.access_time_rounded, size: 13, color: Color(0xFF94A3B8)),
              const SizedBox(width: 4),
              Text(
                'Batas Kembali: ${permit.batasKembali != null ? DateFormat('dd MMM yyyy, HH:mm').format(permit.batasKembali!) : "Tidak ditentukan"}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

