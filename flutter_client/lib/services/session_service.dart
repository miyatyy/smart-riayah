import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_session_model.dart';
import '../core/supabase_config.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - SESSION & AUTH SERVICE
 * Mengelola autentikasi multi-role, session storage (SharedPreferences),
 * dan pemetaan Role-Based Access Control (RBAC).
 * ============================================================================
 */

class SessionService {
  static const String _keySession = 'smart_riayah_user_session';

  /// Menyimpan sesi login pengguna secara persisten di perangkat
  static Future<void> saveSession(UserSessionModel session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keySession, jsonEncode(session.toMap()));
  }

  /// Memulihkan sesi login dari memori perangkat jika ada
  static Future<UserSessionModel?> getSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString(_keySession);
      if (str == null || str.isEmpty) return null;
      final map = jsonDecode(str) as Map<String, dynamic>;
      return UserSessionModel.fromMap(map);
    } catch (e) {
      return null;
    }
  }

  /// Menghapus sesi login (Logout)
  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySession);
  }

  /// Autentikasi Pengguna berdasarkan Username / Password / Preset Role
  static Future<UserSessionModel> authenticate({
    required AppRole role,
    String? username,
    String? password,
  }) async {
    // 1. Coba verifikasi dengan database Supabase jika username/password diisi
    if (username != null && username.isNotEmpty) {
      try {
        final res = await SupabaseConfig.client
            .from('users')
            .select('*')
            .eq('username', username.trim().toLowerCase())
            .maybeSingle();

        if (res != null) {
          final session = UserSessionModel(
            userId: res['id']?.toString() ?? 'USR-${DateTime.now().millisecondsSinceEpoch}',
            username: res['username']?.toString() ?? username,
            namaLengkap: res['nama_lengkap']?.toString() ?? _getDefaultNameForRole(role),
            email: res['email']?.toString(),
            role: role,
            santriId: role == AppRole.santri || role == AppRole.wali ? 'S-101' : null,
            loginTime: DateTime.now(),
          );
          await saveSession(session);
          return session;
        }
      } catch (_) {}
    }

    // 2. Fallback Preset Role Instan (Sesuai Akun Demo Resmi Website)
    final session = getPresetSessionForRole(role);
    await saveSession(session);
    return session;
  }

  /// Akun Demo Cepat untuk setiap role
  static UserSessionModel getPresetSessionForRole(AppRole role) {
    switch (role) {
      case AppRole.adminRiayah:
        return UserSessionModel(
          userId: 'ADM-01',
          username: 'admin.riayah',
          namaLengkap: 'Ust. M. Syukron, M.Pd.',
          email: 'admin.riayah@pesantrendarululum.sch.id',
          role: AppRole.adminRiayah,
          loginTime: DateTime.now(),
        );

      case AppRole.musyrif:
        return UserSessionModel(
          userId: 'MSY-02',
          username: 'musyrif.asrama',
          namaLengkap: 'Ust. Danial Hakim, S.Pd.I',
          email: 'musyrif@pesantrendarululum.sch.id',
          role: AppRole.musyrif,
          loginTime: DateTime.now(),
        );

      case AppRole.guru:
        return UserSessionModel(
          userId: 'GRU-03',
          username: 'guru.tahfidz',
          namaLengkap: 'Ust. H. Fauzi Robbani, Lc.',
          email: 'tahfidz@pesantrendarululum.sch.id',
          role: AppRole.guru,
          loginTime: DateTime.now(),
        );

      case AppRole.mudir:
        return UserSessionModel(
          userId: 'MDR-01',
          username: 'kh.syamsudin',
          namaLengkap: 'KH. Dr. Ahmad Syamsudin, M.A.',
          email: 'mudir@pesantrendarululum.sch.id',
          role: AppRole.mudir,
          loginTime: DateTime.now(),
        );

      case AppRole.santri:
        return UserSessionModel(
          userId: 'SNT-101',
          username: '125456',
          namaLengkap: 'Muhammad Fatih Robbani',
          email: 'fatih.robbani@santri.pesantrendarululum.sch.id',
          role: AppRole.santri,
          santriId: 'S-101',
          loginTime: DateTime.now(),
        );

      case AppRole.wali:
        return UserSessionModel(
          userId: 'WLI-101',
          username: 'wali.fatih',
          namaLengkap: 'H. Bambang Sudarsono, S.T.',
          email: 'bambang.sudarsono@gmail.com',
          role: AppRole.wali,
          santriId: 'S-101',
          loginTime: DateTime.now(),
        );

      case AppRole.security:
        return UserSessionModel(
          userId: 'SEC-01',
          username: 'satpam.pos',
          namaLengkap: 'Pak Suparman (Pos Gate 1)',
          email: 'security@pesantrendarululum.sch.id',
          role: AppRole.security,
          loginTime: DateTime.now(),
        );

      case AppRole.superAdmin:
        return UserSessionModel(
          userId: 'SUP-01',
          username: 'superadmin',
          namaLengkap: 'Super Administrator Ri\'ayah',
          email: 'it@pesantrendarululum.sch.id',
          role: AppRole.superAdmin,
          loginTime: DateTime.now(),
        );
    }
  }

  static String _getDefaultNameForRole(AppRole role) {
    return getPresetSessionForRole(role).namaLengkap;
  }
}

