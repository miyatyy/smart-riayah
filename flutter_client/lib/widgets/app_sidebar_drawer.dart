import 'package:flutter/material.dart';
import '../screens/login_screen.dart';

class MenuItemData {
  final String id;
  final String label;
  final IconData icon;
  final String? badge;
  final bool isHighlight;
  final bool isUrgent;

  const MenuItemData({
    required this.id,
    required this.label,
    required this.icon,
    this.badge,
    this.isHighlight = false,
    this.isUrgent = false,
  });
}

class AppSidebarDrawer extends StatefulWidget {
  final AppSession session;
  final String currentRoute;
  final Function(String routeId) onSelectMenu;
  final Function(UserRole newRole)? onSwitchRole;
  final VoidCallback onLogout;

  const AppSidebarDrawer({
    super.key,
    required this.session,
    required this.currentRoute,
    required this.onSelectMenu,
    this.onSwitchRole,
    required this.onLogout,
  });

  @override
  State<AppSidebarDrawer> createState() => _AppSidebarDrawerState();
}

class _AppSidebarDrawerState extends State<AppSidebarDrawer> {
  List<MenuItemData> _getMenuItems(UserRole role) {
    switch (role) {
      case UserRole.santri:
        return const [
          MenuItemData(
            id: 'my_permit',
            label: 'Status Izin',
            icon: Icons.assignment_turned_in_rounded,
            badge: 'Aktif',
          ),
          MenuItemData(
            id: 'riwayat_izin',
            label: 'Riwayat Izin',
            icon: Icons.history_edu_rounded,
            badge: 'Arsip',
          ),
          MenuItemData(
            id: 'my_rfid',
            label: 'Kartu RFID',
            icon: Icons.credit_card_rounded,
            badge: 'RFID',
          ),
          MenuItemData(
            id: 'my_points',
            label: 'Poin & Disiplin',
            icon: Icons.military_tech_rounded,
            badge: '100 Pts',
          ),
          MenuItemData(
            id: 'my_activity',
            label: 'Mutaba\'ah',
            icon: Icons.access_time_rounded,
            badge: 'Sholat',
          ),
          MenuItemData(
            id: 'ai_tanya',
            label: 'AI Santri',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];

      case UserRole.wali:
        return const [
          MenuItemData(
            id: 'permit_form',
            label: 'Ajukan Izin',
            icon: Icons.send_rounded,
            badge: 'Baru',
            isUrgent: true,
          ),
          MenuItemData(
            id: 'riwayat_izin',
            label: 'Riwayat Izin',
            icon: Icons.history_edu_rounded,
            badge: 'Lihat',
          ),
          MenuItemData(
            id: 'chat_admin',
            label: 'Chat Admin',
            icon: Icons.chat_rounded,
            badge: 'Online',
            isHighlight: true,
          ),
          MenuItemData(
            id: 'aktivitas',
            label: 'Rapor Santri',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
          MenuItemData(
            id: 'riayah',
            label: 'Poin Disiplin',
            icon: Icons.shield_rounded,
            badge: '100 Pts',
          ),
          MenuItemData(
            id: 'cashless',
            label: 'Dompet RFID',
            icon: Icons.credit_card_rounded,
            badge: 'Saldo',
          ),
        ];

      case UserRole.mudir:
        return const [
          MenuItemData(
            id: 'diagram_mudir',
            label: 'Grafik Tren',
            icon: Icons.analytics_rounded,
            badge: 'Grafik',
            isHighlight: true,
          ),
          MenuItemData(
            id: 'ringkasan',
            label: 'Ringkasan',
            icon: Icons.trending_up_rounded,
            badge: 'Eksekutif',
          ),
          MenuItemData(
            id: 'riwayat_izin',
            label: 'Audit Izin',
            icon: Icons.history_edu_rounded,
            badge: 'Semua',
          ),
          MenuItemData(
            id: 'rapor_adab',
            label: 'Rapor Adab',
            icon: Icons.military_tech_rounded,
            badge: 'Nilai',
          ),
          MenuItemData(
            id: 'dss_pimpinan',
            label: 'DSS AI',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];

      case UserRole.musyrif:
        return const [
          MenuItemData(
            id: 'approval',
            label: 'Otorisasi Izin',
            icon: Icons.verified_user_rounded,
            badge: 'Pending',
            isUrgent: true,
          ),
          MenuItemData(
            id: 'alarm_monitor',
            label: 'Alarm Malam',
            icon: Icons.notifications_active_rounded,
            badge: 'Live',
          ),
          MenuItemData(
            id: 'active_permits',
            label: 'Status Asrama',
            icon: Icons.dashboard_rounded,
            badge: 'Aktif',
          ),
          MenuItemData(
            id: 'riwayat_izin',
            label: 'Riwayat Izin',
            icon: Icons.history_edu_rounded,
            badge: 'Rekap',
          ),
          MenuItemData(
            id: 'kamar',
            label: 'Kamar Santri',
            icon: Icons.night_shelter_rounded,
            badge: 'Kamar',
          ),
          MenuItemData(
            id: 'ai_santri',
            label: 'AI Evaluasi',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];

      case UserRole.adminRiayah:
        return const [
          MenuItemData(
            id: 'riwayat_izin',
            label: 'Kelola Izin',
            icon: Icons.history_edu_rounded,
            badge: 'Master',
          ),
          MenuItemData(
            id: 'chat_admin',
            label: 'Chat Wali',
            icon: Icons.forum_rounded,
            badge: 'Fonnte',
            isHighlight: true,
          ),
          MenuItemData(
            id: 'kamar',
            label: 'Data Kamar',
            icon: Icons.night_shelter_rounded,
            badge: 'Asrama',
          ),
          MenuItemData(
            id: 'rfid_cards',
            label: 'Kartu RFID',
            icon: Icons.credit_card_rounded,
            badge: 'Tabel',
          ),
          MenuItemData(
            id: 'gate_logs',
            label: 'Log Gerbang',
            icon: Icons.history_rounded,
            badge: 'Gate 01',
          ),
          MenuItemData(
            id: 'ai_analytics',
            label: 'AI Ri\'ayah',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];

      case UserRole.superAdmin:
        return const [
          MenuItemData(
            id: 'diagnostics',
            label: 'Diagnostik IoT',
            icon: Icons.memory_rounded,
            badge: 'ESP32',
          ),
          MenuItemData(
            id: 'users',
            label: 'Kelola Akun',
            icon: Icons.manage_accounts_rounded,
            badge: '7 Role',
          ),
          MenuItemData(
            id: 'diagram_mudir',
            label: 'Grafik Analitik',
            icon: Icons.analytics_rounded,
            badge: 'Grafik',
          ),
          MenuItemData(
            id: 'rfid_pairing',
            label: 'Pairing RFID',
            icon: Icons.nfc_rounded,
            badge: 'Scan',
          ),
          MenuItemData(
            id: 'riwayat_izin',
            label: 'Data Izin',
            icon: Icons.history_edu_rounded,
            badge: 'DB',
          ),
          MenuItemData(
            id: 'ai_analytics',
            label: 'AI DeepSeek',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];

      case UserRole.security:
        return const [
          MenuItemData(
            id: 'diagnostics',
            label: 'Tap Gerbang',
            icon: Icons.security_rounded,
            badge: 'Gate 01',
            isUrgent: true,
          ),
          MenuItemData(
            id: 'active_permits',
            label: 'Santri Luar',
            icon: Icons.people_outline_rounded,
            badge: 'Live',
          ),
          MenuItemData(
            id: 'riwayat_izin',
            label: 'Verifikasi QR',
            icon: Icons.qr_code_scanner_rounded,
            badge: 'Scan',
          ),
          MenuItemData(
            id: 'gate_logs',
            label: 'Log Gerbang',
            icon: Icons.history_rounded,
            badge: 'Audit',
          ),
          MenuItemData(
            id: 'ai_santri',
            label: 'AI Security',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final menuItems = _getMenuItems(widget.session.role);

    return Drawer(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 8,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ─── 1. Header Pesantren & Profil ─────────────────────────────
            _buildDrawerHeader(),

            // ─── 2. Role Switcher Dropdown (sama seperti di web) ──────────
            _buildRoleSwitcherSection(),

            const Divider(color: Color(0xFFE2E8F0), height: 1),

            // ─── 3. Menu Navigasi Sesuai Role ─────────────────────────────
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'MENU ${widget.session.role.label.toUpperCase()}',
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: const Color(0xFFA7F3D0),
                            ),
                          ),
                          child: const Text(
                            'ONLINE',
                            style: TextStyle(
                              color: Color(0xFF059669),
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  ...menuItems.map((item) => _buildMenuItem(item)),

                  const SizedBox(height: 16),

                  // ─── 4. Hardware IoT Status Card (ESP32 Gate 01) ───────────
                  _buildIotStatusCard(),

                  const SizedBox(height: 20),
                ],
              ),
            ),

            // ─── 5. Footer: Profile & Logout ──────────────────────────────
            _buildDrawerFooter(),
          ],
        ),
      ),
    );
  }

  // ─── Drawer Header ──────────────────────────────────────────────────────────
  Widget _buildDrawerHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF065F46), Color(0xFF047857)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF059669), Color(0xFF10B981)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF10B981).withValues(alpha: 0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: const Icon(Icons.mosque_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Smart Riayah',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                    ),
                    Text(
                      'Pesantren Modern Darul Ulum',
                      style: TextStyle(
                        color: Color(0xFF6EE7B7),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8), size: 20),
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.06),
                  padding: const EdgeInsets.all(6),
                  minimumSize: const Size(32, 32),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // User info card inside header
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 19,
                  backgroundColor: widget.session.role.accentColor.withValues(alpha: 0.25),
                  backgroundImage: (widget.session.photoUrl != null && widget.session.photoUrl!.isNotEmpty)
                      ? NetworkImage(widget.session.photoUrl!)
                      : null,
                  child: (widget.session.photoUrl == null || widget.session.photoUrl!.isEmpty)
                      ? Text(
                          widget.session.namaLengkap.isNotEmpty
                              ? widget.session.namaLengkap[0].toUpperCase()
                              : 'U',
                          style: TextStyle(
                            color: widget.session.role.accentColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.session.namaLengkap,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: widget.session.role.accentColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            widget.session.role.label,
                            style: TextStyle(
                              color: widget.session.role.accentColor,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (widget.session.email != null) ...[
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                '• ${widget.session.email!}',
                                style: const TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Dinding Privasi 7 Role & Beralih Role Via Login ─────────────────────────
  Widget _buildRoleSwitcherSection() {
    final role = widget.session.role;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: role.accentColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.shield_rounded, color: role.accentColor, size: 14),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'SEKAT PRIVASI ROLE AKTIF',
                      style: TextStyle(
                        color: Color(0xFF64748B),
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                      ),
                    ),
                    Text(
                      role.label,
                      style: TextStyle(
                        color: role.accentColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.lock_rounded, size: 9, color: Color(0xFF059669)),
                    SizedBox(width: 3),
                    Text(
                      'TERKUNCI',
                      style: TextStyle(color: Color(0xFF047857), fontSize: 8.5, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Data & fitur dibatasi ketat untuk privasi role ini. Masuk ke role lain memerlukan otentikasi login kembali.',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 10, height: 1.3),
          ),
          const SizedBox(height: 10),
          InkWell(
            onTap: () => _showSwitchRoleDialog(context),
            borderRadius: BorderRadius.circular(10),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.swap_horizontal_circle_outlined, color: Color(0xFF0284C7), size: 15),
                  SizedBox(width: 6),
                  Text(
                    'Beralih Role (Login Akun Lain)',
                    style: TextStyle(
                      color: Color(0xFF0284C7),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showSwitchRoleDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.lock_person_rounded, color: Color(0xFF0284C7), size: 22),
            SizedBox(width: 10),
            Text(
              'Sekat Keamanan 7 Role',
              style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        content: const Text(
          'Untuk menjaga privasi dan kerahasiaan data santri antar 7 role, Anda akan dialihkan kembali ke Halaman Login untuk memverifikasi akun role yang dituju.',
          style: TextStyle(color: Color(0xFF475569), fontSize: 12.5, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx); // Tutup dialog
              Navigator.pop(context); // Tutup drawer
              widget.onLogout(); // Langsung bawa ke halaman login
            },
            icon: const Icon(Icons.login_rounded, size: 16),
            label: const Text('Ke Halaman Login'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Menu Item Tile ─────────────────────────────────────────────────────────
  Widget _buildMenuItem(MenuItemData item) {
    final isSelected = widget.currentRoute == item.id;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.of(context).pop(); // Tutup drawer
            widget.onSelectMenu(item.id);
          },
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: isSelected
                  ? const Color(0xFFECFDF5)
                  : (item.isHighlight
                      ? const Color(0xFFEFF6FF)
                      : Colors.transparent),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected
                    ? const Color(0xFFA7F3D0)
                    : (item.isHighlight
                        ? const Color(0xFFBFDBFE)
                        : Colors.transparent),
              ),
            ),
            child: Row(
              children: [
                // Icon box
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFF059669)
                        : (item.isHighlight
                            ? const Color(0xFF2563EB)
                            : const Color(0xFFF1F5F9)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    item.icon,
                    size: 16,
                    color: isSelected || item.isHighlight
                        ? Colors.white
                        : const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(width: 12),

                // Label
                Expanded(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      color: isSelected
                          ? const Color(0xFF065F46)
                          : (item.isHighlight
                              ? const Color(0xFF1D4ED8)
                              : const Color(0xFF334155)),
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),

                // Badge jika ada
                if (item.badge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: item.isUrgent
                          ? const Color(0xFFFEF2F2)
                          : (item.isHighlight
                              ? const Color(0xFFEFF6FF)
                              : const Color(0xFFF1F5F9)),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: item.isUrgent
                            ? const Color(0xFFFECACA)
                            : (item.isHighlight
                                ? const Color(0xFFBFDBFE)
                                : const Color(0xFFE2E8F0)),
                      ),
                    ),
                    child: Text(
                      item.badge!,
                      style: TextStyle(
                        color: item.isUrgent
                            ? const Color(0xFFDC2626)
                            : (item.isHighlight
                                ? const Color(0xFF2563EB)
                                : const Color(0xFF64748B)),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ─── IoT Hardware Status Card (ESP32 Gate) ──────────────────────────────────
  Widget _buildIotStatusCard() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.wifi_rounded, color: Color(0xFF059669), size: 14),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Hardware Gate IoT',
                  style: TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0xFF059669),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Text(
                    'ONLINE',
                    style: TextStyle(
                      color: Color(0xFF059669),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'NodeMCU ESP32 • Gate 01 Utama',
            style: TextStyle(color: Color(0xFF475569), fontSize: 11),
          ),
          const Text(
            'RFID RC522: Siap Tap Kartu Santri',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 10),
          ),
        ],
      ),
    );
  }

  // ─── Footer: Logout & Version ───────────────────────────────────────────────
  Widget _buildDrawerFooter() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        border: Border(
          top: BorderSide(color: Color(0xFFE2E8F0)),
        ),
      ),
      child: Column(
        children: [
          // Logout button
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton.icon(
              onPressed: widget.onLogout,
              icon: const Icon(Icons.logout_rounded, size: 16, color: Color(0xFFDC2626)),
              label: const Text(
                'Keluar Akun',
                style: TextStyle(
                  color: Color(0xFFDC2626),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFFCA5A5)),
                backgroundColor: const Color(0xFFFEF2F2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Smart Riayah v1.0.0 • Mobile & Web Sync',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
          ),
        ],
      ),
    );
  }
}
