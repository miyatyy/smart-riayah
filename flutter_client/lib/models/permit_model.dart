import 'package:flutter/material.dart';

/**
 * Model Data Surat Izin Santri (Permits)
 * Kolom tabel Supabase: 'permits'
 */
class PermitModel {
  final String id;
  final String santriId;
  final String santriNama;
  final String kategori; // 'Pesiar', 'Pulang Bermalam', 'Lomba', 'Sakit'
  final String keperluan;
  final String penjemput;
  final DateTime? batasKembali;
  final String status; // 'PENDING', 'APPROVED', 'ACTIVE', 'OVERDUE', 'REJECTED', 'COMPLETED'
  final String tokenIzin;

  PermitModel({
    required this.id,
    required this.santriId,
    required this.santriNama,
    required this.kategori,
    required this.keperluan,
    this.penjemput = 'Wali Santri Mandiri',
    this.batasKembali,
    required this.status,
    required this.tokenIzin,
  });

  bool get isApproved => status == 'APPROVED';
  bool get isActive => status == 'ACTIVE';
  bool get isOverdue => status == 'OVERDUE';
  bool get isPending => status == 'PENDING';

  Color get statusColor {
    switch (status.toUpperCase()) {
      case 'APPROVED':
      case 'ACTIVE':
        return const Color(0xFF047857);
      case 'PENDING':
        return const Color(0xFFD97706);
      case 'OVERDUE':
      case 'REJECTED':
        return const Color(0xFFDC2626);
      default:
        return const Color(0xFF64748B);
    }
  }

  String get statusLabel {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return 'Disetujui';
      case 'ACTIVE':
        return 'Aktif Berjalan';
      case 'PENDING':
        return 'Menunggu Persetujuan';
      case 'OVERDUE':
        return 'Terlambat Kembali';
      case 'REJECTED':
        return 'Ditolak';
      case 'COMPLETED':
        return 'Selesai';
      default:
        return status;
    }
  }

  factory PermitModel.fromMap(Map<String, dynamic> map) {
    DateTime? batas;
    if (map['batas_kembali'] != null) {
      batas = DateTime.tryParse(map['batas_kembali'].toString());
    }

    return PermitModel(
      id: map['id']?.toString() ?? '',
      santriId: map['santri_id']?.toString() ?? '',
      santriNama: map['santri_nama']?.toString() ?? 'Santri',
      kategori: map['kategori']?.toString() ?? 'Pesiar',
      keperluan: map['keperluan']?.toString() ?? '-',
      penjemput: map['penjemput']?.toString() ?? 'Wali Santri Mandiri',
      batasKembali: batas,
      status: map['status']?.toString() ?? 'PENDING',
      tokenIzin: map['token_izin']?.toString() ?? 'TOKEN-${map['id']}',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'santri_id': santriId,
      'santri_nama': santriNama,
      'kategori': kategori,
      'keperluan': keperluan,
      'penjemput': penjemput,
      'batas_kembali': batasKembali?.toIso8601String(),
      'status': status,
      'token_izin': tokenIzin,
    };
  }
}

