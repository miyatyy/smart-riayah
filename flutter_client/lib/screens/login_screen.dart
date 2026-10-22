import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../api_service.dart';

// ─── User Role Model ─────────────────────────────────────────────────────────
enum UserRole { musyrif, wali, admin, santri }

extension UserRoleExt on UserRole {
  String get label {
    switch (this) {
      case UserRole.musyrif: return 'Musyrif';
      case UserRole.wali:    return 'Wali Santri';
      case UserRole.admin:   return 'Admin';
      case UserRole.santri:  return 'Santri';
    }
  }

  String get description {
    switch (this) {
      case UserRole.musyrif: return 'Pengasuh & Evaluator Santri';
      case UserRole.wali:    return 'Orang Tua / Wali Santri';
      case UserRole.admin:   return 'Administrator Sistem';
      case UserRole.santri:  return 'Santri Pesantren';
    }
  }

  IconData get icon {
    switch (this) {
      case UserRole.musyrif: return Icons.supervisor_account_rounded;
      case UserRole.wali:    return Icons.family_restroom_rounded;
      case UserRole.admin:   return Icons.admin_panel_settings_rounded;
      case UserRole.santri:  return Icons.school_rounded;
    }
  }

  List<Color> get gradient {
    switch (this) {
      case UserRole.musyrif: return [const Color(0xFF047857), const Color(0xFF059669)];
      case UserRole.wali:    return [const Color(0xFF1D4ED8), const Color(0xFF3B82F6)];
      case UserRole.admin:   return [const Color(0xFF7C3AED), const Color(0xFF8B5CF6)];
      case UserRole.santri:  return [const Color(0xFFB45309), const Color(0xFFF59E0B)];
    }
  }

  Color get accentColor {
    switch (this) {
      case UserRole.musyrif: return const Color(0xFF059669);
      case UserRole.wali:    return const Color(0xFF3B82F6);
      case UserRole.admin:   return const Color(0xFF8B5CF6);
      case UserRole.santri:  return const Color(0xFFF59E0B);
    }
  }
}

// ─── Session Model ────────────────────────────────────────────────────────────
class AppSession {
  final String namaLengkap;
  final UserRole role;
  final String token;

