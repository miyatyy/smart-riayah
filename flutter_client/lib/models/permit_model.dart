import 'package:flutter/material.dart';

/**
 * ============================================================================
 * Model Data Surat Izin Santri (Permits)
 * 100% Sesuai Skema Tabel PostgreSQL Supabase: 'public.permits'
 * Kolom:
 * - id
 * - permit_code
 * - santri_id
 * - santri_name
 * - room_name
 * - reason
 * - pickup_by
 * - start_date
 * - return_date
 * - status (PENDING, APPROVED, REJECTED, DI_LUAR, COMPLETED, EXTEND_REQUESTED)
 * - is_extension
 * - extension_reason
 * - requested_return_date
 * - created_at
 * - updated_at
 * ============================================================================
 */
class PermitModel {
  final String id;
  final String permitCode;
  final String santriId;
  final String santriName;
  final String roomName;
  final String reason;
  final String pickupBy;
  final DateTime? startDate;
  final DateTime? returnDate;
  final String status;
  final bool isExtension;
  final String? extensionReason;
  final DateTime? requestedReturnDate;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  PermitModel({
    required this.id,
    required this.permitCode,
    required this.santriId,
    required this.santriName,
    this.roomName = '',
    required this.reason,
    this.pickupBy = 'Wali Santri Mandiri',
    this.startDate,
    this.returnDate,
    required this.status,
    this.isExtension = false,
    this.extensionReason,
    this.requestedReturnDate,
    this.createdAt,
    this.updatedAt,
  });

  // Getter pembantu untuk kompatibilitas tampilan UI
  String get santriNama => santriName;
  String get tokenIzin => permitCode;
  String get keperluan => reason;
  String get penjemput => pickupBy;
  DateTime? get batasKembali => returnDate;
  DateTime? get perpanjanganSampai => requestedReturnDate;
  String? get alasanPerpanjangan => extensionReason;
  String get kategori => reason.contains('Pulang')
      ? 'Pulang Bermalam'
      : reason.contains('Berobat') || reason.contains('Sakit')
          ? 'Izin Berobat'
          : 'Pesiar';

  bool get isApproved => status.toUpperCase() == 'APPROVED';
  bool get isActive => status.toUpperCase() == 'ACTIVE' || status.toUpperCase() == 'DI_LUAR';
  bool get isOverdue => status.toUpperCase() == 'OVERDUE';
  bool get isPending => status.toUpperCase() == 'PENDING';
  bool get isExtendRequested => status.toUpperCase() == 'EXTEND_REQUESTED' || isExtension;
  bool get hasPendingExtension => isExtendRequested;
  bool get isExtensionApproved => !isExtension && (extensionReason?.contains('Disetujui') == true || (status.toUpperCase() == 'APPROVED' && requestedReturnDate != null));
  bool get isExtensionRejected => extensionReason?.startsWith('Ditolak') == true;

  Color get statusColor {
    switch (status.toUpperCase()) {
      case 'APPROVED':
      case 'ACTIVE':
      case 'DI_LUAR':
        return const Color(0xFF047857);
      case 'PENDING':
        return const Color(0xFFD97706);
      case 'EXTEND_REQUESTED':
        return const Color(0xFFB45309);
      case 'OVERDUE':
      case 'REJECTED':
        return const Color(0xFFDC2626);
      case 'COMPLETED':
        return const Color(0xFF2563EB);
      default:
        return const Color(0xFF64748B);
    }
  }

  String get statusLabel {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return 'Disetujui';
      case 'ACTIVE':
      case 'DI_LUAR':
        return 'Di Luar Asrama';
      case 'PENDING':
        return 'Menunggu Persetujuan';
      case 'EXTEND_REQUESTED':
        return 'Permohonan Perpanjangan';
      case 'OVERDUE':
        return 'Terlambat Kembali';
      case 'REJECTED':
        return 'Ditolak';
      case 'COMPLETED':
        return 'Selesai Kembali';
      default:
        return status;
    }
  }

  factory PermitModel.fromMap(Map<String, dynamic> map) {
    DateTime? parseDt(dynamic val) {
      if (val == null) return null;
      return DateTime.tryParse(val.toString());
    }

    final id = map['id']?.toString() ?? '';
    final code = map['permit_code']?.toString() ?? map['token_izin']?.toString() ?? 'DU-PERMIT-${id.replaceAll(RegExp(r'[^0-9]'), '')}';
    final sId = map['santri_id']?.toString() ?? '';
    final sName = map['santri_name']?.toString() ?? map['santri_nama']?.toString() ?? 'Santri';
    final rName = map['room_name']?.toString() ?? map['kamar']?.toString() ?? '';
    final reas = map['reason']?.toString() ?? map['keperluan']?.toString() ?? 'Izin Keluar';
    final pick = map['pickup_by']?.toString() ?? map['penjemput']?.toString() ?? 'Wali Santri Mandiri';

    final start = parseDt(map['start_date'] ?? map['waktu_keluar_rencana']);
    final ret = parseDt(map['return_date'] ?? map['batas_kembali']);
    final reqRet = parseDt(map['requested_return_date'] ?? map['perpanjangan_sampai']);

    final stat = map['status']?.toString() ?? 'PENDING';
    final isExt = map['is_extension'] == true || stat.toUpperCase() == 'EXTEND_REQUESTED';
    final extReason = map['extension_reason']?.toString() ?? map['alasan_perpanjangan']?.toString();

    return PermitModel(
      id: id,
      permitCode: code,
      santriId: sId,
      santriName: sName,
      roomName: rName,
      reason: reas,
      pickupBy: pick,
      startDate: start,
      returnDate: ret,
      status: stat,
      isExtension: isExt,
      extensionReason: extReason,
      requestedReturnDate: reqRet,
      createdAt: parseDt(map['created_at']),
      updatedAt: parseDt(map['updated_at']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'permit_code': permitCode,
      'santri_id': santriId,
      'santri_name': santriName,
      'room_name': roomName,
      'reason': reason,
      'pickup_by': pickupBy,
      'start_date': startDate?.toIso8601String(),
      'return_date': returnDate?.toIso8601String(),
      'status': status,
      'is_extension': isExtension,
      'extension_reason': extensionReason,
      'requested_return_date': requestedReturnDate?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }
}
