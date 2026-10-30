import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/supabase_config.dart';
import 'theme/app_theme.dart';
import 'models/user_session_model.dart';
import 'services/session_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/main_dashboard_screen.dart';
import 'services/notification_service.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - MAIN APPLICATION ENTRY POINT
 * Terhubung langsung ke Supabase PostgreSQL, RLS & Realtime Listeners
 * Navigasi Universal Enterprise matching 1:1 Web
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

  // 2. Inisialisasi Local Push Notifications & Heads-Up Banner
  await NotificationService.initialize();

  // 3. Cek apakah ada sesi login pengguna tersimpan
  final savedSession = await SessionService.getSession();

  runApp(SmartRiayahApp(initialSession: savedSession));
}

class SmartRiayahApp extends StatelessWidget {
  final UserSessionModel? initialSession;

  const SmartRiayahApp({super.key, this.initialSession});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart Ri\'ayah Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: initialSession != null
          ? MainDashboardScreen(session: initialSession!)
          : const LoginScreen(),
    );
  }
}
