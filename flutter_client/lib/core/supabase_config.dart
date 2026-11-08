import 'package:supabase_flutter/supabase_flutter.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - SUPABASE CORE CONFIGURATION
 * Terhubung langsung ke Supabase Cloud (PostgreSQL, Row Level Security & Realtime)
 * ============================================================================
 */

class SupabaseConfig {
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  static const String supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');

  static SupabaseClient get client => Supabase.instance.client;

  static Future<void> initialize() async {
    if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
      print('⚠️ [SupabaseConfig] SUPABASE_URL atau SUPABASE_ANON_KEY belum dikonfigurasi via dart-define.');
      return;
    }
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      realtimeClientOptions: const RealtimeClientOptions(
        eventsPerSecond: 10,
      ),
    );
  }
}

