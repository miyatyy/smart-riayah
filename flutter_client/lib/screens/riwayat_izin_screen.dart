import 'package:flutter/material.dart';

class PermitRecord {
  final String id;
  final String santriName;
  final String nis;
  final String kategori;
  final String keperluan;
  final String waktuKeluar;
  final String batasKembali;
  final String status; // 'DISETUJUI', 'PENDING', 'SELESAI', 'DI_LUAR'
  final String penjemput;
  final String qrCode;

  const PermitRecord({
    required this.id,
    required this.santriName,
    required this.nis,
    required this.kategori,
    required this.keperluan,
    required this.waktuKeluar,
    required this.batasKembali,
    required this.status,
    required this.penjemput,
    required this.qrCode,
  });
}

class RiwayatIzinScreen extends StatefulWidget {
  final String? filterSantriName;

  const RiwayatIzinScreen({super.key, this.filterSantriName});

  @override
  State<RiwayatIzinScreen> createState() => _RiwayatIzinScreenState();
}

class _RiwayatIzinScreenState extends State<RiwayatIzinScreen> {
  int _activeFilterIdx = 0;
  final List<String> _filters = ['Semua', 'Disetujui', 'Menunggu', 'Sedang Keluar', 'Selesai'];

  final List<PermitRecord> _allPermits = const [
    PermitRecord(
      id: 'IZN-2026-089',
      santriName: 'Nurmiyaty',
      nis: '125460',
      kategori: 'Pulang Bermalam',
      keperluan: 'Acara tasyakuran keluarga & kontrol kesehatan',
      waktuKeluar: 'Jum\'at, 24 Okt 2026 • 16:30 WIB',
      batasKembali: 'Ahad, 26 Okt 2026 • 17:00 WIB',
      status: 'DISETUJUI',
      penjemput: 'Hj. Mardiah (Ibu Kandung)',
      qrCode: 'GATE-01-SR-NURMIYATY-73E24F9A',
    ),
    PermitRecord(
      id: 'IZN-2026-085',
      santriName: 'Nurmiyaty',
      nis: '125460',
      kategori: 'Pesiar Harian',
      keperluan: 'Beli kitab kuning & perlengkapan sekolah di Gramedia',
      waktuKeluar: 'Ahad, 19 Okt 2026 • 09:00 WIB',
      batasKembali: 'Ahad, 19 Okt 2026 • 16:30 WIB',
      status: 'SELESAI',
      penjemput: 'Hj. Mardiah (Ibu Kandung)',
      qrCode: 'GATE-01-SR-NURMIYATY-EXP-085',
    ),
    PermitRecord(
      id: 'IZN-2026-088',
      santriName: 'Rayhan Dwi Prasetyo',
      nis: '125458',
      kategori: 'Berobat Luar',
      keperluan: 'Pemeriksaan gigi di Klinik Utama Medika',
      waktuKeluar: 'Kamis, 23 Okt 2026 • 14:00 WIB',
      batasKembali: 'Kamis, 23 Okt 2026 • 18:00 WIB',
      status: 'DI_LUAR',
      penjemput: 'Drs. Subroto (Ayah)',
      qrCode: 'GATE-01-SR-RAYHAN-6498C12A',
    ),
    PermitRecord(
      id: 'IZN-2026-087',
      santriName: 'Muhammad Fatih Robbani',
      nis: '125456',
      kategori: 'Pesiar Harian',
      keperluan: 'Mengikuti Lomba Pidato Bahasa Arab Antar Pesantren',
      waktuKeluar: 'Sabtu, 25 Okt 2026 • 07:30 WIB',
      batasKembali: 'Sabtu, 25 Okt 2026 • 17:30 WIB',
      status: 'PENDING',
      penjemput: 'Ustadz Pembina Ekstrakurikuler',
      qrCode: 'GATE-01-SR-FATIH-04A12B9C',
    ),
    PermitRecord(
      id: 'IZN-2026-084',
      santriName: 'Aisyah Putri Azzahra',
      nis: '125457',
      kategori: 'Pulang Bermalam',
      keperluan: 'Pernikahan saudara kandung di Solo',
      waktuKeluar: 'Jum\'at, 17 Okt 2026 • 16:00 WIB',
      batasKembali: 'Ahad, 19 Okt 2026 • 17:00 WIB',
      status: 'SELESAI',
      penjemput: 'Hj. Nuraini (Wali Santri)',
      qrCode: 'GATE-01-SR-AISYAH-536789EF',
    ),
  ];

