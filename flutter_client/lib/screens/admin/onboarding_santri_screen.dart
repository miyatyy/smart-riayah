import 'dart:math';
import 'package:flutter/material.dart';
import '../../models/room_model.dart';
import '../../services/supabase_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - FORMULIR ONBOARDING SANTRI BARU
 * Setara persis dengan versi web:
 * - Sinkronisasi input data santri (Nama, NIS, Kelas, Gender)
 * - Pemilihan kamar berkuota otomatis sesuai gender (Putra/Putri)
 * - Input & Auto-generate UID Kartu RFID fisik (Mifare 13.56MHz)
 * - Saldo awal Dompet Pintar Cashless
 * - Nomor WhatsApp Wali (Terintegrasi Live WhatsApp Gateway)
 * ============================================================================
 */

class OnboardingSantriScreen extends StatefulWidget {
  final List<RoomModel> availableRooms;

  const OnboardingSantriScreen({
    super.key,
    required this.availableRooms,
  });

  @override
  State<OnboardingSantriScreen> createState() => _OnboardingSantriScreenState();
}

class _OnboardingSantriScreenState extends State<OnboardingSantriScreen> {
  final _formKey = GlobalKey<FormState>();

  // Controllers
  final _namaController = TextEditingController();
  final _nisController = TextEditingController();
  final _kelasController = TextEditingController(text: '10-A');
  final _rfidUidController = TextEditingController();
  final _saldoAwalController = TextEditingController(text: '50000');
  final _namaWaliController = TextEditingController();
  final _noWaliController = TextEditingController();

