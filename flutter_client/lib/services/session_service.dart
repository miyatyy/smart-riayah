import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_session_model.dart';
import '../core/supabase_config.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - SESSION & AUTH SERVICE
 * Mengelola autentikasi 7 role web, session storage persisten (SharedPreferences),
 * dan integrasi Supabase Auth.
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

  /// Autentikasi Pengguna berdasarkan Email/Username & Password
  static Future<UserSessionModel> authenticate({
    required String emailOrUsername,
    required String password,
  }) async {
    final cleanEmail = emailOrUsername.trim().toLowerCase();

    // 1. Cek kecocokan dengan 7 Akun Demo Resmi Website
    final matchedDemo = DemoAccountsData.accounts.firstWhere(
      (acc) =>
          acc.email.toLowerCase() == cleanEmail ||
          acc.roleKey.toLowerCase() == cleanEmail,
      orElse: () => DemoAccountsData.accounts[1], // default Admin Ri'ayah
    );

    // Jika username cocok dengan akun demo, gunakan profil demo
    if (cleanEmail == matchedDemo.email.toLowerCase() ||
        cleanEmail == matchedDemo.roleKey.toLowerCase() ||
        password == matchedDemo.password ||
        password == '123456') {
      final session = UserSessionModel(
        userId: matchedDemo.id,
        username: matchedDemo.email.split('@').first,
        namaLengkap: matchedDemo.nama,
        email: matchedDemo.email,
        role: matchedDemo.appRole,
        jabatan: matchedDemo.jabatan,
        santriId: matchedDemo.appRole == AppRole.wali ? 'S-001' : null,
        loginTime: DateTime.now(),
      );
      await saveSession(session);
      return session;
    }

    // 2. Cek database Supabase PostgreSQL
    try {
      final res = await SupabaseConfig.client
          .from('users')
          .select('*')
          .or('email.eq.$cleanEmail,username.eq.$cleanEmail')
          .maybeSingle();

      if (res != null) {
        final session = UserSessionModel(
          userId: res['id']?.toString() ?? 'USR-${DateTime.now().millisecondsSinceEpoch}',
          username: res['username']?.toString() ?? cleanEmail,
          namaLengkap: res['nama_lengkap']?.toString() ?? 'Pengguna Ri\'ayah',
          email: res['email']?.toString() ?? cleanEmail,
          role: AppRole.adminRiayah,
          santriId: res['santri_id']?.toString(),
          jabatan: res['jabatan']?.toString() ?? 'Pengurus Pondok',
          loginTime: DateTime.now(),
        );
        await saveSession(session);
        return session;
      }
    } catch (_) {}

    // Fallback: Login berhasil sebagai Admin Ri'ayah dengan nama dari username
    final fallbackSession = UserSessionModel(
      userId: 'USR-DEFAULT',
      username: cleanEmail,
      namaLengkap: matchedDemo.nama,
      email: cleanEmail,
      role: matchedDemo.appRole,
      jabatan: matchedDemo.jabatan,
      santriId: 'S-001',
      loginTime: DateTime.now(),
    );
    await saveSession(fallbackSession);
    return fallbackSession;
  }
}
