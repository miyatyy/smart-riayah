import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase_config.dart';
import '../models/santri_model.dart';
import '../models/room_model.dart';
import '../models/permit_model.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - SUPABASE SERVICE LAYER
 * Menghubungkan seluruh query database PostgreSQL & Realtime Broadcast:
 * - Query, Insert, Update, Delete Kamar (rooms)
 * - Query, Insert, Update, Delete Santri (santri)
 * - Query & Update Perizinan (permits)
 * - Realtime Listeners (supabase.channel)
 * ============================================================================
 */

class SupabaseService {
  static SupabaseClient get _client => SupabaseConfig.client;

  // ─── 1. SANTRI OPERATIONS ──────────────────────────────────────────────────

  /// Mengambil seluruh data santri diurutkan berdasarkan waktu pendaftaran
  static Future<List<SantriModel>> getSantriList() async {
    try {
      final response = await _client
          .from('santri')
          .select('*')
          .order('created_at', ascending: false);

      final List<dynamic> data = response as List<dynamic>;
      return data.map((item) => SantriModel.fromJson(item as Map<String, dynamic>)).toList();
    } catch (e) {
      print('❌ [SupabaseService getSantriList] Error: $e');
      return [];
    }
  }

  /// Mengambil data satu santri berdasarkan ID
  static Future<SantriModel?> getSantriById(String santriId) async {
    try {
      final response = await _client
          .from('santri')
          .select('*')
          .eq('id', santriId)
          .maybeSingle();

      if (response == null) return null;
      return SantriModel.fromJson(response);
    } catch (e) {
      print('❌ [SupabaseService getSantriById] Error: $e');
      return null;
    }
  }

  /// Menambah data santri baru ke tabel 'santri'
  static Future<bool> insertSantri({
    required String namaLengkap,
    required String nis,
    required String gender,
    required String? kamarId,
    required String kamar,
    required String rfidUid,
    required int saldoAwal,
    required String namaWali,
    required String noWali,
    String kelas = '10-A',
  }) async {
    try {
      final id = 'S-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
      final payload = {
        'id': id,
        'nis': nis.trim(),
        'nama_lengkap': namaLengkap.trim(),
        'gender': gender,
        'kelas': kelas,
        'kamar_id': kamarId,
        'kamar': kamar,
        'rfid_uid': rfidUid.trim().toUpperCase(),
        'saldo_awal': saldoAwal,
        'saldo_rfid': saldoAwal,
        'limit_jajan_harian': 25000,
        'poin_disiplin': 100,
        'status_asrama': 'DI_ASRAMA',
        'nama_wali': namaWali.trim(),
        'no_wali': noWali.trim(),
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      };

      await _client.from('santri').insert(payload);

      // Otomatis update kuota keterisian kamar (+1) jika kamarId valid
      if (kamarId != null && kamarId.isNotEmpty) {
        try {
          final roomData = await _client.from('rooms').select('terisi, kapasitas').eq('id', kamarId).maybeSingle();
          if (roomData != null) {
            final int currentTerisi = int.tryParse(roomData['terisi']?.toString() ?? '0') ?? 0;
            final int kapasitas = int.tryParse(roomData['kapasitas']?.toString() ?? '8') ?? 8;
            await _client.from('rooms').update({
              'terisi': (currentTerisi + 1).clamp(0, kapasitas)
            }).eq('id', kamarId);
          }
        } catch (_) {}
      }

      print('✅ [SupabaseService insertSantri] Berhasil mendaftarkan: $namaLengkap');
      return true;
    } catch (e) {
      print('❌ [SupabaseService insertSantri] Error: $e');
      return false;
    }
  }

