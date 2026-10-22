class SantriModel {
  final String id;
  final String nis;
  final String namaLengkap;
  final String gender;
  final String kelas;
  final String kamar;
  final String statusAsrama;
  final int poinDisiplin;
  final String? rfidUid;
  final String? namaWali;
  final String? noWali;
  final int? saldoRfid;

  SantriModel({
    required this.id,
    required this.nis,
    required this.namaLengkap,
    required this.gender,
    required this.kelas,
    required this.kamar,
    required this.statusAsrama,
    required this.poinDisiplin,
    this.rfidUid,
    this.namaWali,
    this.noWali,
    this.saldoRfid,
  });

  factory SantriModel.fromJson(Map<String, dynamic> json) {
    return SantriModel(
      id: json['id']?.toString() ?? '',
      nis: json['nis']?.toString() ?? '-',
      namaLengkap: json['nama_lengkap']?.toString() ?? 'Santri',
      gender: json['gender']?.toString() ?? 'L',
      kelas: json['kelas']?.toString() ?? '-',
      kamar: json['kamar']?.toString() ?? '-',
      statusAsrama: json['status_asrama']?.toString() ?? 'DI_ASRAMA',
      poinDisiplin: int.tryParse(json['poin_disiplin']?.toString() ?? '100') ?? 100,
      rfidUid: json['rfid_uid']?.toString(),
      namaWali: json['nama_wali']?.toString(),
      noWali: json['no_wali']?.toString(),
      saldoRfid: int.tryParse(json['saldo_rfid']?.toString() ?? '0') ?? 0,
    );
  }

  String get initials {
    final parts = namaLengkap.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return namaLengkap.isNotEmpty ? namaLengkap[0].toUpperCase() : 'S';
  }

  bool get isPresent => statusAsrama == 'DI_ASRAMA';
  bool get isIzin => statusAsrama == 'IZIN';
  bool get isMissing => statusAsrama == 'TIDAK_HADIR';

  String get statusLabel {
    switch (statusAsrama) {
      case 'DI_ASRAMA': return 'Di Asrama';
      case 'IZIN': return 'Izin Keluar';
      case 'TIDAK_HADIR': return 'Tidak Hadir';
      default: return statusAsrama;
    }
  }

  String get poinLabel => '$poinDisiplin / 100';
  String get saldoFormatted {
    final s = saldoRfid ?? 0;
    return 'Rp ${s.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}';
  }
}
