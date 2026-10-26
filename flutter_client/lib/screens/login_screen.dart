import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../api_service.dart';

// ─── User Role Model (7 Roles Lengkap Sesuai Web) ────────────────────────────
enum UserRole {
  santri,
  wali,
  mudir,
  musyrif,
  adminRiayah,
  superAdmin,
  security,
}

extension UserRoleExt on UserRole {
  String get label {
    switch (this) {
      case UserRole.santri:      return 'Santri';
      case UserRole.wali:        return 'Wali Santri';
      case UserRole.mudir:       return 'Mudir / Kyai';
      case UserRole.musyrif:     return 'Musyrif';
      case UserRole.adminRiayah: return 'Admin Ri\'ayah';
      case UserRole.superAdmin:  return 'Super Admin';
      case UserRole.security:    return 'Satpam Gate';
    }
  }

  String get description {
    switch (this) {
      case UserRole.santri:      return 'Santri Aktif (Nurmiyaty)';
      case UserRole.wali:        return 'Orang Tua / Wali Santri';
      case UserRole.mudir:       return 'Pimpinan & DSS Analytics';
      case UserRole.musyrif:     return 'Pengasuh & Evaluasi Adab';
      case UserRole.adminRiayah: return 'Administrasi Izin Asrama';
      case UserRole.superAdmin:  return 'Sistem IT & IoT Smart Gate';
      case UserRole.security:    return 'Keamanan Gerbang & RFID';
    }
  }

  IconData get icon {
    switch (this) {
      case UserRole.santri:      return Icons.school_outlined;
      case UserRole.wali:        return Icons.people_outline;
      case UserRole.mudir:       return Icons.account_balance_outlined;
      case UserRole.musyrif:     return Icons.supervisor_account_outlined;
      case UserRole.adminRiayah: return Icons.admin_panel_settings_outlined;
      case UserRole.superAdmin:  return Icons.laptop_chromebook_outlined;
      case UserRole.security:    return Icons.security_outlined;
    }
  }

  List<Color> get gradient {
    switch (this) {
      case UserRole.santri:      return [const Color(0xFF059669), const Color(0xFF10B981)];
      case UserRole.wali:        return [const Color(0xFF0D9488), const Color(0xFF14B8A6)];
      case UserRole.mudir:       return [const Color(0xFFD97706), const Color(0xFFF59E0B)];
      case UserRole.musyrif:     return [const Color(0xFF4F46E5), const Color(0xFF6366F1)];
      case UserRole.adminRiayah: return [const Color(0xFF047857), const Color(0xFF059669)];
      case UserRole.superAdmin:  return [const Color(0xFF0284C7), const Color(0xFF0EA5E9)];
      case UserRole.security:    return [const Color(0xFFD97706), const Color(0xFFF59E0B)];
    }
  }

  Color get accentColor {
    switch (this) {
      case UserRole.santri:      return const Color(0xFF059669);
      case UserRole.wali:        return const Color(0xFF0D9488);
      case UserRole.mudir:       return const Color(0xFFD97706);
      case UserRole.musyrif:     return const Color(0xFF4F46E5);
      case UserRole.adminRiayah: return const Color(0xFF047857);
      case UserRole.superAdmin:  return const Color(0xFF0284C7);
      case UserRole.security:    return const Color(0xFFD97706);
    }
  }
}

// ─── Session Model ────────────────────────────────────────────────────────────
class AppSession {
  final String namaLengkap;
  final UserRole role;
  final String token;
  final String? email;
  final String? photoUrl;

  const AppSession({
    required this.namaLengkap,
    required this.role,
    required this.token,
    this.email,
    this.photoUrl,
  });

  AppSession copyWith({
    String? namaLengkap,
    UserRole? role,
    String? token,
    String? email,
    String? photoUrl,
  }) {
    return AppSession(
      namaLengkap: namaLengkap ?? this.namaLengkap,
      role: role ?? this.role,
      token: token ?? this.token,
      email: email ?? this.email,
      photoUrl: photoUrl ?? this.photoUrl,
    );
  }
}