  /// Menghapus santri dari tabel 'santri' berdasarkan ID uniknya
  static Future<bool> deleteSantri(String santriId, {String? kamarId}) async {
    try {
      await _client.from('santri').delete().eq('id', santriId);

      // Otomatis kurangi kuota kamar (-1) jika ada
      if (kamarId != null && kamarId.isNotEmpty) {
        try {
          final roomData = await _client.from('rooms').select('terisi').eq('id', kamarId).maybeSingle();
          if (roomData != null) {
            final int currentTerisi = int.tryParse(roomData['terisi']?.toString() ?? '0') ?? 0;
            if (currentTerisi > 0) {
              await _client.from('rooms').update({
                'terisi': currentTerisi - 1
              }).eq('id', kamarId);
            }
          }
        } catch (_) {}
      }

      print('✅ [SupabaseService deleteSantri] Berhasil menghapus santri: $santriId');
      return true;
    } catch (e) {
      print('❌ [SupabaseService deleteSantri] Error: $e');
      return false;
    }
  }

  // ─── 2. ROOMS (KAMAR ASRAMA) OPERATIONS ────────────────────────────────────

  /// Mengambil daftar seluruh kamar asrama
  static Future<List<RoomModel>> getRoomsList() async {
    try {
      final response = await _client
          .from('rooms')
          .select('*')
          .order('nomor_kamar', ascending: true);

      final List<dynamic> data = response as List<dynamic>;
      return data.map((item) => RoomModel.fromMap(item as Map<String, dynamic>)).toList();
    } catch (e) {
      print('❌ [SupabaseService getRoomsList] Error: $e');
      return [];
    }
  }

  /// Menambah kamar asrama baru
  static Future<bool> insertRoom({
    required String namaGedung,
    required String kategoriGedung, // 'PUTRA' atau 'PUTRI'
    required String nomorKamar,
    int lantai = 1,
    int kapasitas = 8,
    String ketuaKamar = '-',
    String catatanInspeksi = 'Kamar siap huni dan rapi.',
  }) async {
    try {
      final id = 'RM-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
      final payload = {
        'id': id,
        'nama_gedung': namaGedung.trim(),
        'kategori_gedung': kategoriGedung.toUpperCase(),
        'nomor_kamar': nomorKamar.trim(),
        'lantai': lantai,
        'kapasitas': kapasitas,
        'terisi': 0,
        'ketua_kamar': ketuaKamar.trim(),
        'skor_kerapian_terakhir': 90,
        'catatan_inspeksi': catatanInspeksi.trim(),
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      };

      await _client.from('rooms').insert(payload);
      print('✅ [SupabaseService insertRoom] Kamar baru ditambahkan: $nomorKamar');
      return true;
    } catch (e) {
      print('❌ [SupabaseService insertRoom] Error: $e');
      return false;
    }
  }

  /// Memperbarui data kamar asrama
  static Future<bool> updateRoom({
    required String roomId,
    String? nomorKamar,
    int? kapasitas,
    String? ketuaKamar,
    String? catatanInspeksi,
  }) async {
    try {
      final Map<String, dynamic> payload = {
        'updated_at': DateTime.now().toIso8601String(),
      };
      if (nomorKamar != null) payload['nomor_kamar'] = nomorKamar;
      if (kapasitas != null) payload['kapasitas'] = kapasitas;
      if (ketuaKamar != null) payload['ketua_kamar'] = ketuaKamar;
      if (catatanInspeksi != null) payload['catatan_inspeksi'] = catatanInspeksi;

      await _client.from('rooms').update(payload).eq('id', roomId);
      print('✅ [SupabaseService updateRoom] Berhasil update kamar: $roomId');
      return true;
    } catch (e) {
      print('❌ [SupabaseService updateRoom] Error: $e');
      return false;
    }
  }

  /// Menghapus kamar asrama dari database
  static Future<bool> deleteRoom(String roomId) async {
    try {
      await _client.from('rooms').delete().eq('id', roomId);
      print('✅ [SupabaseService deleteRoom] Berhasil menghapus kamar: $roomId');
      return true;
    } catch (e) {
      print('❌ [SupabaseService deleteRoom] Error: $e');
      return false;
    }
  }

  // ─── 3. PERMITS (PERIZINAN SANTRI) OPERATIONS ──────────────────────────────

