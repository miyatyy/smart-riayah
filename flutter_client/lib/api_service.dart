import 'dart:convert';
import 'package:http/http.dart' as http;
import 'screens/login_screen.dart';

class SmartRiayahApiService {
  // Ganti dengan URL backend yang sudah di-deploy di Railway
  // Jika masih lokal, gunakan IP WiFi laptop
  static String baseUrl = 'http://10.0.2.2:5000/api'; // Default emulator Android

  // Daftar kandidat endpoint (auto-discovery)
  static final List<String> _candidateHosts = [
    'http://127.0.0.1:5000/api',
    'http://localhost:5000/api',
    'http://192.168.18.6:5000/api',
    'http://10.0.2.2:5000/api', // Android emulator -> host
  ];

  static void setDeployedBackend(String deployedUrl) {
    baseUrl = deployedUrl.endsWith('/api')
        ? deployedUrl
        : '$deployedUrl/api';
  }

  static void setCustomHost(String hostWithPort) {
    baseUrl = 'http://$hostWithPort/api';
  }

  // ─── Auth: Login ──────────────────────────────────────────────────────────
  static Future<AppSession> login({
    required String username,
    required String password,
    required UserRole role,
  }) async {
    // Coba login via API dulu
    try {
      await checkHealth();
      final res = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': username,
          'password': password,
          'role': role.name,
        }),
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        if (json['success'] == true) {
          return AppSession(
            namaLengkap: json['data']['namaLengkap'] ?? username,
            role: role,
            token: json['data']['token'] ?? 'local-token',
          );
        }
        throw Exception(json['message'] ?? 'Login gagal');
      }
      if (res.statusCode == 401) {
        throw Exception('Username atau password salah');
      }
      throw Exception('Server error: ${res.statusCode}');
    } on Exception {
      rethrow;
    } catch (_) {
      // Fallback: local demo login jika server tidak tersedia
      return _localDemoLogin(username, password, role);
    }
  }

  // Demo login fallback (offline mode)
  static AppSession _localDemoLogin(
      String username, String password, UserRole role) {
    const demoAccounts = {
      'musyrif': {'pass': 'musyrif123', 'nama': 'Ust. Ahmad Musyrif'},
      'wali': {'pass': 'wali123', 'nama': 'Bapak H. Ridwan'},
      'admin': {'pass': 'admin123', 'nama': 'Admin Sistem'},
      'santri': {'pass': 'santri123', 'nama': 'Ahmad Fauzi'},
      'demo': {'pass': 'demo', 'nama': 'Demo User'},
    };

    final account = demoAccounts[username.toLowerCase()];
    if (account == null) {
      throw Exception('Akun tidak ditemukan. Gunakan: musyrif / wali / admin / santri');
    }
    if (account['pass'] != password && password != 'demo') {
      throw Exception('Password salah. (Demo mode aktif)');
    }

    return AppSession(
      namaLengkap: account['nama']!,
      role: role,
      token: 'demo-token-${DateTime.now().millisecondsSinceEpoch}',
    );
  }

  // ─── 1. Health Check ──────────────────────────────────────────────────────
  static Future<bool> checkHealth() async {
    // Coba baseUrl saat ini
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/health'))
          .timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) return true;
    } catch (_) {}

    // Auto-discovery fallback
    for (final candidate in _candidateHosts) {
      if (candidate == baseUrl) continue;
      try {
        final res = await http
            .get(Uri.parse('$candidate/health'))
            .timeout(const Duration(seconds: 2));
        if (res.statusCode == 200) {
          baseUrl = candidate;
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  // ─── 2. Santri List ───────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getSantriList() async {
    final res = await http.get(Uri.parse('$baseUrl/santri'));
    if (res.statusCode == 200) {
      final json = jsonDecode(res.body);
      final List list = json['data'] ?? [];
      return list.cast<Map<String, dynamic>>();
    }
    throw Exception('Gagal mengambil data santri: HTTP ${res.statusCode}');
  }

  // ─── 3. Permits ───────────────────────────────────────────────────────────
  static Future<List<Map<String, dynamic>>> getPermits(
      {String? status, String? santriId}) async {
    final query = <String, String>{};
    if (status != null) query['status'] = status;
    if (santriId != null) query['santriId'] = santriId;

    final uri = Uri.parse('$baseUrl/permits').replace(queryParameters: query);
    final res = await http.get(uri);
    if (res.statusCode == 200) {
      final json = jsonDecode(res.body);
      final List list = json['data'] ?? [];
      return list.cast<Map<String, dynamic>>();
    }
    throw Exception('Gagal mengambil daftar izin');
  }

  // ─── 4. Submit Permit ─────────────────────────────────────────────────────
  static Future<bool> submitPermit({
    required String santriId,
    required String kategori,
    required String keperluan,
    required String penjemput,
    required String batasKembali,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/permits'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'santriId': santriId,
        'kategori': kategori,
        'keperluan': keperluan,
        'penjemput': penjemput,
        'batasKembali': batasKembali,
      }),
    );
    return res.statusCode == 200 || res.statusCode == 201;
  }
}
