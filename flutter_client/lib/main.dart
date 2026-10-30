import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/supabase_config.dart';
import 'theme/app_theme.dart';
import 'models/user_session_model.dart';
import 'services/session_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/admin/admin_dashboard_screen.dart';
import 'screens/santri/santri_wali_dashboard_screen.dart';
import 'screens/common/rfid_tap_screen.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - MAIN ENTRY POINT
 * Terhubung langsung ke Supabase PostgreSQL, RLS, & Supabase Realtime Listeners
 * Fitur setara dengan versi Web Smart Ri'ayah
 * ============================================================================
 */

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));

  // 1. Inisialisasi Supabase SDK
  await SupabaseConfig.initialize();

  // 2. Cek apakah ada sesi login pengguna tersimpan
  final savedSession = await SessionService.getSession();

  runApp(SmartRiayahApp(initialSession: savedSession));
}

class SmartRiayahApp extends StatelessWidget {
  final UserSessionModel? initialSession;

  const SmartRiayahApp({super.key, this.initialSession});

  @override
  Widget build(BuildContext context) {
    Widget homeScreen;

    if (initialSession != null) {
      final role = initialSession!.role;
      if (role == AppRole.santri || role == AppRole.wali) {
        homeScreen = SantriWaliDashboardScreen(session: initialSession!);
      } else if (role == AppRole.security) {
        homeScreen = RfidTapScreen(session: initialSession!);
      } else {
        homeScreen = AdminDashboardScreen(session: initialSession!);
      }
    } else {
      homeScreen = const LoginScreen();
    }

    return MaterialApp(
      title: 'Smart Ri\'ayah Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: homeScreen,
    );
  }
}
