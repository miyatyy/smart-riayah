import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../api_service.dart';
import '../models/santri_model.dart';

class SubmitIzinScreen extends StatefulWidget {
  final List<SantriModel> santriList;

  const SubmitIzinScreen({super.key, required this.santriList});

  @override
  State<SubmitIzinScreen> createState() => _SubmitIzinScreenState();
}

class _SubmitIzinScreenState extends State<SubmitIzinScreen> {
  final _formKey = GlobalKey<FormState>();
  SantriModel? _selectedSantri;
  String _kategori = 'PULANG';
  final _keperluanCtrl = TextEditingController();
  final _penjemputCtrl = TextEditingController();
  DateTime? _batasKembali;
  bool _isSubmitting = false;

  final List<Map<String, dynamic>> _kategoriList = [
    {'value': 'PULANG', 'label': 'Pulang', 'icon': Icons.home_rounded},
    {'value': 'SAKIT', 'label': 'Sakit', 'icon': Icons.local_hospital_rounded},
    {'value': 'KEGIATAN', 'label': 'Kegiatan', 'icon': Icons.event_rounded},
    {'value': 'LAINNYA', 'label': 'Lainnya', 'icon': Icons.more_horiz_rounded},
  ];

  @override
  void dispose() {
    _keperluanCtrl.dispose();
    _penjemputCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDateTimePicker(context, now);
    if (picked != null) setState(() => _batasKembali = picked);
  }

  Future<DateTime?> showDateTimePicker(BuildContext context, DateTime initial) async {
    final date = await showDatePicker(
      context: context,
      initialDate: initial.add(const Duration(days: 1)),
      firstDate: initial,
      lastDate: initial.add(const Duration(days: 30)),
      builder: (ctx, child) => Theme(
        data: ThemeData.light().copyWith(
          colorScheme: const ColorScheme.light(primary: AppColors.emerald700),
        ),
        child: child!,
      ),
    );
    if (date == null) return null;
    if (!context.mounted) return null;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (time == null) return null;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedSantri == null) {
      _showSnack('Pilih santri terlebih dahulu', isError: true);
      return;
    }
    if (_batasKembali == null) {
      _showSnack('Tentukan batas waktu kembali', isError: true);
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final ok = await SmartRiayahApiService.submitPermit(
        santriId: _selectedSantri!.id,
        kategori: _kategori,
        keperluan: _keperluanCtrl.text.trim(),
        penjemput: _penjemputCtrl.text.trim(),
        batasKembali: _batasKembali!.toIso8601String(),
      );
      if (ok && mounted) {
        _showSnack('Izin berhasil diajukan!');
        Navigator.of(context).pop(true);
      } else {
        _showSnack('Gagal mengajukan izin, coba lagi', isError: true);
      }
    } catch (e) {
      _showSnack('Error: $e', isError: true);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.danger : AppColors.emerald600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(12),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.emerald900,
        title: const Text(
          'Ajukan Izin Santri',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Section header
            _buildSectionLabel('Pilih Santri'),
            const SizedBox(height: 8),
            _buildSantriDropdown(),
            const SizedBox(height: 16),

            _buildSectionLabel('Kategori Izin'),
            const SizedBox(height: 8),
            _buildKategoriChips(),
            const SizedBox(height: 16),

            _buildSectionLabel('Keperluan'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _keperluanCtrl,
              hint: 'Jelaskan keperluan izin...',
              maxLines: 3,
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Keperluan wajib diisi' : null,
            ),
            const SizedBox(height: 16),

            _buildSectionLabel('Nama Penjemput'),
            const SizedBox(height: 8),
            _buildTextField(
              controller: _penjemputCtrl,
              hint: 'Nama wali/penjemput',
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Nama penjemput wajib diisi' : null,
            ),
            const SizedBox(height: 16),

            _buildSectionLabel('Batas Kembali'),
            const SizedBox(height: 8),
            _buildDatePicker(),
            const SizedBox(height: 32),

            // Submit button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.emerald700,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.send_rounded, size: 18),
                          SizedBox(width: 8),
                          Text('Ajukan Izin', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String text) => Text(
    text,
    style: const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w700,
      color: AppColors.textPrimary,
    ),
  );

  Widget _buildSantriDropdown() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: DropdownButtonFormField<SantriModel>(
        // ignore: deprecated_member_use
        value: _selectedSantri,
        hint: const Text('Pilih santri...', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
        isExpanded: true,
        decoration: const InputDecoration(
          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: InputBorder.none,
        ),
        items: widget.santriList
            .map((s) => DropdownMenuItem(value: s, child: Text(s.namaLengkap, style: const TextStyle(fontSize: 13))))
            .toList(),
        onChanged: (v) => setState(() => _selectedSantri = v),
        validator: (v) => v == null ? 'Pilih santri' : null,
      ),
    );
  }

  Widget _buildKategoriChips() {
    return Wrap(
      spacing: 8,
      children: _kategoriList.map((k) {
        final selected = _kategori == k['value'];
        return ChoiceChip(
          label: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(k['icon'] as IconData, size: 14, color: selected ? Colors.white : AppColors.textSecondary),
              const SizedBox(width: 5),
              Text(k['label'] as String),
            ],
          ),
          selected: selected,
          onSelected: (_) => setState(() => _kategori = k['value'] as String),
          selectedColor: AppColors.emerald700,
          labelStyle: TextStyle(
            color: selected ? Colors.white : AppColors.textSecondary,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
          backgroundColor: AppColors.cardBg,
          side: BorderSide(color: selected ? AppColors.emerald700 : AppColors.borderColor),
        );
      }).toList(),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      validator: validator,
      style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
        filled: true,
        fillColor: AppColors.cardBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.emerald600, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
      ),
    );
  }

  Widget _buildDatePicker() {
    return GestureDetector(
      onTap: _pickDate,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _batasKembali != null ? AppColors.emerald600 : AppColors.borderColor,
            width: _batasKembali != null ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.calendar_today_rounded,
              size: 16,
              color: _batasKembali != null ? AppColors.emerald600 : AppColors.textMuted,
            ),
            const SizedBox(width: 10),
            Text(
              _batasKembali != null
                  ? '${_batasKembali!.day}/${_batasKembali!.month}/${_batasKembali!.year} - ${_batasKembali!.hour.toString().padLeft(2, '0')}:${_batasKembali!.minute.toString().padLeft(2, '0')}'
                  : 'Pilih tanggal & waktu kembali',
              style: TextStyle(
                color: _batasKembali != null ? AppColors.textPrimary : AppColors.textMuted,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