  const AppSession({
    required this.namaLengkap,
    required this.role,
    required this.token,
  });
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
        case UserRole.musyrif:
          _userCtrl.text = 'musyrif01';
          _passCtrl.text = 'musyrif01';
          break;
        case UserRole.wali:
          _userCtrl.text = 'walisantri01';
          _passCtrl.text = 'walisantri01';
          break;
        case UserRole.admin:
          _userCtrl.text = 'superadmin';
          _passCtrl.text = 'superadmin01';
          break;
        case UserRole.santri:
          _userCtrl.text = 'santri';
          _passCtrl.text = 'santri123';
          break;
      }
    });
  }

  Future<void> _doLogin() async {
    if (_selectedRole == null) {
      setState(() => _errorMsg = 'Pilih role terlebih dahulu');
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
      backgroundColor: AppColors.emerald950,
      body: Stack(
        children: [
          // Background pattern
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
                      const SizedBox(height: 48),
                      _buildHeader(),
                      const SizedBox(height: 32),
                      _buildRoleSelector(),
                      const SizedBox(height: 24),
                      _buildLoginForm(),
                      const SizedBox(height: 24),
                      if (_errorMsg != null) _buildErrorMessage(),
                      if (_errorMsg != null) const SizedBox(height: 16),
                      _buildLoginButton(),
                      const SizedBox(height: 32),
                      _buildFooter(),
                      const SizedBox(height: 32),
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
        // Logo
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF047857), Color(0xFF059669)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppColors.emerald600.withValues(alpha: 0.4),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(
            Icons.mosque_rounded,
            color: Colors.white,
            size: 40,
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Smart Riayah',
          style: TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Pesantren Modern Darul Ulum',
          style: TextStyle(
            color: AppColors.emerald300,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.emerald600.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.emerald500.withValues(alpha: 0.3),
            ),
          ),
          child: const Text(
            'Sistem Manajemen Asrama Digital',
            style: TextStyle(
              color: AppColors.emerald300,
              fontSize: 11,
              fontWeight: FontWeight.w500,
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
            'Masuk sebagai',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.8,
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
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: isSelected
              ? LinearGradient(
                  colors: role.gradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: isSelected ? null : Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? role.accentColor.withValues(alpha: 0.8)
                : Colors.white.withValues(alpha: 0.12),
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: role.accentColor.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ]
              : [],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.2)
                    : Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                role.icon,
                color: Colors.white,
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
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    role.description,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.65),
                      fontSize: 9,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 16),
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
          // Username / Email field
          _buildTextField(
            controller: _userCtrl,
            label: 'Username / Email',
            hint: 'Masukkan username atau email',
            prefixIcon: Icons.person_rounded,
            keyboardType: TextInputType.emailAddress,
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Username tidak boleh kosong';
              return null;
            },
          ),
          const SizedBox(height: 12),
          // Password field
          _buildTextField(
            controller: _passCtrl,
            label: 'Password',
            hint: 'Masukkan password',
            prefixIcon: Icons.lock_rounded,
            obscureText: _obscurePass,
            suffixIcon: IconButton(
              onPressed: () => setState(() => _obscurePass = !_obscurePass),
              icon: Icon(
                _obscurePass ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                color: AppColors.emerald400,
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
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        TextFormField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.35), fontSize: 13),
            prefixIcon: Icon(prefixIcon, color: AppColors.emerald400, size: 20),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.08),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.emerald400, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.danger),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.danger),
            ),
            errorStyle: const TextStyle(color: AppColors.danger, fontSize: 11),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorMessage() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMsg!,
              style: const TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginButton() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _doLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.emerald600,
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
                        const Icon(Icons.login_rounded, size: 20),
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
          height: 42,
          child: OutlinedButton.icon(
            onPressed: () {
              final r = _selectedRole ?? UserRole.musyrif;
              final session = AppSession(
                namaLengkap: 'Demo (${r.label})',
                role: r,
                token: 'demo-bypass-${DateTime.now().millisecondsSinceEpoch}',
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
            icon: const Icon(Icons.flash_on_rounded, size: 16, color: AppColors.emerald400),
            label: Text(
              _selectedRole != null
                  ? 'Masuk Langsung Tanpa Password (${_selectedRole!.label})'
                  : 'Masuk Langsung (Mode Demo)',
              style: const TextStyle(
                color: AppColors.emerald300,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: AppColors.emerald500.withValues(alpha: 0.3)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.12))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'Smart Riayah v1.0.0',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 11),
              ),
            ),
            Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.12))),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'Pesantren Modern Darul Ulum • Sistem Terpadu',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.3),
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
      ..color = const Color(0xFF059669).withValues(alpha: 0.08)
      ..style = PaintingStyle.fill;
    final p2 = Paint()
      ..color = const Color(0xFF047857).withValues(alpha: 0.06)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(size.width * 0.85, size.height * 0.08), 140, p1);
    canvas.drawCircle(Offset(size.width * 0.1, size.height * 0.35), 100, p2);
    canvas.drawCircle(Offset(size.width * 0.5, size.height * 0.85), 160, p1);
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

    // Auto-navigate to dashboard after 2 seconds
    Future.delayed(const Duration(seconds: 2), () {
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
        transitionDuration: const Duration(milliseconds: 500),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.session.role;
    return Scaffold(
      backgroundColor: AppColors.emerald950,
      body: FadeTransition(
        opacity: _fadeAnim,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Role icon
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: role.gradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: role.accentColor.withValues(alpha: 0.4),
                      blurRadius: 32,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Icon(role.icon, color: Colors.white, size: 48),
              ),
              const SizedBox(height: 24),
              const Icon(Icons.check_circle_rounded, color: AppColors.emerald400, size: 32),
              const SizedBox(height: 12),
              Text(
                'Selamat datang,',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.session.namaLengkap,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: role.gradient),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  role.label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: role.accentColor,
                  strokeWidth: 2.5,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Memuat dashboard...',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
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
// Routes ke screen yang sesuai berdasarkan role
class DashboardRouterScreen extends StatelessWidget {
  final AppSession session;
  const DashboardRouterScreen({super.key, required this.session});

  @override
  Widget build(BuildContext context) {
    // HomeScreenWithSession didefinisikan di main.dart dan diimport via 'package:smart_riayah_mobile/main.dart'
    // Kita return Scaffold placeholder — Navigator akan handle routing
    // dari RoleSelectionScreen.goToDashboard()
    return _DashboardPlaceholder(session: session);
  }
}

class _DashboardPlaceholder extends StatelessWidget {
  final AppSession session;
  const _DashboardPlaceholder({required this.session});

  @override
  Widget build(BuildContext context) {
    // Immediately push to the real screen via post-frame callback
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
      backgroundColor: AppColors.emerald950,
      body: Center(
        child: CircularProgressIndicator(color: AppColors.emerald400),
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
