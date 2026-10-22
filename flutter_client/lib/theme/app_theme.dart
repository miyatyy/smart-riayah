import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const emerald950 = Color(0xFF022C22);
  static const emerald900 = Color(0xFF064E3B);
  static const emerald800 = Color(0xFF065F46);
  static const emerald700 = Color(0xFF047857);
  static const emerald600 = Color(0xFF059669);
  static const emerald500 = Color(0xFF10B981);
  static const emerald400 = Color(0xFF34D399);
  static const emerald300 = Color(0xFF6EE7B7);
  static const emerald200 = Color(0xFFA7F3D0);
  static const emerald100 = Color(0xFFD1FAE5);
  static const emerald50  = Color(0xFFECFDF5);

  static const gold500 = Color(0xFFF59E0B);
  static const gold400 = Color(0xFFFBBF24);
  static const gold300 = Color(0xFFFCD34D);

  static const danger  = Color(0xFFEF4444);
  static const warning = Color(0xFFF59E0B);
  static const info    = Color(0xFF3B82F6);

  static const surface       = Color(0xFFF8FAFC);
  static const cardBg        = Colors.white;
  static const textPrimary   = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF64748B);
  static const textMuted     = Color(0xFF94A3B8);
  static const borderColor   = Color(0xFFE2E8F0);
}

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.surface,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.emerald600,
      brightness: Brightness.light,
      primary: AppColors.emerald700,
      onPrimary: Colors.white,
      secondary: AppColors.gold400,
      surface: AppColors.surface,
    ),
    textTheme: GoogleFonts.plusJakartaSansTextTheme(),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.emerald900,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: AppColors.cardBg,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.borderColor),
      ),
      margin: EdgeInsets.zero,
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
  );
}
