/**
 * Model Data Kamar Asrama (Rooms)
 * Kolom tabel Supabase: 'rooms'
 */
class RoomModel {
  final String id;
  final String namaGedung;
  final String kategoriGedung; // 'PUTRA' atau 'PUTRI'
  final String nomorKamar;
  final int lantai;
  final int kapasitas;
  final int terisi;
  final String ketuaKamar;
  final int skorKerapianTerakhir;
  final String catatanInspeksi;

  RoomModel({
    required this.id,
    required this.namaGedung,
    required this.kategoriGedung,
    required this.nomorKamar,
    this.lantai = 1,
    this.kapasitas = 8,
    this.terisi = 0,
    this.ketuaKamar = '-',
    this.skorKerapianTerakhir = 90,
    this.catatanInspeksi = 'Kamar rapi dan siap huni.',
  });

  bool get isPutri => kategoriGedung.toUpperCase() == 'PUTRI';
  bool get isFull => terisi >= kapasitas;
  int get sisaKasur => (kapasitas - terisi) > 0 ? (kapasitas - terisi) : 0;
  int get kasurTersisa => sisaKasur;
  double get persentaseTerisi => kapasitas > 0 ? (terisi / kapasitas).clamp(0.0, 1.0) : 0.0;

  factory RoomModel.fromMap(Map<String, dynamic> map) {
    return RoomModel(
      id: map['id']?.toString() ?? '',
      namaGedung: map['nama_gedung']?.toString() ?? 'Asrama Santri',
      kategoriGedung: map['kategori_gedung']?.toString() ?? 'PUTRA',
      nomorKamar: map['nomor_kamar']?.toString() ?? 'Kamar 101',
      lantai: int.tryParse(map['lantai']?.toString() ?? '1') ?? 1,
      kapasitas: int.tryParse(map['kapasitas']?.toString() ?? '8') ?? 8,
      terisi: int.tryParse(map['terisi']?.toString() ?? '0') ?? 0,
      ketuaKamar: map['ketua_kamar']?.toString() ?? '-',
      skorKerapianTerakhir: int.tryParse(map['skor_kerapian_terakhir']?.toString() ?? '90') ?? 90,
      catatanInspeksi: map['catatan_inspeksi']?.toString() ?? 'Kamar siap huni.',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'nama_gedung': namaGedung,
      'kategori_gedung': kategoriGedung,
      'nomor_kamar': nomorKamar,
      'lantai': lantai,
      'kapasitas': kapasitas,
      'terisi': terisi,
      'ketua_kamar': ketuaKamar,
      'skor_kerapian_terakhir': skorKerapianTerakhir,
      'catatan_inspeksi': catatanInspeksi,
    };
  }
}