  String _selectedGender = 'L'; // 'L' (Putra) atau 'P' (Putri)
  RoomModel? _selectedRoom;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _generateRandomRfidUid();
    _autoSelectFirstMatchingRoom();
  }

  @override
  void dispose() {
    _namaController.dispose();
    _nisController.dispose();
    _kelasController.dispose();
    _rfidUidController.dispose();
    _saldoAwalController.dispose();
    _namaWaliController.dispose();
    _noWaliController.dispose();
    super.dispose();
  }

  void _generateRandomRfidUid() {
    final random = Random();
    final hexChars = '0123456789ABCDEF';
    final parts = List.generate(4, (_) {
      return '${hexChars[random.nextInt(16)]}${hexChars[random.nextInt(16)]}';
    });
    setState(() {
      _rfidUidController.text = parts.join(':');
    });
  }

  void _autoSelectFirstMatchingRoom() {
    final targetCategory = _selectedGender == 'L' ? 'PUTRA' : 'PUTRI';
    final matching = widget.availableRooms.where(
      (r) => r.kategoriGedung.toUpperCase() == targetCategory && r.kasurTersisa > 0,
    );
    if (matching.isNotEmpty) {
      setState(() {
        _selectedRoom = matching.first;
      });
    } else {
      setState(() {
        _selectedRoom = null;
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedRoom == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Silakan pilih kamar asrama yang masih memiliki kuota kosong!'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final saldoAwal = int.tryParse(_saldoAwalController.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 50000;

    final success = await SupabaseService.insertSantri(
      namaLengkap: _namaController.text,
      nis: _nisController.text,
      gender: _selectedGender,
      kelas: _kelasController.text,
      kamarId: _selectedRoom?.id,
      kamar: _selectedRoom != null ? '${_selectedRoom!.namaGedung} - Kamar ${_selectedRoom!.nomorKamar}' : 'Belum Ditentukan',
      rfidUid: _rfidUidController.text,
      saldoAwal: saldoAwal,
      namaWali: _namaWaliController.text,
      noWali: _noWaliController.text,
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Santri ${_namaController.text} berhasil didaftarkan ke Supabase!'),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF047857),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Gagal menyimpan santri. Silakan periksa koneksi internet.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF047857);

    // Filter kamar sesuai gender yang dipilih
    final targetCategory = _selectedGender == 'L' ? 'PUTRA' : 'PUTRI';
    final eligibleRooms = widget.availableRooms
        .where((r) => r.kategoriGedung.toUpperCase() == targetCategory)
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Pendaftaran Santri Baru',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            children: [
              // Banner info
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: primaryColor.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.how_to_reg_rounded, color: primaryColor, size: 28),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Data santri baru akan langsung tersinkronisasi permanen ke tabel santri Supabase PostgreSQL dan Live WhatsApp Gateway.',
                        style: TextStyle(
                          fontSize: 11.5,
                          height: 1.4,
                          color: Color(0xFF0F5132),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // SECTION 1: IDENTITAS SANTRI
              _buildSectionHeader('1. IDENTITAS SANTRI', Icons.person_rounded),
              const SizedBox(height: 12),

              _buildTextField(
                controller: _namaController,
                label: 'Nama Lengkap Santri',
                hint: 'Contoh: Ahmad Fauzan Robbani',
                icon: Icons.badge_rounded,
                validator: (val) => val == null || val.trim().isEmpty ? 'Nama santri wajib diisi' : null,
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: _buildTextField(
                      controller: _nisController,
                      label: 'Nomor Induk Santri (NIS)',
                      hint: 'Contoh: 202601008',
                      icon: Icons.numbers_rounded,
                      keyboardType: TextInputType.number,
                      validator: (val) => val == null || val.trim().isEmpty ? 'NIS wajib diisi' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: _buildTextField(
                      controller: _kelasController,
                      label: 'Kelas / Halaqah',
                      hint: '10-A',
                      icon: Icons.school_rounded,
                      validator: (val) => val == null || val.trim().isEmpty ? 'Wajib diisi' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Jenis Kelamin Selector
              const Text(
                'Jenis Kelamin Santri',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () {
                        setState(() {
                          _selectedGender = 'L';
                          _autoSelectFirstMatchingRoom();
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _selectedGender == 'L' ? const Color(0xFF1E3A8A).withOpacity(0.1) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _selectedGender == 'L' ? const Color(0xFF1E3A8A) : const Color(0xFFE2E8F0),
                            width: _selectedGender == 'L' ? 1.8 : 1.0,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.male_rounded,
                              color: _selectedGender == 'L' ? const Color(0xFF1E3A8A) : Colors.grey,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Santri Putra (L)',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.bold,
                                color: _selectedGender == 'L' ? const Color(0xFF1E3A8A) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () {
                        setState(() {
                          _selectedGender = 'P';
                          _autoSelectFirstMatchingRoom();
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _selectedGender == 'P' ? const Color(0xFFBE185D).withOpacity(0.1) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _selectedGender == 'P' ? const Color(0xFFBE185D) : const Color(0xFFE2E8F0),
                            width: _selectedGender == 'P' ? 1.8 : 1.0,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.female_rounded,
                              color: _selectedGender == 'P' ? const Color(0xFFBE185D) : Colors.grey,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Santri Putri (P)',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.bold,
                                color: _selectedGender == 'P' ? const Color(0xFFBE185D) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // SECTION 2: PENEMPATAN KAMAR & RFID SMART CARD
              _buildSectionHeader('2. PENEMPATAN KAMAR & SMART CARD', Icons.meeting_room_rounded),
              const SizedBox(height: 12),

              // Dropdown Kamar
              const Text(
                'Pilih Kamar Asrama (Tersedia Sesuai Gender)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<RoomModel>(
                    isExpanded: true,
                    value: eligibleRooms.contains(_selectedRoom) ? _selectedRoom : null,
                    hint: Text(
                      eligibleRooms.isEmpty
                          ? 'Belum ada kamar $targetCategory tersedia'
                          : 'Pilih Kamar Asrama',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                    ),
                    items: eligibleRooms.map((room) {
                      final sisa = room.kasurTersisa;
                      final isFull = sisa <= 0;
                      return DropdownMenuItem<RoomModel>(
                        value: room,
                        enabled: !isFull,
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isFull ? Colors.grey.shade200 : const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isFull ? 'PENUH' : 'Sisa $sisa kasur',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: isFull ? Colors.grey : const Color(0xFF15803D),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                '${room.namaGedung} - No. ${room.nomorKamar} (Lt. ${room.lantai})',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: isFull ? Colors.grey : const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setState(() => _selectedRoom = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // RFID UID
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: _buildTextField(
                      controller: _rfidUidController,
                      label: 'UID Fisik Kartu RFID (Mifare 13.56 MHz)',
                      hint: '04:A1:2B:9C',
                      icon: Icons.nfc_rounded,
                      validator: (val) => val == null || val.trim().isEmpty ? 'UID Kartu wajib diisi' : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    margin: const EdgeInsets.only(bottom: 2),
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: _generateRandomRfidUid,
                      icon: const Icon(Icons.autorenew_rounded, size: 16),
                      label: const Text('Acak UID'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Saldo Awal Dompet Pintar
              _buildTextField(
                controller: _saldoAwalController,
                label: 'Saldo Awal Dompet Pintar (Rp)',
                hint: '50000',
                icon: Icons.account_balance_wallet_rounded,
                keyboardType: TextInputType.number,
                validator: (val) => val == null || val.trim().isEmpty ? 'Saldo awal wajib diisi' : null,
              ),
              const SizedBox(height: 24),

              // SECTION 3: DATA WALI & LIVE WHATSAPP GATEWAY
              _buildSectionHeader('3. DATA WALI & WHATSAPP GATEWAY', Icons.family_restroom_rounded),
              const SizedBox(height: 12),

              _buildTextField(
                controller: _namaWaliController,
                label: 'Nama Lengkap Wali / Orang Tua',
                hint: 'Contoh: Bapak Hendra Wijaya',
                icon: Icons.person_pin_rounded,
                validator: (val) => val == null || val.trim().isEmpty ? 'Nama wali wajib diisi' : null,
              ),
              const SizedBox(height: 14),

              _buildTextField(
                controller: _noWaliController,
                label: 'Nomor WhatsApp Wali (Format 62xxx / 08xxx)',
                hint: '081234567890',
                icon: Icons.phone_android_rounded,
                keyboardType: TextInputType.phone,
                validator: (val) => val == null || val.trim().isEmpty ? 'Nomor WhatsApp wajib diisi' : null,
              ),
              const SizedBox(height: 28),

              // SUBMIT BUTTON
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    elevation: 1,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.save_rounded, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Simpan & Terbitkan Kartu Santri',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF047857)),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w900,
            color: Color(0xFF334155),
            letterSpacing: 0.7,
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          validator: validator,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            prefixIcon: Icon(icon, size: 18, color: const Color(0xFF64748B)),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF047857), width: 1.8),
            ),
          ),
        ),
      ],
    );
  }
}

