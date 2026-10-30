import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/user_session_model.dart';
import '../../models/santri_model.dart';
import '../../services/supabase_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - MODUL RFID SMART GATE ESP32-S3
 * Simulasi pembacaan kartu fisik RFID 13.56 MHz (Mifare Classic):
 * - Membaca UID kartu hex (04:A1:2B:9C)
 * - Otomatis toggle status kehadiran santri (DI ASRAMA <-> DI LUAR)
 * - Mencatat gate_logs ke PostgreSQL Supabase
 * - Animasi responsif pembukaan palang pintu otomatis
 * ============================================================================
 */

class RfidTapScreen extends StatefulWidget {
  final UserSessionModel? session;

  const RfidTapScreen({super.key, this.session});

  @override
  State<RfidTapScreen> createState() => _RfidTapScreenState();
}

class _RfidTapScreenState extends State<RfidTapScreen> with SingleTickerProviderStateMixin {
  final TextEditingController _uidController = TextEditingController();
  String _selectedGate = 'GATE-01 (Main Gate)';
  bool _isProcessing = false;
  Map<String, dynamic>? _lastResult;

  List<SantriModel> _sampleSantri = [];
  bool _isLoadingSantri = true;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.05).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _loadSantriSamples();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _uidController.dispose();
    super.dispose();
  }

  Future<void> _loadSantriSamples() async {
    setState(() => _isLoadingSantri = true);
    final list = await SupabaseService.getSantriList();
    if (mounted) {
      setState(() {
        _sampleSantri = list;
        _isLoadingSantri = false;
        if (list.isNotEmpty && _uidController.text.isEmpty) {
          _uidController.text = list.first.rfidUid ?? '04:A1:2B:9C';
        }
      });
    }
  }

  Future<void> _simulateTap([String? explicitUid]) async {
    final uid = explicitUid ?? _uidController.text.trim();
    if (uid.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Silakan masukkan atau pilih UID kartu RFID!')),
      );
      return;
    }

    setState(() {
      _isProcessing = true;
      _lastResult = null;
    });

    // Simulasi jeda transmisi RF 300ms
    await Future.delayed(const Duration(milliseconds: 350));

    final result = await SupabaseService.recordRfidTap(
      rfidUid: uid,
      gateId: _selectedGate,
    );

    if (mounted) {
      setState(() {
        _isProcessing = false;
        _lastResult = result;
      });
      _loadSantriSamples();
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF0F766E);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Dark High-Tech Terminal Theme
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Terminal Smart Gate RFID',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white),
            ),
            Text(
              'Simulasi Hardware ESP32-S3 & RC522 Reader',
              style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Selector Gerbang
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    dropdownColor: const Color(0xFF1E293B),
                    value: _selectedGate,
                    isExpanded: true,
                    items: const [
                      DropdownMenuItem(
                        value: 'GATE-01 (Main Gate)',
                        child: Text('🚪 GATE-01: Gerbang Utama Pondok', style: TextStyle(color: Colors.white, fontSize: 13)),
                      ),
                      DropdownMenuItem(
                        value: 'GATE-02 (Gerbang Putra)',
                        child: Text('🚪 GATE-02: Gerbang Asrama Putra', style: TextStyle(color: Colors.white, fontSize: 13)),
                      ),
                      DropdownMenuItem(
                        value: 'GATE-03 (Gerbang Putri)',
                        child: Text('🚪 GATE-03: Gerbang Asrama Putri', style: TextStyle(color: Colors.white, fontSize: 13)),
                      ),
                    ],
                    onChanged: (val) => setState(() => _selectedGate = val ?? _selectedGate),
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // NFC Reader Interactive Mockup Visual
              AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, child) {
                  return Transform.scale(
                    scale: _isProcessing ? _pulseAnimation.value : 1.0,
                    child: child,
                  );
                },
                child: Container(
                  width: 170,
                  height: 170,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: _lastResult == null
                          ? [const Color(0xFF0F766E), const Color(0xFF047857)]
                          : (_lastResult!['success'] == true
                              ? [const Color(0xFF10B981), const Color(0xFF059669)]
                              : [const Color(0xFFEF4444), const Color(0xFFDC2626)]),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: (_lastResult == null
                                ? const Color(0xFF0F766E)
                                : (_lastResult!['success'] == true
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFFEF4444)))
                            .withOpacity(0.4),
                        blurRadius: 28,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isProcessing
                              ? Icons.sync_rounded
                              : (_lastResult != null && _lastResult!['success'] == true
                                  ? Icons.lock_open_rounded
                                  : Icons.contactless_rounded),
                          size: 58,
                          color: Colors.white,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _isProcessing
                              ? 'MEMBACA...'
                              : (_lastResult != null && _lastResult!['success'] == true
                                  ? 'TERVERIFIKASI'
                                  : 'TEMPEL KARTU'),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Status Banner Result
              if (_lastResult != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: _lastResult!['success'] == true
                        ? const Color(0xFF064E3B).withOpacity(0.6)
                        : const Color(0xFF7F1D1D).withOpacity(0.6),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _lastResult!['success'] == true ? const Color(0xFF059669) : const Color(0xFFDC2626),
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _lastResult!['success'] == true ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _lastResult!['success'] == true
                                ? '${_lastResult!['action']} BERHASIL'
                                : 'AKSES DITOLAK',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _lastResult!['message'] ?? '',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 12, color: Colors.white70),
                      ),
                    ],
                  ),
                ),

              // Input UID Manual / Scan
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'UID FISIK KARTU (HEX):',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF94A3B8),
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _uidController,
                            style: const TextStyle(
                              color: Colors.white,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                              letterSpacing: 1.5,
                            ),
                            decoration: InputDecoration(
                              hintText: '04:A1:2B:9C',
                              hintStyle: const TextStyle(color: Colors.white38),
                              filled: true,
                              fillColor: const Color(0xFF0F172A),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFF475569)),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        ElevatedButton.icon(
                          onPressed: _isProcessing ? null : () => _simulateTap(),
                          icon: const Icon(Icons.touch_app_rounded, size: 18),
                          label: const Text('TAP'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF047857),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Daftar Kartu Santri Terdaftar (Quick Test Tap)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'KARTU SANTRI TERDAFTAR:',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF94A3B8),
                      letterSpacing: 0.8,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _loadSantriSamples,
                    icon: const Icon(Icons.refresh_rounded, size: 14, color: Color(0xFF38BDF8)),
                    label: const Text('Muat Ulang', style: TextStyle(fontSize: 11, color: Color(0xFF38BDF8))),
                  ),
                ],
              ),
              const SizedBox(height: 6),

              if (_isLoadingSantri)
                const Center(child: CircularProgressIndicator(color: primaryColor))
              else if (_sampleSantri.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('Belum ada data santri terdaftar.', style: TextStyle(color: Colors.white54)),
                )
              else
                ..._sampleSantri.map((santri) {
                  final isInside = santri.isPresent;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF334155)),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: isInside ? const Color(0xFF047857) : const Color(0xFFD97706),
                        child: Icon(
                          isInside ? Icons.home_rounded : Icons.directions_walk_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                      title: Text(
                        santri.namaLengkap,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        'UID: ${santri.rfidUid} • ${isInside ? "Di Asrama" : "Di Luar"}',
                        style: TextStyle(
                          color: isInside ? const Color(0xFF34D399) : const Color(0xFFFBBF24),
                          fontSize: 11,
                          fontFamily: 'monospace',
                        ),
                      ),
                      trailing: ElevatedButton(
                        onPressed: () {
                          final uid = santri.rfidUid ?? '04:A1:2B:9C';
                          _uidController.text = uid;
                          _simulateTap(uid);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isInside ? const Color(0xFFDC2626) : const Color(0xFF047857),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                        child: Text(isInside ? 'Tap Keluar' : 'Tap Masuk'),
                      ),
                    ),
                  );
                }),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

