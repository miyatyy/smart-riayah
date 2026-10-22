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
  bool _isRoleSwitcherExpanded = false;

  List<MenuItemData> _getMenuItems(UserRole role) {
    switch (role) {
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
            label: 'Alarm Pantau',
            icon: Icons.notifications_active_rounded,
            badge: 'Live',
          ),
          MenuItemData(
            id: 'active_permits',
            label: 'Papan Real-Time',
            icon: Icons.dashboard_rounded,
            badge: 'Aktif',
          ),
          MenuItemData(
            id: 'points',
            label: 'Buku Poin & Adab',
            icon: Icons.military_tech_rounded,
            badge: 'Disiplin',
          ),
          MenuItemData(
            id: 'kamar',
            label: 'Inspeksi Kamar',
            icon: Icons.night_shelter_rounded,
            badge: 'Kamar',
          ),
          MenuItemData(
            id: 'ai_santri',
            label: 'AI Evaluasi Santri',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];

      case UserRole.wali:
        return const [
          MenuItemData(
            id: 'permit',
            label: 'Surat Izin Santri',
            icon: Icons.send_rounded,
            badge: 'Izin',
          ),
          MenuItemData(
            id: 'aktivitas',
            label: 'Aktivitas & Rapor AI',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
          MenuItemData(
            id: 'riayah',
            label: 'Poin Disiplin Ri\'ayah',
            icon: Icons.shield_rounded,
            badge: '100 Pts',
          ),
          MenuItemData(
            id: 'ibadah',
            label: 'Tahfidz & Ibadah',
            icon: Icons.menu_book_rounded,
            badge: 'Qur\'an',
          ),
          MenuItemData(
            id: 'cashless',
            label: 'Dompet RFID Santri',
            icon: Icons.credit_card_rounded,
            badge: 'Saldo',
          ),
          MenuItemData(
            id: 'kesehatan',
            label: 'Kesehatan (UKS)',
            icon: Icons.favorite_rounded,
            badge: 'Medis',
          ),
        ];

      case UserRole.admin:
        return const [
          MenuItemData(
            id: 'diagnostics',
            label: 'Diagnostik IoT Gate',
            icon: Icons.memory_rounded,
            badge: 'Live',
          ),
          MenuItemData(
            id: 'users',
            label: 'Kelola Akun & Role',
            icon: Icons.manage_accounts_rounded,
            badge: '7 Role',
          ),
          MenuItemData(
            id: 'rfid_cards',
            label: 'Manajemen Kartu RFID',
            icon: Icons.credit_card_rounded,
            badge: 'Tabel',
          ),
          MenuItemData(
            id: 'rfid_pairing',
            label: 'Scanner Pairing RFID',
            icon: Icons.nfc_rounded,
            badge: 'Scan',
          ),
          MenuItemData(
            id: 'gate_logs',
            label: 'Log Gerbang Masuk/Keluar',
            icon: Icons.history_rounded,
            badge: 'Log',
          ),
          MenuItemData(
            id: 'whatsapp_manager',
            label: 'WhatsApp Gateway (Fonnte)',
            icon: Icons.chat_rounded,
            badge: 'Gateway',
          ),
          MenuItemData(
            id: 'ai_analytics',
            label: 'AI Agent Analytics',
            icon: Icons.auto_awesome_rounded,
            badge: 'AI',
            isHighlight: true,
          ),
        ];

      case UserRole.santri:
        return const [
          MenuItemData(
            id: 'my_permit',
            label: 'Status Izin Saya',
            icon: Icons.assignment_turned_in_rounded,
            badge: 'Aktif',
          ),
          MenuItemData(
            id: 'my_rfid',
            label: 'Kartu RFID Digital',
            icon: Icons.credit_card_rounded,
            badge: 'NFC',
          ),
          MenuItemData(
            id: 'my_points',
            label: 'Buku Poin Pelanggaran',
            icon: Icons.star_rounded,
            badge: 'Disiplin',
          ),
          MenuItemData(
            id: 'my_activity',
            label: 'Jadwal & Ibadah Harian',
            icon: Icons.access_time_rounded,
          ),
          MenuItemData(
            id: 'ai_tanya',
            label: 'Tanya AI Pendamping',
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
      backgroundColor: const Color(0xFF0F172A), // Slate-900 luxury
      surfaceTintColor: Colors.transparent,
      elevation: 16,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ─── 1. Header Pesantren & Profil ─────────────────────────────
            _buildDrawerHeader(),

            // ─── 2. Role Switcher Dropdown (sama seperti di web) ──────────
            _buildRoleSwitcherSection(),

            const Divider(color: Color(0xFF1E293B), height: 1),

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
                            color: const Color(0xFF10B981).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: const Color(0xFF10B981).withValues(alpha: 0.3),
                            ),
                          ),
                          child: const Text(
                            'ONLINE',
                            style: TextStyle(
                              color: Color(0xFF34D399),
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
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF064E3B), Color(0xFF0F172A)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
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
              color: const Color(0xFF1E293B).withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: widget.session.role.accentColor.withValues(alpha: 0.25),
                  child: Text(
                    widget.session.namaLengkap.isNotEmpty
                        ? widget.session.namaLengkap[0].toUpperCase()
                        : 'U',
                    style: TextStyle(
                      color: widget.session.role.accentColor,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
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

  // ─── Role Switcher Dropdown (Konsep Sama Seperti di Web) ────────────────────
  Widget _buildRoleSwitcherSection() {
    return Container(
      color: const Color(0xFF0F172A),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _isRoleSwitcherExpanded = !_isRoleSwitcherExpanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.swap_horiz_rounded, color: Color(0xFF38BDF8), size: 18),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Ganti Role (Mode Simulasi Web)',
                      style: TextStyle(
                        color: Color(0xFFE2E8F0),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Icon(
                    _isRoleSwitcherExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: const Color(0xFF94A3B8),
                    size: 20,
                  ),
                ],
              ),
            ),
          ),

          if (_isRoleSwitcherExpanded)
            Container(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: UserRole.values.map((r) {
                  final isCurrent = r == widget.session.role;
                  return InkWell(
                    onTap: () {
                      Navigator.pop(context); // Tutup drawer
                      widget.onSwitchRole?.call(r);
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isCurrent
                            ? r.accentColor.withValues(alpha: 0.2)
                            : const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isCurrent
                              ? r.accentColor
                              : const Color(0xFF334155),
                          width: isCurrent ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(r.icon, size: 14, color: isCurrent ? r.accentColor : const Color(0xFF94A3B8)),
                          const SizedBox(width: 6),
                          Text(
                            r.label,
                            style: TextStyle(
                              color: isCurrent ? Colors.white : const Color(0xFFCBD5E1),
                              fontSize: 11,
                              fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
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
                  ? const Color(0xFF10B981).withValues(alpha: 0.15)
                  : (item.isHighlight
                      ? const Color(0xFF6366F1).withValues(alpha: 0.12)
                      : Colors.transparent),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected
                    ? const Color(0xFF10B981).withValues(alpha: 0.4)
                    : (item.isHighlight
                        ? const Color(0xFF6366F1).withValues(alpha: 0.3)
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
                        ? const Color(0xFF10B981)
                        : (item.isHighlight
                            ? const Color(0xFF6366F1)
                            : const Color(0xFF1E293B)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    item.icon,
                    size: 16,
                    color: isSelected || item.isHighlight
                        ? Colors.white
                        : const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(width: 12),

                // Label
                Expanded(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      color: isSelected
                          ? Colors.white
                          : (item.isHighlight
                              ? const Color(0xFFA5B4FC)
                              : const Color(0xFFE2E8F0)),
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
                          ? const Color(0xFFEF4444).withValues(alpha: 0.2)
                          : (item.isHighlight
                              ? const Color(0xFF6366F1).withValues(alpha: 0.25)
                              : const Color(0xFF334155)),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: item.isUrgent
                            ? const Color(0xFFEF4444).withValues(alpha: 0.5)
                            : (item.isHighlight
                                ? const Color(0xFF818CF8).withValues(alpha: 0.4)
                                : const Color(0xFF475569)),
                      ),
                    ),
                    child: Text(
                      item.badge!,
                      style: TextStyle(
                        color: item.isUrgent
                            ? const Color(0xFFFCA5A5)
                            : (item.isHighlight
                                ? const Color(0xFFC7D2FE)
                                : const Color(0xFF94A3B8)),
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
        color: const Color(0xFF1E293B).withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.wifi_rounded, color: Color(0xFF34D399), size: 14),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Hardware Gate IoT',
                  style: TextStyle(
                    color: Colors.white,
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
                      color: Color(0xFF10B981),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Text(
                    'ONLINE',
                    style: TextStyle(
                      color: Color(0xFF34D399),
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
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
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
        color: Color(0xFF0F172A),
        border: Border(
          top: BorderSide(color: Color(0xFF1E293B)),
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
              icon: const Icon(Icons.logout_rounded, size: 16, color: Color(0xFFEF4444)),
              label: const Text(
                'Keluar Akun',
                style: TextStyle(
                  color: Color(0xFFF87171),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Smart Riayah v1.0.0 • Mobile & Web Sync',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 10),
          ),
        ],
      ),
    );
  }
}
