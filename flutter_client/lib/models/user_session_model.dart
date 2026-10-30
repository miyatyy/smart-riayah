import 'package:flutter/material.dart';

/**
 * ============================================================================
 * MULTI-ROLE ENUMERATION & SESSION MODEL
 * Sesuai persis dengan hak akses Role-Based Access Control (RBAC) pada website
 * ============================================================================
 */

enum AppRole {
  superAdmin,  // Super Admin (Developer)
  adminRiayah, // Admin Ri'ayah
  wali,        // Orang Tua / Wali Santri
  musyrif,     // Musyrif / Musyrifah
  security,    // Pos Satpam (Keamanan)
  poskestren,  // Medis UKS / Poskestren
  mudir,       // Pimpinan Pondok (Mudir / Kyai)
  santri,      // Santri
  guru,        // Guru / Pembimbing
}

extension AppRoleExt on AppRole {
  String get id {
    switch (this) {
      case AppRole.superAdmin:  return 'superadmin';
      case AppRole.adminRiayah: return 'admin_riayah';
      case AppRole.wali:        return 'parent';
      case AppRole.musyrif:     return 'musyrif';
      case AppRole.security:    return 'security';
      case AppRole.poskestren:  return 'poskestren';
      case AppRole.mudir:       return 'kyai';
      case AppRole.santri:      return 'santri';
      case AppRole.guru:        return 'guru';
    }
  }

  String get title {
    switch (this) {
      case AppRole.superAdmin:  return 'Super Admin';
      case AppRole.adminRiayah: return 'Admin Ri\'ayah';
      case AppRole.wali:        return 'Wali Santri';
      case AppRole.musyrif:     return 'Musyrif / Musyrifah';
      case AppRole.security:    return 'Pos Keamanan';
      case AppRole.poskestren:  return 'Medis Poskestren';
      case AppRole.mudir:       return 'Pimpinan Pondok';
      case AppRole.santri:      return 'Santri';
      case AppRole.guru:        return 'Guru / Pembimbing';
    }
  }

  String get subtitle {
    switch (this) {
      case AppRole.superAdmin:  return 'Lead System Architect & IoT Developer';
      case AppRole.adminRiayah: return 'Kepala Biro Asrama & Setting Builder';
      case AppRole.wali:        return 'Portal Orang Tua / Wali Santri';
      case AppRole.musyrif:     return 'Koordinator Musyrif Pengasuhan Santri';
      case AppRole.security:    return 'Kepala Regu Pos Keamanan Gerbang Utama';
      case AppRole.poskestren:  return 'Dokter Penanggung Jawab Poskestren';
      case AppRole.mudir:       return 'Mudir Ma\'had & Pengasuh Pesantren';
      case AppRole.santri:      return 'Portal Santri Asrama & RFID';
      case AppRole.guru:        return 'Halaqah Tahfidz & Akademik';
    }
  }

  IconData get icon {
    switch (this) {
      case AppRole.superAdmin:  return Icons.memory_rounded;
      case AppRole.adminRiayah: return Icons.build_circle_rounded;
      case AppRole.wali:        return Icons.family_restroom_rounded;
      case AppRole.musyrif:     return Icons.verified_user_rounded;
      case AppRole.security:    return Icons.cell_tower_rounded;
      case AppRole.poskestren:  return Icons.medical_services_rounded;
      case AppRole.mudir:       return Icons.account_balance_rounded;
      case AppRole.santri:      return Icons.school_rounded;
      case AppRole.guru:        return Icons.menu_book_rounded;
    }
  }

  Color get primaryColor {
    switch (this) {
      case AppRole.superAdmin:  return const Color(0xFF4F46E5); // Indigo 600
      case AppRole.adminRiayah: return const Color(0xFF047857); // Emerald 700
      case AppRole.wali:        return const Color(0xFF0891B2); // Cyan 600
      case AppRole.musyrif:     return const Color(0xFF0D9488); // Teal 600
      case AppRole.security:    return const Color(0xFFE11D48); // Rose 600
      case AppRole.poskestren:  return const Color(0xFF0284C7); // Sky 600
      case AppRole.mudir:       return const Color(0xFFD97706); // Amber 600
      case AppRole.santri:      return const Color(0xFF059669); // Emerald 600
      case AppRole.guru:        return const Color(0xFF2563EB); // Blue 600
    }
  }

  bool get isAdminOrStaff =>
      this == AppRole.superAdmin ||
      this == AppRole.adminRiayah ||
      this == AppRole.musyrif ||
      this == AppRole.mudir ||
      this == AppRole.poskestren;
}

class DemoAccountModel {
  final String id;
  final String roleKey;
  final String roleName;
  final String email;
  final String password;
  final String nama;
  final String jabatan;
  final String badge;
  final String description;
  final AppRole appRole;
  final IconData icon;

