import 'package:flutter/material.dart';
import '../models/user_session_model.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - STRICT ROLE-BASED ACCESS CONTROL (RBAC) DRAWER
 * 100% Selaras dengan Logika Website (https://smart-riayah.vercel.app/)
 * Filter menu ketat berdasarkan role pengguna:
 * 1. Super Admin: Full Access (Semua Menu)
 * 2. Admin Ri'ayah: Operasional Kamar, Santri, Approval Izin, Dompet & Chat
 * 3. Orang Tua / Wali Santri: Terbatas Khusus Anak (Dashboard Anakku, Mutaba'ah, Dompet, Izin, Chat)
 * 4. Musyrif: Asrama Binaan, Presensi Malam, Adab, Approval Awal, Chat
 * 5. Pos Satpam: Command Center Gate, Validasi DU-PERMIT, Log Keluar-Masuk
 * 6. Poskestren Medis: Rekam Medis, Santri Rawat UKS, Izin Sakit, AI Medis
 * 7. Mudir: Executive Dashboard, Tren Pondok, Rekap Laporan Terpadu
 * ============================================================================
 */

class RoleMenuItem {
  final String key;
  final String title;
  final String subtitle;
  final IconData icon;
  final String? badge;
  final Color? badgeColor;
  final bool isHighlight;

  const RoleMenuItem({
    required this.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.badge,
    this.badgeColor,
    this.isHighlight = false,
  });
}

class AppDrawer extends StatelessWidget {
  final UserSessionModel session;
  final String activeMenuKey;
  final Function(String menuKey) onSelectMenuKey;
  final VoidCallback onLogout;

  const AppDrawer({
    super.key,
    required this.session,
    required this.activeMenuKey,
    required this.onSelectMenuKey,
    required this.onLogout,
  });

  /// Generator menu spesifik sesuai matriks RBAC masing-masing role
  static List<RoleMenuItem> getMenusForRole(AppRole role) {
    switch (role) {
      // 1. SUPER ADMIN / DEVELOPER (FULL ACCESS)
      case AppRole.superAdmin:
        return const [
          RoleMenuItem(
            key: 'dashboard',
            title: 'Dashboard Global',
            subtitle: 'Kontrol & Statistik Terpadu',
            icon: Icons.dashboard_rounded,
          ),
          RoleMenuItem(
            key: 'grafik',
            title: 'Grafik Aktivitas Real-Time',
            subtitle: 'Seluruh Blok Asrama & Santri',
            icon: Icons.bar_chart_rounded,
            badge: 'Live',
            badgeColor: Color(0xFF10B981),
          ),
          RoleMenuItem(
            key: 'data_kamar',
            title: 'Manajemen Data & Kamar',
            subtitle: 'CRUD Kamar & Buku Induk Santri',
            icon: Icons.apartment_rounded,
          ),
          RoleMenuItem(
            key: 'rekap_laporan',
            title: 'Rekapitulasi Laporan',
            subtitle: 'Seluruh Divisi Pondok',
            icon: Icons.assignment_rounded,
            badge: 'Arsip',
            badgeColor: Color(0xFF64748B),
          ),
          RoleMenuItem(
            key: 'perizinan',
            title: 'Otorisasi Izin (Override)',
            subtitle: 'Validasi & Bypass Darurat',
            icon: Icons.rule_rounded,
            badge: 'Penuh',
            badgeColor: Color(0xFF4F46E5),
          ),
          RoleMenuItem(
            key: 'dompet_pintar',
            title: 'Master Keuangan Dompet',
            subtitle: 'Kontrol Saldo & Audit Cashless',
            icon: Icons.account_balance_wallet_rounded,
            badge: 'Finance',
            badgeColor: Color(0xFF047857),
          ),
          RoleMenuItem(
            key: 'ai_assistant',
            title: 'AI Smart Assistant',
            subtitle: 'DeepSeek System Diagnostics',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            badgeColor: Color(0xFF8B5CF6),
            isHighlight: true,
          ),
          RoleMenuItem(
            key: 'live_chat',
            title: 'Live Chat Komunikasi',
            subtitle: 'Seluruh Lini Wali & Musyrif',
            icon: Icons.forum_rounded,
            badge: 'Pesan',
            badgeColor: Color(0xFF0284C7),
          ),
        ];

      // 2. ADMIN RI'AYAH / PENGURUS PUSAT
      case AppRole.adminRiayah:
        return const [
          RoleMenuItem(
            key: 'dashboard',
            title: 'Dashboard Ri\'ayah',
            subtitle: 'Operasional Asrama & Kuota',
            icon: Icons.dashboard_rounded,
          ),
          RoleMenuItem(
            key: 'grafik',
            title: 'Grafik Aktivitas Real-Time',
            subtitle: 'Tren Izin & Kehadiran Kamar',
            icon: Icons.bar_chart_rounded,
            badge: 'Live',
            badgeColor: Color(0xFF10B981),
          ),
          RoleMenuItem(
            key: 'data_kamar',
            title: 'Manajemen Data & Kamar',
            subtitle: 'Kamar Putra/Putri & Onboarding',
            icon: Icons.apartment_rounded,
          ),
          RoleMenuItem(
            key: 'perizinan',
            title: 'Persetujuan Izin (DU-PERMIT)',
            subtitle: 'Approval Surat Izin Santri',
            icon: Icons.assignment_turned_in_rounded,
            badge: 'Approval',
            badgeColor: Color(0xFFF59E0B),
          ),
          RoleMenuItem(
            key: 'dompet_pintar',
            title: 'Dompet Pintar Cashless',
            subtitle: 'Monitoring & Limit Belanja',
            icon: Icons.account_balance_wallet_rounded,
            badge: 'Keuangan',
            badgeColor: Color(0xFF047857),
          ),
          RoleMenuItem(
            key: 'rekap_laporan',
            title: 'Rekapitulasi Laporan',
            subtitle: 'Arsip Presensi & Kedisiplinan',
            icon: Icons.assignment_rounded,
          ),
          RoleMenuItem(
            key: 'ai_assistant',
            title: 'AI Smart Assistant',
            subtitle: 'Konsultan Cerdas Asrama',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            badgeColor: Color(0xFF8B5CF6),
            isHighlight: true,
          ),
          RoleMenuItem(
            key: 'live_chat',
            title: 'Live Chat Komunikasi',
            subtitle: 'Koordinasi Musyrif & Wali',
            icon: Icons.forum_rounded,
            badge: 'Chat',
            badgeColor: Color(0xFF0284C7),
          ),
        ];

      // 3. ORANG TUA / WALI SANTRI (KHUSUS ANAK SENDIRI)
      case AppRole.wali:
      case AppRole.santri:
        return const [
          RoleMenuItem(
            key: 'dashboard',
            title: 'Dashboard Anakku',
            subtitle: 'Status Keberadaan Real-Time',
            icon: Icons.family_restroom_rounded,
            badge: 'Utama',
            badgeColor: Color(0xFF0891B2),
          ),
          RoleMenuItem(
            key: 'grafik',
            title: 'Aktivitas & Adab Anak',
            subtitle: 'Mutaba\'ah & Kedisiplinan',
            icon: Icons.auto_graph_rounded,
          ),
          RoleMenuItem(
            key: 'dompet_pintar',
            title: 'Dompet Pintar Ananda',
            subtitle: 'Saldo & Transaksi Kantin/Koperasi',
            icon: Icons.account_balance_wallet_rounded,
            badge: 'Cashless',
            badgeColor: Color(0xFF047857),
          ),
          RoleMenuItem(
            key: 'perizinan',
            title: 'Pengajuan Izin Pulang',
            subtitle: 'Form Izin Keluar/Pesiar Instan',
            icon: Icons.send_rounded,
            badge: 'Instan',
            badgeColor: Color(0xFFF59E0B),
          ),
          RoleMenuItem(
            key: 'live_chat',
            title: 'Chat Musyrif Asrama',
            subtitle: 'Pesan Langsung Pembina Ananda',
            icon: Icons.chat_bubble_outline_rounded,
            badge: 'Pesan',
            badgeColor: Color(0xFF0284C7),
          ),
          RoleMenuItem(
            key: 'ai_assistant',
            title: 'Konsultasi AI Wali',
            subtitle: 'Tanya Jadwal & Aturan Pondok',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            badgeColor: Color(0xFF8B5CF6),
            isHighlight: true,
          ),
        ];

      // 4. MUSYRIF / MUSYRIFAH PEMBINA ASRAMA
      case AppRole.musyrif:
      case AppRole.guru:
        return const [
          RoleMenuItem(
            key: 'dashboard',
            title: 'Dashboard Asrama Binaan',
            subtitle: 'Monitoring Kamar & Presensi',
            icon: Icons.home_work_rounded,
          ),
          RoleMenuItem(
            key: 'grafik',
            title: 'Grafik Aktivitas Santri',
            subtitle: 'Kedisiplinan & Tren Izin',
            icon: Icons.bar_chart_rounded,
            badge: 'Live',
            badgeColor: Color(0xFF10B981),
          ),
          RoleMenuItem(
            key: 'data_kamar',
            title: 'Kamar & Presensi Malam',
            subtitle: 'Absensi Kamar & Jam Istirahat',
            icon: Icons.bedroom_child_rounded,
          ),
          RoleMenuItem(
            key: 'perizinan',
            title: 'Verifikasi Izin Santri',
            subtitle: 'Rekomendasi Tahap Awal',
            icon: Icons.rule_rounded,
            badge: 'Validasi',
            badgeColor: Color(0xFFF59E0B),
          ),
          RoleMenuItem(
            key: 'rekap_laporan',
            title: 'Poin Adab & Disiplin',
            subtitle: 'Catatan Prestasi & Pelanggaran',
            icon: Icons.stars_rounded,
          ),
          RoleMenuItem(
            key: 'live_chat',
            title: 'Live Chat Wali Santri',
            subtitle: 'Respon Pertanyaan Orang Tua',
            icon: Icons.forum_rounded,
            badge: 'Pesan',
            badgeColor: Color(0xFF0284C7),
          ),
          RoleMenuItem(
            key: 'ai_assistant',
            title: 'AI Smart Assistant',
            subtitle: 'Analisis Poin & Evaluasi Santri',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            badgeColor: Color(0xFF8B5CF6),
            isHighlight: true,
          ),
        ];

      // 5. POS SATPAM / KEAMANAN GERBANG
      case AppRole.security:
        return const [
          RoleMenuItem(
            key: 'dashboard',
            title: 'Command Center Gerbang',
            subtitle: 'Pos Keamanan & Gate Turnstile',
            icon: Icons.cell_tower_rounded,
            badge: 'Security',
            badgeColor: Color(0xFFE11D48),
          ),
          RoleMenuItem(
            key: 'perizinan',
            title: 'Validasi Gate DU-PERMIT',
            subtitle: 'Checkout & Check-in Gerbang',
            icon: Icons.qr_code_scanner_rounded,
            badge: 'Validasi',
            badgeColor: Color(0xFF10B981),
            isHighlight: true,
          ),
          RoleMenuItem(
            key: 'rekap_laporan',
            title: 'Log Presensi Gerbang',
            subtitle: 'Riwayat Keluar & Overstay Alarm',
            icon: Icons.history_rounded,
            badge: 'Log',
            badgeColor: Color(0xFF64748B),
          ),
        ];

      // 6. MEDIS UKS / POSKESTREN
      case AppRole.poskestren:
        return const [
          RoleMenuItem(
            key: 'dashboard',
            title: 'Dashboard Klinik & UKS',
            subtitle: 'Kesehatan Santri & Rawat Inap',
            icon: Icons.medical_services_rounded,
            badge: 'Medis',
            badgeColor: Color(0xFF0284C7),
          ),
          RoleMenuItem(
            key: 'rekap_laporan',
            title: 'Rekam Medis & Rawat UKS',
            subtitle: 'Riwayat Penyakit & Obat Asrama',
            icon: Icons.healing_rounded,
          ),
          RoleMenuItem(
            key: 'perizinan',
            title: 'Rekomendasi Izin Sakit',
            subtitle: 'Surat Rujuk RS / Pulang Berobat',
            icon: Icons.health_and_safety_rounded,
            badge: 'Izin RS',
            badgeColor: Color(0xFFF59E0B),
          ),
          RoleMenuItem(
            key: 'ai_assistant',
            title: 'AI Diagnostik Medis',
            subtitle: 'Konsultasi Gejala & Obat Asrama',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            badgeColor: Color(0xFF8B5CF6),
            isHighlight: true,
          ),
        ];

      // 7. PIMPINAN PONDOK / MUDIR (EXECUTIVE READ-ONLY)
      case AppRole.mudir:
        return const [
          RoleMenuItem(
            key: 'dashboard',
            title: 'Executive Dashboard',
            subtitle: 'Ringkasan Kinerja Pesantren',
            icon: Icons.account_balance_rounded,
            badge: 'Mudir',
            badgeColor: Color(0xFFD97706),
          ),
          RoleMenuItem(
            key: 'grafik',
            title: 'Analitik & Tren Pondok',
            subtitle: 'Kehadiran, Asrama & Perizinan',
            icon: Icons.trending_up_rounded,
          ),
          RoleMenuItem(
            key: 'rekap_laporan',
            title: 'Laporan Terpadu Divisi',
            subtitle: 'Rekapitulasi Bulanan Santri',
            icon: Icons.summarize_rounded,
            badge: 'Eksekutif',
            badgeColor: Color(0xFF64748B),
          ),
          RoleMenuItem(
            key: 'ai_assistant',
            title: 'Executive DSS Insights',
            subtitle: 'AI Pengambil Keputusan Kebijakan',
            icon: Icons.psychology_rounded,
            badge: 'AI DSS',
            badgeColor: Color(0xFF8B5CF6),
            isHighlight: true,
          ),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = session.role;
    final primaryColor = role.primaryColor;
    final allowedMenus = getMenusForRole(role);

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
                                fontSize: 13.5,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 3),
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
                  if (session.jabatan != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      session.jabatan!,
                      style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 10),
                  // Clean Enterprise Account Status
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircleAvatar(radius: 3.5, backgroundColor: Color(0xFF10B981)),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            session.email ?? 'Aktif Terhubung',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF475569),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // MENU SECTION HEADER
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 4),
              child: Row(
                children: [
                  Text(
                    'MENU UTAMA (${role.title.toUpperCase()})',
                    style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF94A3B8),
                      letterSpacing: 0.8,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${allowedMenus.length} Menu',
                    style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),

            // STRICT FILTERED NAVIGATION MENU LIST
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                itemCount: allowedMenus.length,
                itemBuilder: (ctx, idx) {
                  final item = allowedMenus[idx];
                  final isSelected = activeMenuKey == item.key;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? primaryColor.withOpacity(0.08)
                          : (item.isHighlight ? const Color(0xFFF5F3FF) : Colors.transparent),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected
                            ? primaryColor.withOpacity(0.3)
                            : (item.isHighlight ? const Color(0xFFDDD6FE) : Colors.transparent),
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
                              : (item.isHighlight ? const Color(0xFF8B5CF6) : const Color(0xFFF1F5F9)),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          item.icon,
                          size: 18,
                          color: isSelected || item.isHighlight ? Colors.white : const Color(0xFF64748B),
                        ),
                      ),
                      title: Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                                color: isSelected ? primaryColor : const Color(0xFF1E293B),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (item.badge != null) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: (item.badgeColor ?? primaryColor).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                item.badge!,
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: item.badgeColor ?? primaryColor,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      subtitle: Text(
                        item.subtitle,
                        style: TextStyle(
                          fontSize: 10,
                          color: isSelected ? primaryColor.withOpacity(0.85) : const Color(0xFF94A3B8),
                        ),
                      ),
                      onTap: () => onSelectMenuKey(item.key),
                    ),
                  );
                },
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
                subtitle: Text(
                  'Sesi: ${session.username}',
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                ),
                onTap: onLogout,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