// ─── Login Screen ─────────────────────────────────────────────────────────────
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  UserRole? _selectedRole;
  bool _obscurePass = true;
  bool _isLoading = false;
  String? _errorMsg;

  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut));
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  void _selectRole(UserRole role) {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedRole = role;
      _errorMsg = null;
      // Isi otomatis kredensial aktif dari database
      switch (role) {
        case UserRole.santri:
          _userCtrl.text = 'nurmiyaty';
          _passCtrl.text = 'nurmiyaty123';
          break;
        case UserRole.wali:
          _userCtrl.text = 'walisantri01';
          _passCtrl.text = 'walisantri01';
          break;
        case UserRole.mudir:
          _userCtrl.text = 'mudir01';
          _passCtrl.text = 'mudir01';
          break;
        case UserRole.musyrif:
          _userCtrl.text = 'musyrif01';
          _passCtrl.text = 'musyrif01';
          break;
        case UserRole.adminRiayah:
          _userCtrl.text = 'riayah01';
          _passCtrl.text = 'riayah01';
          break;
        case UserRole.superAdmin:
          _userCtrl.text = 'superadmin';
          _passCtrl.text = 'superadmin01';
          break;
        case UserRole.security:
          _userCtrl.text = 'satpam01';
          _passCtrl.text = 'satpam01';
          break;
      }
    });
  }

  Future<void> _doLogin() async {
    final inputUser = _userCtrl.text.trim().toLowerCase();
    if (inputUser == 'mnurmiyaty2@gmail.com') {
      _loginViaGoogleAccount('mnurmiyaty2@gmail.com');
      return;
    }
    if (inputUser == 'nurmiyaty.14@gmail.com') {
      _loginViaGoogleAccount('nurmiyaty.14@gmail.com');
      return;
    }

    if (_selectedRole == null) {
      setState(() => _errorMsg = 'Pilih role terlebih dahulu atau Masuk dengan Google');
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });

    try {
      final session = await SmartRiayahApiService.login(
        username: _userCtrl.text.trim(),
        password: _passCtrl.text,
        role: _selectedRole!,
      );

      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (_, anim, __) => RoleSelectionScreen(session: session),
          transitionsBuilder: (_, anim, __, child) =>
              FadeTransition(opacity: anim, child: child),
          transitionDuration: const Duration(milliseconds: 400),
        ),
      );
    } catch (e) {
      setState(() => _errorMsg = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          // Background subtle pattern
          _buildBackground(),
          // Content
          SafeArea(
            child: FadeTransition(
              opacity: _fadeAnim,
              child: SlideTransition(
                position: _slideAnim,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    children: [
                      const SizedBox(height: 36),
                      _buildHeader(),
                      const SizedBox(height: 28),
                      _buildRoleSelector(),
                      const SizedBox(height: 24),
                      _buildLoginForm(),
                      const SizedBox(height: 20),
                      if (_errorMsg != null) _buildErrorMessage(),
                      if (_errorMsg != null) const SizedBox(height: 16),
                      _buildLoginButton(),
                      const SizedBox(height: 28),
                      _buildFooter(),
                      const SizedBox(height: 28),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackground() {
    return Positioned.fill(
      child: CustomPaint(painter: _BgPainter()),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        // Simple Clean Logo
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: const Color(0xFF059669),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF059669).withValues(alpha: 0.25),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Icon(
            Icons.mosque_outlined,
            color: Colors.white,
            size: 38,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Smart Riayah',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontSize: 26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Pesantren Modern Darul Ulum',
          style: TextStyle(
            color: Color(0xFF059669),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: const Color(0xFFA7F3D0),
            ),
          ),
          child: const Text(
            'Sistem Manajemen Asrama Digital',
            style: TextStyle(
              color: Color(0xFF065F46),
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRoleSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 12),
          child: Text(
            'Pilih Role Anda',
            style: TextStyle(
              color: Color(0xFF0F172A),
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.85,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: UserRole.values.map((role) => _buildRoleCard(role)).toList(),
        ),
      ],
    );
  }

  Widget _buildRoleCard(UserRole role) {
    final isSelected = _selectedRole == role;
    return GestureDetector(
      onTap: () => _selectRole(role),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFECFDF5) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF059669)
                : const Color(0xFFE2E8F0),
            width: isSelected ? 1.8 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? const Color(0xFF059669).withValues(alpha: 0.12)
                  : Colors.black.withValues(alpha: 0.03),
              blurRadius: isSelected ? 10 : 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFF059669)
                    : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                role.icon,
                color: isSelected ? Colors.white : const Color(0xFF475569),
                size: 18,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    role.label,
                    style: TextStyle(
                      color: isSelected ? const Color(0xFF065F46) : const Color(0xFF0F172A),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    role.description,
                    style: TextStyle(
                      color: isSelected ? const Color(0xFF047857) : const Color(0xFF64748B),
                      fontSize: 9.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          // Username field
          _buildTextField(
            controller: _userCtrl,
            label: 'Username / Email',
            hint: 'Masukkan username',
            prefixIcon: Icons.person_outline,
            keyboardType: TextInputType.emailAddress,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Username tidak boleh kosong';
              return null;
            },
          ),
          const SizedBox(height: 14),
          // Password field
          _buildTextField(
            controller: _passCtrl,
            label: 'Password',
            hint: 'Masukkan password',
            prefixIcon: Icons.lock_outline,
            obscureText: _obscurePass,
            suffixIcon: IconButton(
              onPressed: () => setState(() => _obscurePass = !_obscurePass),
              icon: Icon(
                _obscurePass ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                color: const Color(0xFF64748B),
                size: 20,
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Password tidak boleh kosong';
              if (v.length < 4) return 'Password minimal 4 karakter';
              return null;
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData prefixIcon,
    TextInputType? keyboardType,
    bool obscureText = false,
    Widget? suffixIcon,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 6),
          child: Text(
            label,
            style: const TextStyle(
              color: Color(0xFF334155),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w500),
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            prefixIcon: Icon(prefixIcon, color: const Color(0xFF059669), size: 20),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFF059669), width: 1.8),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFEF4444)),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFEF4444)),
            ),
            errorStyle: const TextStyle(color: Color(0xFFEF4444), fontSize: 11),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorMessage() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMsg!,
              style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginButton() {
    return Column(
      children: [
        // ─── Google Official Sign-In Button (Priority) ───────────────────────
        _buildGoogleSignInButton(),

        const Row(
          children: [
            Expanded(child: Divider(color: Color(0xFFE2E8F0))),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 10),
              child: Text(
                'ATAU LOGIN MANUAL',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            Expanded(child: Divider(color: Color(0xFFE2E8F0))),
          ],
        ),
        const SizedBox(height: 14),

        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _doLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              padding: EdgeInsets.zero,
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: _isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.login, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          _selectedRole != null
                              ? 'Masuk sebagai ${_selectedRole!.label}'
                              : 'Masuk ke Smart Riayah',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          height: 44,
          child: OutlinedButton.icon(
            onPressed: () {
              final r = _selectedRole ?? UserRole.santri;
              final session = AppSession(
                namaLengkap: r == UserRole.santri
                    ? 'Nurmiyaty'
                    : (r == UserRole.wali ? 'Hj. Mardiah (Wali Nurmiyaty)' : 'Demo (${r.label})'),
                role: r,
                token: 'demo-bypass-${DateTime.now().millisecondsSinceEpoch}',
                email: r == UserRole.santri
                    ? 'mnurmiyaty2@gmail.com'
                    : (r == UserRole.wali ? 'nurmiyaty.14@gmail.com' : null),
              );
              Navigator.of(context).pushReplacement(
                PageRouteBuilder(
                  pageBuilder: (_, anim, __) => RoleSelectionScreen(session: session),
                  transitionsBuilder: (_, anim, __, child) =>
                      FadeTransition(opacity: anim, child: child),
                  transitionDuration: const Duration(milliseconds: 400),
                ),
              );
            },
            icon: const Icon(Icons.bolt, size: 18, color: Color(0xFF059669)),
            label: Text(
              _selectedRole != null
                  ? 'Masuk Langsung (${_selectedRole!.label})'
                  : 'Masuk Langsung (Santri)',
              style: const TextStyle(
                color: Color(0xFF059669),
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFCBD5E1)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              backgroundColor: Colors.white,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGoogleSignInButton() {
    return Container(
      width: double.infinity,
      height: 48,
      margin: const EdgeInsets.only(bottom: 12),
      child: OutlinedButton(
        onPressed: _showGoogleAccountPickerModal,
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          backgroundColor: Colors.white,
          elevation: 1,
          shadowColor: Colors.black.withValues(alpha: 0.05),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildGoogleGLogo(),
            const SizedBox(width: 12),
            const Text(
              'Masuk dengan Akun Google Resmi',
              style: TextStyle(
                color: Color(0xFF1E293B),
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGoogleGLogo() {
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Center(
        child: Text(
          'G',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            foreground: Paint()
              ..shader = const LinearGradient(
                colors: [Color(0xFF4285F4), Color(0xFFEA4335), Color(0xFFFBBC05), Color(0xFF34A853)],
              ).createShader(const Rect.fromLTWH(0.0, 0.0, 24.0, 24.0)),
          ),
        ),
      ),
    );
  }

  void _showGoogleAccountPickerModal() {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  _buildGoogleGLogo(),
                  const SizedBox(width: 10),
                  const Text(
                    'Pilih Akun Google Resmi',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Terhubung langsung ke Cloud Vercel & Supabase Smart Riayah',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
              ),
              const SizedBox(height: 20),

              // Akun 1: Santri
              _buildGoogleAccountTile(
                name: 'Nurmiyaty',
                email: 'mnurmiyaty2@gmail.com',
                roleLabel: 'Santri Aktif',
                roleColor: const Color(0xFF059669),
                initial: 'N',
                badgeText: 'Kamar Khadijah RF-103',
                onTap: () {
                  Navigator.pop(ctx);
                  _loginViaGoogleAccount('mnurmiyaty2@gmail.com');
                },
              ),
              const SizedBox(height: 12),

              // Akun 2: Wali Santri
              _buildGoogleAccountTile(
                name: 'Hj. Mardiah (Wali Nurmiyaty)',
                email: 'nurmiyaty.14@gmail.com',
                roleLabel: 'Wali Santri Resmi',
                roleColor: const Color(0xFF0D9488),
                initial: 'W',
                badgeText: 'Orang Tua / Wali Santri',
                onTap: () {
                  Navigator.pop(ctx);
                  _loginViaGoogleAccount('nurmiyaty.14@gmail.com');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGoogleAccountTile({
    required String name,
    required String email,
    required String roleLabel,
    required Color roleColor,
    required String initial,
    required String badgeText,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: roleColor,
              child: Text(
                initial,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          name,
                          style: const TextStyle(
                            color: Color(0xFF0F172A),
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: roleColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          roleLabel,
                          style: TextStyle(
                            color: roleColor,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    email,
                    style: const TextStyle(color: Color(0xFF2563EB), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    badgeText,
                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 10.5),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF94A3B8), size: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _loginViaGoogleAccount(String googleEmail) async {
    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });

    try {
      final session = await SmartRiayahApiService.loginWithGoogle(googleEmail);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Terhubung sebagai ${session.namaLengkap} (${session.role.label})'),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF059669),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );

      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (_, anim, __) => RoleSelectionScreen(session: session),
          transitionsBuilder: (_, anim, __, child) =>
              FadeTransition(opacity: anim, child: child),
          transitionDuration: const Duration(milliseconds: 400),
        ),
      );
    } catch (e) {
      setState(() => _errorMsg = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildFooter() {
    return const Column(
      children: [
        Row(
          children: [
            Expanded(child: Divider(color: Color(0xFFE2E8F0))),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'Smart Riayah v1.0.0',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
            ),
            Expanded(child: Divider(color: Color(0xFFE2E8F0))),
          ],
        ),
        SizedBox(height: 10),
        Text(
          'Pesantren Modern Darul Ulum • Sistem Terpadu',
          style: TextStyle(
            color: Color(0xFF64748B),
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}

// ─── Background Painter ───────────────────────────────────────────────────────
class _BgPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p1 = Paint()
      ..color = const Color(0xFF059669).withValues(alpha: 0.04)
      ..style = PaintingStyle.fill;
    final p2 = Paint()
      ..color = const Color(0xFF10B981).withValues(alpha: 0.03)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(size.width * 0.85, size.height * 0.08), 160, p1);
    canvas.drawCircle(Offset(size.width * 0.1, size.height * 0.35), 120, p2);
    canvas.drawCircle(Offset(size.width * 0.6, size.height * 0.85), 180, p1);
  }

  @override
  bool shouldRepaint(_BgPainter _) => false;
}

// ─── Role Selection / Dashboard Router ───────────────────────────────────────
class RoleSelectionScreen extends StatefulWidget {
  final AppSession session;
  const RoleSelectionScreen({super.key, required this.session});

  @override
  State<RoleSelectionScreen> createState() => _RoleSelectionScreenState();
}

class _RoleSelectionScreenState extends State<RoleSelectionScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();

    // Auto-navigate to dashboard after 1.5 seconds
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) _goToDashboard();
    });
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  void _goToDashboard() {
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, anim, __) => DashboardRouterScreen(session: widget.session),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.role;
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: FadeTransition(
        opacity: _fadeAnim,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Clean Role icon
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFF059669), width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF059669).withValues(alpha: 0.15),
                      blurRadius: 20,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Icon(role.icon, color: const Color(0xFF059669), size: 44),
              ),
              const SizedBox(height: 20),
              const Icon(Icons.check_circle_outline, color: Color(0xFF059669), size: 30),
              const SizedBox(height: 10),
              const Text(
                'Selamat datang,',
                style: TextStyle(
                  color: Color(0xFF64748B),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.session.namaLengkap,
                style: const TextStyle(
                  color: Color(0xFF0F172A),
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Text(
                  role.label,
                  style: const TextStyle(
                    color: Color(0xFF065F46),
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 28),
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: Color(0xFF059669),
                  strokeWidth: 2.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Memuat antarmuka...',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Dashboard Router ─────────────────────────────────────────────────────────
class DashboardRouterScreen extends StatelessWidget {
  final AppSession session;
  const DashboardRouterScreen({super.key, required this.session});

  @override
  Widget build(BuildContext context) {
    return _DashboardPlaceholder(session: session);
  }
}

class _DashboardPlaceholder extends StatelessWidget {
  final AppSession session;
  const _DashboardPlaceholder({required this.session});

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.mounted) {
        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (_, __, ___) =>
                _SessionHomeScreenStub(session: session),
            transitionDuration: Duration.zero,
          ),
        );
      }
    });
    return const Scaffold(
      backgroundColor: Color(0xFFF8FAFC),
      body: Center(
        child: CircularProgressIndicator(color: Color(0xFF059669)),
      ),
    );
  }
}

// Stub yang akan di-override dari main.dart saat runtime
// Kita gunakan builder pattern agar login_screen.dart tidak perlu import main.dart
typedef HomeScreenBuilder = Widget Function(AppSession session);

HomeScreenBuilder _homeScreenBuilder = (session) =>
    _FallbackHomeScreen(session: session);

void registerHomeScreenBuilder(HomeScreenBuilder builder) {
  _homeScreenBuilder = builder;
}

class _SessionHomeScreenStub extends StatelessWidget {
  final AppSession session;
  const _SessionHomeScreenStub({required this.session});

  @override
  Widget build(BuildContext context) =>
      _homeScreenBuilder(session);
}

class _FallbackHomeScreen extends StatelessWidget {
  final AppSession session;
  const _FallbackHomeScreen({required this.session});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(session.role.icon, size: 64, color: session.role.accentColor),
            const SizedBox(height: 16),
            Text(
              'Selamat datang, ${session.namaLengkap}',
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              session.role.label,
              style: TextStyle(color: session.role.accentColor),
            ),
          ],
        ),
      ),
    );
  }
}