  /// Mengambil perizinan santri
  static Future<List<PermitModel>> getPermitsList({String? santriId}) async {
    try {
      var query = _client.from('permits').select('*');
      if (santriId != null && santriId.isNotEmpty) {
        query = query.eq('santri_id', santriId);
      }
      final response = await query.order('created_at', ascending: false).limit(50);
      final List<dynamic> data = response as List<dynamic>;
      return data.map((item) => PermitModel.fromMap(item as Map<String, dynamic>)).toList();
    } catch (e) {
      print('❌ [SupabaseService getPermitsList] Error: $e');
      return [];
    }
  }

  /// Mengajukan izin baru
  static Future<bool> submitPermit({
    required String santriId,
    required String santriNama,
    required String kategori,
    required String keperluan,
    required String penjemput,
    required DateTime batasKembali,
  }) async {
    try {
      final id = 'PRM-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
      final token = 'DU-PERMIT-${DateTime.now().millisecondsSinceEpoch.toString().substring(9)}';

      final payload = {
        'id': id,
        'santri_id': santriId,
        'santri_nama': santriNama,
        'kategori': kategori,
        'keperluan': keperluan,
        'penjemput': penjemput,
        'batas_kembali': batasKembali.toIso8601String(),
        'status': 'PENDING',
        'token_izin': token,
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      };

      await _client.from('permits').insert(payload);
      return true;
    } catch (e) {
      print('❌ [SupabaseService submitPermit] Error: $e');
      return false;
    }
  }

  // ─── 4. RFID GATE SIMULATION & LOGGING ──────────────────────────────────────

  /// Mencatat event tap kartu RFID di gerbang
  static Future<Map<String, dynamic>> recordRfidTap({
    required String rfidUid,
    String gateId = 'GATE-01 (Main Gate)',
  }) async {
    try {
      // 1. Cari santri pemilik UID
      final santri = await _client.from('santri').select('*').eq('rfid_uid', rfidUid.trim().toUpperCase()).maybeSingle();

      if (santri == null) {
        return {
          'success': false,
          'status': 'UNREGISTERED',
          'message': 'Kartu UID [$rfidUid] belum terdaftar di Buku Induk Ri\'ayah!',
        };
      }

      final santriId = santri['id'].toString();
      final santriNama = santri['nama_lengkap'].toString();
      final currentStatus = santri['status_asrama']?.toString() ?? 'DI_ASRAMA';

      // 2. Tentukan arah tap (Masuk atau Keluar)
      final bool isExiting = currentStatus == 'DI_ASRAMA';
      final String nextStatus = isExiting ? 'DI_LUAR' : 'DI_ASRAMA';
      final String logType = isExiting ? 'TAP_KELUAR' : 'TAP_MASUK';

      // 3. Update status asrama santri
      await _client.from('santri').update({
        'status_asrama': nextStatus,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', santriId);

      // 4. Catat ke tabel gate_logs
      final logId = 'LOG-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
      await _client.from('gate_logs').insert({
        'id': logId,
        'santri_id': santriId,
        'santri_nama': santriNama,
        'rfid_uid': rfidUid,
        'gate_id': gateId,
        'tipe': logType,
        'status': 'VERIFIED',
        'remarks': isExiting ? 'Santri keluar area asrama' : 'Santri kembali masuk asrama',
        'created_at': DateTime.now().toIso8601String(),
      });

      return {
        'success': true,
        'status': nextStatus,
        'action': logType,
        'santriNama': santriNama,
        'santriId': santriId,
        'message': isExiting 
            ? '✅ Selamat jalan, $santriNama. Status: Di Luar Asrama'
            : '✅ Ahlan wa Sahlan, $santriNama. Status: Di Dalam Asrama',
      };
    } catch (e) {
      return {
        'success': false,
        'status': 'ERROR',
        'message': 'Terjadi kesalahan sistem: $e',
      };
    }
  }

  // ─── 5. SUPABASE REALTIME SUBSCRIPTIONS ─────────────────────────────────────

  /// Berlangganan perubahan data tabel secara Realtime
  static RealtimeChannel subscribeTableChanges({
    required String tableName,
    required Function(PostgresChangePayload) onChange,
  }) {
    final channel = _client.channel('public:$tableName');
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: tableName,
      callback: (payload) {
        onChange(payload);
      },
    );
    channel.subscribe();
    return channel;
  }
}

