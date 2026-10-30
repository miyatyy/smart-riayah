import 'package:flutter/material.dart';
import '../../models/room_model.dart';
import '../../services/supabase_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - FORMULIR MANAJEMEN KAMAR ASRAMA (TAMBAH / EDIT)
 * Setara persis dengan versi web:
 * - Nama Gedung & Nomor Kamar
 * - Kategori Asrama (PUTRA / PUTRI)
 * - Lantai & Kapasitas Kasur (Beds)
 * - Ketua Kamar & Catatan Hasil Inspeksi
 * ============================================================================
 */

class ManageRoomsScreen extends StatefulWidget {
  final RoomModel? roomToEdit;

  const ManageRoomsScreen({super.key, this.roomToEdit});

  @override
  State<ManageRoomsScreen> createState() => _ManageRoomsScreenState();
}

class _ManageRoomsScreenState extends State<ManageRoomsScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _gedungController;
  late TextEditingController _nomorKamarController;
  late TextEditingController _lantaiController;
  late TextEditingController _kapasitasController;
  late TextEditingController _ketuaKamarController;
  late TextEditingController _catatanController;

  String _selectedKategori = 'PUTRA'; // 'PUTRA' atau 'PUTRI'
  bool _isSubmitting = false;

  bool get _isEditMode => widget.roomToEdit != null;

  @override
  void initState() {
    super.initState();
    final r = widget.roomToEdit;
    _gedungController = TextEditingController(text: r?.namaGedung ?? 'Gedung Al-Fatih');
    _nomorKamarController = TextEditingController(text: r?.nomorKamar ?? '');
    _lantaiController = TextEditingController(text: r?.lantai.toString() ?? '1');
    _kapasitasController = TextEditingController(text: r?.kapasitas.toString() ?? '8');
    _ketuaKamarController = TextEditingController(text: r?.ketuaKamar ?? '-');
    _catatanController = TextEditingController(text: r?.catatanInspeksi ?? 'Kondisi kamar bersih dan rapi.');
    _selectedKategori = r?.kategoriGedung.toUpperCase() ?? 'PUTRA';
  }

  @override
  void dispose() {
    _gedungController.dispose();
    _nomorKamarController.dispose();
    _lantaiController.dispose();
    _kapasitasController.dispose();
    _ketuaKamarController.dispose();
    _catatanController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final lantai = int.tryParse(_lantaiController.text.trim()) ?? 1;
    final kapasitas = int.tryParse(_kapasitasController.text.trim()) ?? 8;

    bool success = false;
    if (_isEditMode) {
      success = await SupabaseService.updateRoom(
        roomId: widget.roomToEdit!.id,
        nomorKamar: _nomorKamarController.text.trim(),
        kapasitas: kapasitas,
        ketuaKamar: _ketuaKamarController.text.trim(),
        catatanInspeksi: _catatanController.text.trim(),
      );
    } else {
      success = await SupabaseService.insertRoom(
        namaGedung: _gedungController.text.trim(),
        kategoriGedung: _selectedKategori,
        nomorKamar: _nomorKamarController.text.trim(),
        lantai: lantai,
        kapasitas: kapasitas,
        ketuaKamar: _ketuaKamarController.text.trim(),
        catatanInspeksi: _catatanController.text.trim(),
      );
    }

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _isEditMode
                ? 'Data kamar ${_nomorKamarController.text} berhasil diperbarui!'
                : 'Kamar baru ${_nomorKamarController.text} berhasil ditambahkan!',
          ),
          backgroundColor: const Color(0xFF047857),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Gagal menyimpan kamar ke Supabase. Periksa koneksi internet.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF047857);

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
        title: Text(
          _isEditMode ? 'Edit Kamar Asrama' : 'Tambah Kamar Baru',
          style: const TextStyle(
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
              // Banner Info
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: primaryColor.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: primaryColor.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.door_sliding_rounded, color: primaryColor, size: 28),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Data kamar dan alokasi kasur asrama terhubung secara live ke Supabase dan langsung dapat dipilih pada pendaftaran santri baru.',
                        style: TextStyle(fontSize: 11.5, height: 1.4, color: Color(0xFF0F5132)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Kategori Gedung (Putra / Putri)
              const Text(
                'Kategori Blok Asrama',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => setState(() => _selectedKategori = 'PUTRA'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _selectedKategori == 'PUTRA' ? const Color(0xFF1E3A8A).withOpacity(0.1) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _selectedKategori == 'PUTRA' ? const Color(0xFF1E3A8A) : const Color(0xFFE2E8F0),
                            width: _selectedKategori == 'PUTRA' ? 1.8 : 1.0,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.apartment_rounded, color: _selectedKategori == 'PUTRA' ? const Color(0xFF1E3A8A) : Colors.grey),
                            const SizedBox(width: 8),
                            Text(
                              'Asrama PUTRA',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _selectedKategori == 'PUTRA' ? const Color(0xFF1E3A8A) : const Color(0xFF64748B),
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
                      onTap: () => setState(() => _selectedKategori = 'PUTRI'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _selectedKategori == 'PUTRI' ? const Color(0xFFBE185D).withOpacity(0.1) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _selectedKategori == 'PUTRI' ? const Color(0xFFBE185D) : const Color(0xFFE2E8F0),
                            width: _selectedKategori == 'PUTRI' ? 1.8 : 1.0,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.domain_rounded, color: _selectedKategori == 'PUTRI' ? const Color(0xFFBE185D) : Colors.grey),
                            const SizedBox(width: 8),
                            Text(
                              'Asrama PUTRI',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: _selectedKategori == 'PUTRI' ? const Color(0xFFBE185D) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Nama Gedung
              _buildTextField(
                controller: _gedungController,
                label: 'Nama Gedung / Kompleks',
                hint: 'Contoh: Gedung Al-Fatih',
                icon: Icons.location_city_rounded,
                validator: (val) => val == null || val.trim().isEmpty ? 'Nama gedung wajib diisi' : null,
              ),
              const SizedBox(height: 14),

              // Nomor Kamar & Lantai
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: _buildTextField(
                      controller: _nomorKamarController,
                      label: 'Nomor Kamar',
                      hint: 'Contoh: 101, A-02',
                      icon: Icons.meeting_room_rounded,
                      validator: (val) => val == null || val.trim().isEmpty ? 'Nomor kamar wajib diisi' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: _buildTextField(
                      controller: _lantaiController,
                      label: 'Lantai',
                      hint: '1',
                      icon: Icons.stairs_rounded,
                      keyboardType: TextInputType.number,
                      validator: (val) => val == null || val.trim().isEmpty ? 'Wajib diisi' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Kapasitas Kasur (Beds) & Ketua Kamar
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: _buildTextField(
                      controller: _kapasitasController,
                      label: 'Kapasitas (Kasur)',
                      hint: '8',
                      icon: Icons.bed_rounded,
                      keyboardType: TextInputType.number,
                      validator: (val) => val == null || val.trim().isEmpty ? 'Kapasitas wajib diisi' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 3,
                    child: _buildTextField(
                      controller: _ketuaKamarController,
                      label: 'Ketua / Mas\'ul Kamar',
                      hint: 'Nama santri ketua',
                      icon: Icons.person_outline_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Catatan Inspeksi
              _buildTextField(
                controller: _catatanController,
                label: 'Catatan Kelayakan / Inspeksi',
                hint: 'Kondisi kamar, kelayakan kasur, AC/kipas, dll.',
                icon: Icons.notes_rounded,
                maxLines: 2,
              ),
              const SizedBox(height: 28),

              // Tombol Simpan
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
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(_isEditMode ? Icons.update_rounded : Icons.check_circle_rounded, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              _isEditMode ? 'Perbarui Data Kamar' : 'Simpan Kamar ke Supabase',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
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
          maxLines: maxLines,
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

