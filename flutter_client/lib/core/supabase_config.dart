import 'package:supabase_flutter/supabase_flutter.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - SUPABASE CORE CONFIGURATION
 * Terhubung langsung ke Supabase Cloud (PostgreSQL, Row Level Security & Realtime)
 * Proyek ID: htjnrpyuzkarigglgrxm
 * ============================================================================
 */

class SupabaseConfig {
  static const String supabaseUrl = 'https://htjnrpyuzkarigglgrxm.supabase.co';
  static const String supabaseAnonKey = 'sb_publishable_WQ7Ix8DuKxlVdv_dnwBspw_cXbdkADI';

  static SupabaseClient get client => Supabase.instance.client;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      realtimeClientOptions: const RealtimeClientOptions(
        eventsPerSecond: 10,
      ),
    );
  }
}

