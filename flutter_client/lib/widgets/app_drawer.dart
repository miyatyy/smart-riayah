import 'package:flutter/material.dart';
import '../models/user_session_model.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - UNIVERSAL NAVIGATION DRAWER
 * Navigasi samping kelas enterprise yang konsisten di semua role:
 * - Header profil lengkap dengan role badge & indikator Supabase Live
 * - Menu lengkap selaras dengan web:
 *   1. Dashboard Ringkasan
 *   2. Grafik Aktivitas Real-Time
 *   3. Manajemen Data & Kamar
 *   4. Rekapitulasi Laporan
 *   5. AI Agent Aktif
 *   6. Dompet Pintar & Keuangan
 *   7. Perizinan Langsung
 *   8. Live Chat Komunikasi
 *   9. Keluar Akun (Logout)
 * ============================================================================
 */

class AppDrawer extends StatelessWidget {
  final UserSessionModel session;
  final int selectedIndex;
  final Function(int index) onSelectIndex;
  final VoidCallback onLogout;

  const AppDrawer({
    super.key,
    required this.session,
    required this.selectedIndex,
    required this.onSelectIndex,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final role = session.role;
    final primaryColor = role.primaryColor;

    return Drawer(
      backgroundColor: const Color(0xFFF8FAFC),
      child: SafeArea(
        child: Column(
          children: [
            // USER PROFILE HEADER
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
              decoration: BoxDecoration(
                color: Colors.white,
                border: const Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: primaryColor.withOpacity(0.12),
                        child: Icon(role.icon, color: primaryColor, size: 26),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              session.namaLengkap,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: primaryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                role.title,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: primaryColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Supabase Realtime Live Indicator
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFA7F3D0)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircleAvatar(radius: 3.5, backgroundColor: Color(0xFF10B981)),
                        SizedBox(width: 6),
                        Text(
                          'Supabase Realtime Live • Terhubung',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF065F46),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // NAVIGATION MENU LIST
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                children: [
                  _buildMenuItem(
                    index: 0,
                    icon: Icons.dashboard_rounded,
                    title: 'Dashboard Ringkasan',
                    subtitle: 'Ikhtisar & Statistik',
                  ),
                  _buildMenuItem(
                    index: 1,
                    icon: Icons.bar_chart_rounded,
                    title: 'Grafik Aktivitas Real-Time',
                    subtitle: 'Kehadiran & Mutaba\'ah',
                    badge: 'Live',
                    badgeColor: const Color(0xFF10B981),
                  ),
                  _buildMenuItem(
                    index: 2,
                    icon: Icons.apartment_rounded,
                    title: 'Manajemen Data & Kamar',
                    subtitle: 'Buku Induk & Kuota Asrama',
                  ),
                  _buildMenuItem(
                    index: 3,
                    icon: Icons.assignment_rounded,
                    title: 'Rekapitulasi Laporan',
                    subtitle: 'Perizinan & Log Presensi',
                    badge: 'Arsip',
                    badgeColor: const Color(0xFF64748B),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Divider(color: Color(0xFFE2E8F0)),
                  ),
                  _buildMenuItem(
                    index: 4,
                    icon: Icons.auto_awesome_rounded,
                    title: 'AI Smart Assistant',
                    subtitle: 'Asisten Cerdas Pondok',
                    badge: 'AI',
                    badgeColor: const Color(0xFF8B5CF6),
                    isHighlight: true,
                  ),
                  _buildMenuItem(
                    index: 5,
                    icon: Icons.account_balance_wallet_rounded,
                    title: 'Dompet Pintar Cashless',
                    subtitle: 'Saldo & Transaksi Santri',
                    badge: 'Keuangan',
                    badgeColor: const Color(0xFF047857),
                  ),
                  _buildMenuItem(
                    index: 6,
                    icon: Icons.note_alt_rounded,
                    title: 'Perizinan Langsung',
                    subtitle: 'Pengajuan & Validasi Izin',
                    badge: 'Instan',
                    badgeColor: const Color(0xFFF59E0B),
                  ),
                  _buildMenuItem(
                    index: 7,
                    icon: Icons.forum_rounded,
                    title: 'Live Chat Komunikasi',
                    subtitle: 'Wali & Pengurus Pondok',
                    badge: 'Pesan',
                    badgeColor: const Color(0xFF0284C7),
                  ),
                ],
              ),
            ),

            // LOGOUT BUTTON
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 18),
                ),
                title: const Text(
                  'Keluar Akun',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFDC2626),
                  ),
                ),
                subtitle: const Text(
                  'Akhiri sesi aplikasi',
                  style: TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                ),
                onTap: onLogout,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem({
    required int index,
    required IconData icon,
    required String title,
    required String subtitle,
    String? badge,
    Color? badgeColor,
    bool isHighlight = false,
  }) {
    final isSelected = selectedIndex == index;
    final primaryColor = session.role.primaryColor;

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: isSelected
            ? primaryColor.withOpacity(0.08)
            : (isHighlight ? const Color(0xFFF5F3FF) : Colors.transparent),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected
              ? primaryColor.withOpacity(0.3)
              : (isHighlight ? const Color(0xFFDDD6FE) : Colors.transparent),
        ),
      ),
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        leading: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: isSelected
                ? primaryColor
                : (isHighlight ? const Color(0xFF8B5CF6) : const Color(0xFFF1F5F9)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            icon,
            size: 18,
            color: isSelected || isHighlight ? Colors.white : const Color(0xFF64748B),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                  color: isSelected ? primaryColor : const Color(0xFF1E293B),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (badge != null) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: (badgeColor ?? primaryColor).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  badge,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    color: badgeColor ?? primaryColor,
                  ),
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(
            fontSize: 10,
            color: isSelected ? primaryColor.withOpacity(0.8) : const Color(0xFF94A3B8),
          ),
        ),
        onTap: () => onSelectIndex(index),
      ),
    );
  }
}

