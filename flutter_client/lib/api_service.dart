import 'dart:convert';
import 'package:http/http.dart' as http;

class SmartRiayahApiService {
  // Daftar kandidat endpoint (127.0.0.1 untuk USB adb reverse, WiFi laptop, dan emulator)
  static final List<String> _candidateHosts = [
    'http://127.0.0.1:5000/api',
    'http://localhost:5000/api',
    'http://192.168.18.6:5000/api',
    'http://10.0.2.2:5000/api',
  ];

  static String baseUrl = 'http://127.0.0.1:5000/api';

  static void setCustomHost(String hostWithPort) {
    baseUrl = 'http://$hostWithPort/api';
  }

  // 1. Cek Kesehatan Server dengan Auto-Discovery Host
  static Future<bool> checkHealth() async {
    // Coba baseUrl saat ini terlebih dahulu
    try {
      final res = await http.get(Uri.parse('$baseUrl/health')).timeout(const Duration(seconds: 2));
      if (res.statusCode == 200) return true;
    } catch (_) {}

    // Jika gagal, cari otomatis host mana yang aktif
    for (final candidate in _candidateHosts) {
      if (candidate == baseUrl) continue;
      try {
        final res = await http.get(Uri.parse('$candidate/health')).timeout(const Duration(seconds: 2));
        if (res.statusCode == 200) {
          baseUrl = candidate;
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  // 2. Mengambil Data Santri
  static Future<List<Map<String, dynamic>>> getSantriList() async {
    final res = await http.get(Uri.parse('$baseUrl/santri'));
    if (res.statusCode == 200) {
      final json = jsonDecode(res.body);
      final List list = json['data'] ?? [];
      return list.cast<Map<String, dynamic>>();
    }
    throw Exception('Gagal mengambil data santri: HTTP ${res.statusCode}');
  }

  // 3. Mengambil Data Perizinan (Smart Permit)
  static Future<List<Map<String, dynamic>>> getPermits({String? status, String? santriId}) async {
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

  // 4. Mengajukan Izin Santri Baru dari HP Wali
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
