import 'dart:convert';
import 'package:http/http.dart' as http;

class SmartRiayahApiService {
  // IP Default lokal laptop/server. Bila diuji lewat HP fisik, ganti dengan IP WiFi laptop (contoh: 192.168.1.10)
  // Bila di emulator Android, gunakan 10.0.2.2:5000
  static String baseUrl = 'http://10.0.2.2:5000/api';

  static void setCustomHost(String hostWithPort) {
    baseUrl = 'http://$hostWithPort/api';
  }

  // 1. Cek Kesehatan Server
  static Future<bool> checkHealth() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/health')).timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
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