  const DemoAccountModel({
    required this.id,
    required this.roleKey,
    required this.roleName,
    required this.email,
    required this.password,
    required this.nama,
    required this.jabatan,
    required this.badge,
    required this.description,
    required this.appRole,
    required this.icon,
  });
}

class DemoAccountsData {
  static const List<DemoAccountModel> accounts = [
    DemoAccountModel(
      id: "ACC-01",
      roleKey: "superadmin",
      roleName: "Super Admin (Developer)",
      email: "superadmin@gmail.com",
      password: "superadmin01",
      nama: "Ust. Eng. Al-Fatih, M.T.",
      jabatan: "Lead System Architect & IoT Developer",
      badge: "Developer Console",
      description: "Hak akses penuh bypass, diagnostik hardware ESP32-S3 & manajemen database.",
      appRole: AppRole.superAdmin,
      icon: Icons.memory_rounded,
    ),
    DemoAccountModel(
      id: "ACC-02",
      roleKey: "admin_riayah",
      roleName: "Admin Ri'ayah",
      email: "adminriayah@gmail.com",
      password: "riayah01",
      nama: "Ust. Drs. H. Mustofa",
      jabatan: "Kepala Biro Asrama & Setting Builder",
      badge: "Setting Builder",
      description: "Tata kelola kapasitas kamar asrama, pendaftaran santri baru & penggantian kartu RFID.",
      appRole: AppRole.adminRiayah,
      icon: Icons.build_circle_rounded,
    ),
    DemoAccountModel(
      id: "ACC-03",
      roleKey: "parent",
      roleName: "Orang Tua / Wali Santri",
      email: "walisantri@gmail.com",
      password: "walisantri01",
      nama: "Ibu Fatimah Az-Zahra",
      jabatan: "Wali Santri dari Ahmad Fauzi (Kls 10-A)",
      badge: "Portal Wali Santri",
      description: "Pengajuan izin digital santri, pantau mutaba'ah ibadah & saldo transaksi cashless.",
      appRole: AppRole.wali,
      icon: Icons.family_restroom_rounded,
    ),
    DemoAccountModel(
      id: "ACC-04",
      roleKey: "musyrif",
      roleName: "Musyrif / Musyrifah",
      email: "Musyrif@gmail.com",
      password: "musyrif01",
      nama: "Ust. M. Syukron, M.Pd.",
      jabatan: "Koordinator Musyrif Pengasuhan Santri",
      badge: "Otorisasi Izin",
      description: "Verifikasi dan persetujuan surat izin santri serta catatan poin kedisiplinan Ri'ayah.",
      appRole: AppRole.musyrif,
      icon: Icons.verified_user_rounded,
    ),
    DemoAccountModel(
      id: "ACC-05",
      roleKey: "security",
      roleName: "Pos Satpam (Keamanan)",
      email: "satpam@gmail.com",
      password: "satpam01",
      nama: "Komandan Sutrisno",
      jabatan: "Kepala Regu Pos Keamanan Gerbang Utama",
      badge: "Command Center Gate",
      description: "Monitoring IoT Turnstile Gate, verifikasi tap RFID RC522 & anti-bypass lock.",
      appRole: AppRole.security,
      icon: Icons.cell_tower_rounded,
    ),
    DemoAccountModel(
      id: "ACC-06",
      roleKey: "poskestren",
      roleName: "Medis UKS / Poskestren",
      email: "poskestren@gmail.com",
      password: "poskestren01",
      nama: "dr. Nurul Aini",
      jabatan: "Dokter Penanggung Jawab Poskestren",
      badge: "Rekam Medis & UKS",
      description: "Pemeriksaan kesehatan, rekam medis santri, obat asrama & rujukan rumah sakit.",
      appRole: AppRole.poskestren,
      icon: Icons.medical_services_rounded,
    ),
    DemoAccountModel(
      id: "ACC-07",
      roleKey: "kyai",
      roleName: "Pimpinan Pondok (Mudir)",
      email: "mudir@gmail.com",
      password: "mudir01",
      nama: "K.H. Ahmad Dahlan, Lc., M.A.",
      jabatan: "Mudir Ma'had & Pengasuh Pesantren",
      badge: "Executive Analytics",
      description: "Pengambilan keputusan strategis, analisis tren perizinan, dan rapor kepribadian.",
      appRole: AppRole.mudir,
      icon: Icons.account_balance_rounded,
    ),
  ];
}

class UserSessionModel {
  final String userId;
  final String username;
  final String namaLengkap;
  final String? email;
  final AppRole role;
  final String? santriId; // ID santri terkait jika role Santri atau Wali
  final String? avatarUrl;
  final String? jabatan;
  final DateTime loginTime;

  UserSessionModel({
    required this.userId,
    required this.username,
    required this.namaLengkap,
    this.email,
    required this.role,
    this.santriId,
    this.avatarUrl,
    this.jabatan,
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
      jabatan: map['jabatan']?.toString(),
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
      'jabatan': jabatan,
      'loginTime': loginTime.toIso8601String(),
    };
  }
}