  List<PermitRecord> get _filteredList {
    return _allPermits.where((p) {
      if (widget.filterSantriName != null &&
          !p.santriName.toLowerCase().contains(widget.filterSantriName!.toLowerCase())) {
        return false;
      }
      if (_activeFilterIdx == 1) return p.status == 'DISETUJUI';
      if (_activeFilterIdx == 2) return p.status == 'PENDING';
      if (_activeFilterIdx == 3) return p.status == 'DI_LUAR';
      if (_activeFilterIdx == 4) return p.status == 'SELESAI';
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF059669),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Riwayat Surat Izin',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
            ),
            Text(
              widget.filterSantriName != null
                  ? 'Santri: ${widget.filterSantriName}'
                  : 'Seluruh Ekosistem Santri Darul Ulum',
              style: const TextStyle(color: Color(0xFFD1FAE5), fontSize: 11),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Filter Row
          Container(
            height: 52,
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _filters.length,
              itemBuilder: (ctx, idx) {
                final isSelected = _activeFilterIdx == idx;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    onTap: () => setState(() => _activeFilterIdx = idx),
                    borderRadius: BorderRadius.circular(16),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF059669) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF059669) : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Center(
                        child: Text(
                          _filters[idx],
                          style: TextStyle(
                            color: isSelected ? Colors.white : const Color(0xFF475569),
                            fontSize: 11.5,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          // List Permintaan Izin
          Expanded(
            child: _filteredList.isEmpty
                ? const Center(
                    child: Text('Tidak ada riwayat izin untuk filter ini',
                        style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _filteredList.length,
                    itemBuilder: (ctx, idx) {
                      final p = _filteredList[idx];
                      return _buildPermitCard(p);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildPermitCard(PermitRecord p) {
    Color badgeColor;
    Color badgeBg;
    String badgeLabel;
    IconData badgeIcon;

    switch (p.status) {
      case 'DISETUJUI':
        badgeColor = const Color(0xFF059669);
        badgeBg = const Color(0xFFECFDF5);
        badgeLabel = 'DISETUJUI (SIAP TAP)';
        badgeIcon = Icons.check_circle_outline;
        break;
      case 'PENDING':
        badgeColor = const Color(0xFFD97706);
        badgeBg = const Color(0xFFFFFBEB);
        badgeLabel = 'MENUNGGU VERIFIKASI';
        badgeIcon = Icons.access_time;
        break;
      case 'DI_LUAR':
        badgeColor = const Color(0xFF0284C7);
        badgeBg = const Color(0xFFF0F9FF);
        badgeLabel = 'SEDANG DI LUAR';
        badgeIcon = Icons.logout;
        break;
      default:
        badgeColor = const Color(0xFF64748B);
        badgeBg = const Color(0xFFF1F5F9);
        badgeLabel = 'SELESAI (SUDAH KEMBALI)';
        badgeIcon = Icons.task_alt;
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
              Text(
                p.id,
                style: const TextStyle(
                  color: Color(0xFF64748B),
                  fontSize: 10.5,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(badgeIcon, size: 12, color: badgeColor),
                    const SizedBox(width: 4),
                    Text(
                      badgeLabel,
                      style: TextStyle(color: badgeColor, fontSize: 9.5, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              CircleAvatar(
                radius: 15,
                backgroundColor: const Color(0xFFECFDF5),
                child: Text(
                  p.santriName[0],
                  style: const TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.w800, fontSize: 13),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.santriName,
                      style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                    Text(
                      'NIS: ${p.nis} • ${p.kategori}',
                      style: const TextStyle(color: Color(0xFF059669), fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            p.keperluan,
            style: const TextStyle(color: Color(0xFF334155), fontSize: 12, height: 1.3),
          ),
          const Divider(color: Color(0xFFE2E8F0), height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Batas Waktu Kembali:', style: TextStyle(color: Color(0xFF64748B), fontSize: 9.5)),
                  Text(
                    p.batasKembali,
                    style: const TextStyle(color: Color(0xFFB45309), fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: () => _showDigitalPassModal(p),
                icon: const Icon(Icons.qr_code, size: 14),
                label: const Text('QR Gate'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF059669),
                  side: const BorderSide(color: Color(0xFF059669)),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showDigitalPassModal(PermitRecord p) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: const Icon(Icons.qr_code_2, size: 90, color: Color(0xFF059669)),
            ),
            const SizedBox(height: 14),
            Text(p.santriName,
                style: const TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.w800)),
            Text('${p.kategori} • ${p.id}',
                style: const TextStyle(color: Color(0xFF059669), fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Text(
                p.qrCode,
                style: const TextStyle(
                    color: Color(0xFF475569), fontSize: 9.5, fontFamily: 'monospace', fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Tunjukkan QR ini atau Tap Kartu RFID Santri di Reader Gerbang Gate 01',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Tutup Pass Gerbang'),
          ),
        ],
      ),
    );
  }
}
