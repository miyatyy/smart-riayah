import 'package:intl/intl.dart';

/**
 * Model Data Santri
 * Kolom tabel Supabase: 'santri'
 */
class SantriModel {
  final String id;
  final String nis;
  final String namaLengkap;
  final String gender; // 'L' (Putra) atau 'P' (Putri)
  final String kelas;
  final String? kamarId;
  final String kamar;
  final String statusAsrama; // 'DI_ASRAMA', 'DI_LUAR', 'TERLAMBAT', 'SAKIT'
  final int poinDisiplin;
  final String? rfidUid;
  final String? namaWali;
  final String? noWali;
  final int saldoRfid;
  final int saldoAwal;
  final String? fotoUrl;

  SantriModel({
    required this.id,
    required this.nis,
    required this.namaLengkap,
    required this.gender,
    required this.kelas,
    this.kamarId,
    required this.kamar,
    required this.statusAsrama,
    required this.poinDisiplin,
    this.rfidUid,
    this.namaWali,
    this.noWali,
    this.saldoRfid = 0,
    this.saldoAwal = 0,
    this.fotoUrl,
  });

  factory SantriModel.fromJson(Map<String, dynamic> json) {
    return SantriModel(
      id: json['id']?.toString() ?? '',
      nis: json['nis']?.toString() ?? '-',
      namaLengkap: json['nama_lengkap']?.toString() ?? json['nama']?.toString() ?? 'Santri',
      gender: json['gender']?.toString() ?? 'L',
      kelas: json['kelas']?.toString() ?? '10-A',
      kamarId: json['kamar_id']?.toString(),
      kamar: json['kamar']?.toString() ?? 'Kamar Santri',
      statusAsrama: json['status_asrama']?.toString() ?? 'DI_ASRAMA',
      poinDisiplin: int.tryParse(json['poin_disiplin']?.toString() ?? '100') ?? 100,
      rfidUid: json['rfid_uid']?.toString(),
      namaWali: json['nama_wali']?.toString(),
      noWali: json['no_wali']?.toString(),
      saldoRfid: (double.tryParse(json['saldo_rfid']?.toString() ?? '0') ?? 0).round(),
      saldoAwal: (double.tryParse(json['saldo_awal']?.toString() ?? '0') ?? 0).round(),
      fotoUrl: json['foto_url']?.toString() ?? json['foto']?.toString(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'nis': nis,
      'nama_lengkap': namaLengkap,
      'gender': gender,
      'kelas': kelas,
      'kamar_id': kamarId,
      'kamar': kamar,
      'status_asrama': statusAsrama,
      'poin_disiplin': poinDisiplin,
      'rfid_uid': rfidUid,
      'nama_wali': namaWali,
      'no_wali': noWali,
      'saldo_rfid': saldoRfid,
      'saldo_awal': saldoAwal,
      'foto_url': fotoUrl,
    };
  }

  String get initials {
    final parts = namaLengkap.trim().split(' ');
    if (parts.length >= 2 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return namaLengkap.isNotEmpty ? namaLengkap[0].toUpperCase() : 'S';
  }

  bool get isPresent => statusAsrama == 'DI_ASRAMA';
  bool get isIzin => statusAsrama == 'IZIN' || statusAsrama == 'DI_LUAR';
  bool get isMissing => statusAsrama == 'TERLAMBAT' || statusAsrama == 'TIDAK_HADIR';
  bool get isAkhwat => gender.toUpperCase() == 'P';
  bool get isIkhwan => gender.toUpperCase() == 'L';

  String get defaultAvatar => isAkhwat 
      ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80'
      : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80';

  String get statusLabel {
    switch (statusAsrama) {
      case 'DI_ASRAMA':  return 'Di Asrama';
      case 'DI_LUAR':    return 'Di Luar (Izin)';
      case 'IZIN':       return 'Di Luar (Izin)';
      case 'TERLAMBAT':  return 'Overdue / Terlambat';
      case 'SAKIT':      return 'Istirahat di Klinik';
      default:           return statusAsrama;
    }
  }

  String get saldoFormatted {
    final fmt = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);
    return fmt.format(saldoRfid);
  }

  String get poinLabel => '$poinDisiplin / 100';
}
