import 'package:flutter/material.dart';

/**
 * ============================================================================
 * MULTI-ROLE ENUMERATION & SESSION MODEL
 * Sesuai persis dengan hak akses Role-Based Access Control (RBAC) pada website
 * ============================================================================
 */

enum AppRole {
  adminRiayah, // Admin Pondok / Biro Administrasi Ri'ayah
  musyrif,     // Pengurus Asrama / Pembina Asrama
  guru,        // Guru / Pembimbing Tahfidz & Akademik
  mudir,       // Pimpinan / Kyai Pondok Pesantren
  santri,      // Santri / Murid
  wali,        // Wali Santri / Orang Tua
  security,    // Petugas Keamanan Gerbang (Smart Gate)
  superAdmin,  // Administrator Sistem & Hardware IoT
}

extension AppRoleExt on AppRole {
  String get id {
    switch (this) {
      case AppRole.adminRiayah: return 'admin_riayah';
      case AppRole.musyrif:     return 'musyrif';
      case AppRole.guru:        return 'guru';
      case AppRole.mudir:       return 'mudir';
      case AppRole.santri:      return 'santri';
      case AppRole.wali:        return 'walisantri';
      case AppRole.security:    return 'satpam';
      case AppRole.superAdmin:  return 'superadmin';
    }
  }

  String get title {
    switch (this) {
      case AppRole.adminRiayah: return 'Admin Pondok';
      case AppRole.musyrif:     return 'Pengurus Asrama';
      case AppRole.guru:        return 'Guru / Pembimbing';
      case AppRole.mudir:       return 'Mudir / Pimpinan';
      case AppRole.santri:      return 'Santri';
      case AppRole.wali:        return 'Wali Santri';
      case AppRole.security:    return 'Petugas Keamanan';
      case AppRole.superAdmin:  return 'Super Admin';
    }
  }

  String get subtitle {
    switch (this) {
      case AppRole.adminRiayah: return 'Master Data Kamar, Santri & Keuangan';
      case AppRole.musyrif:     return 'Monitoring Kamar, Izin & Kedisiplinan';
      case AppRole.guru:        return 'Tahfidz, Evaluasi & Absensi';
      case AppRole.mudir:       return 'Executive Analytics & Kebijakan';
      case AppRole.santri:      return 'Profil, Dompet Pintar & RFID';
      case AppRole.wali:        return 'Pantau Ananda, Dompet & Perizinan';
      case AppRole.security:    return 'Smart Gate & Scan Kartu RFID';
      case AppRole.superAdmin:  return 'Kontrol Penuh Sistem & Konfigurasi';
    }
  }

  IconData get icon {
    switch (this) {
      case AppRole.adminRiayah: return Icons.admin_panel_settings_rounded;
      case AppRole.musyrif:     return Icons.supervisor_account_rounded;
      case AppRole.guru:        return Icons.menu_book_rounded;
      case AppRole.mudir:       return Icons.account_balance_rounded;
      case AppRole.santri:      return Icons.school_rounded;
      case AppRole.wali:        return Icons.family_restroom_rounded;
      case AppRole.security:    return Icons.security_rounded;
      case AppRole.superAdmin:  return Icons.laptop_mac_rounded;
    }
  }

  Color get primaryColor {
    switch (this) {
      case AppRole.adminRiayah: return const Color(0xFF047857); // Emerald 700
      case AppRole.musyrif:     return const Color(0xFF0D9488); // Teal 600
      case AppRole.guru:        return const Color(0xFF2563EB); // Blue 600
      case AppRole.mudir:       return const Color(0xFFD97706); // Amber 600
      case AppRole.santri:      return const Color(0xFF059669); // Emerald 600
      case AppRole.wali:        return const Color(0xFF0891B2); // Cyan 600
      case AppRole.security:    return const Color(0xFFDC2626); // Rose 600
      case AppRole.superAdmin:  return const Color(0xFF4F46E5); // Indigo 600
    }
  }

  bool get isAdminOrStaff =>
      this == AppRole.adminRiayah ||
      this == AppRole.musyrif ||
      this == AppRole.superAdmin ||
      this == AppRole.mudir;
}

class UserSessionModel {
  final String userId;
  final String username;
  final String namaLengkap;
  final String? email;
  final AppRole role;
  final String? santriId; // ID santri terkait jika role Santri atau Wali
  final String? avatarUrl;
  final DateTime loginTime;

  UserSessionModel({
    required this.userId,
    required this.username,
    required this.namaLengkap,
    this.email,
    required this.role,
    this.santriId,
    this.avatarUrl,
    required this.loginTime,
  });

  factory UserSessionModel.fromMap(Map<String, dynamic> map) {
    AppRole parsedRole = AppRole.adminRiayah;
    final rStr = (map['role'] ?? '').toString().toLowerCase();

    for (final r in AppRole.values) {
      if (r.name.toLowerCase() == rStr || r.id.toLowerCase() == rStr) {
        parsedRole = r;
        break;
      }
    }

    return UserSessionModel(
      userId: map['userId']?.toString() ?? 'USR-01',
      username: map['username']?.toString() ?? 'admin',
      namaLengkap: map['namaLengkap']?.toString() ?? 'Pengguna Smart Riayah',
      email: map['email']?.toString(),
      role: parsedRole,
      santriId: map['santriId']?.toString(),
      avatarUrl: map['avatarUrl']?.toString(),
      loginTime: DateTime.tryParse(map['loginTime']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'username': username,
      'namaLengkap': namaLengkap,
      'email': email,
      'role': role.name,
      'santriId': santriId,
      'avatarUrl': avatarUrl,
      'loginTime': loginTime.toIso8601String(),
    };
  }
}

