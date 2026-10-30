import 'package:flutter/material.dart';
import '../../models/user_session_model.dart';
import '../../services/session_service.dart';
import '../main_dashboard_screen.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - DYNAMIC LOGIN SCREEN (100% IDENTIK DENGAN WEB)
 * - Latar belakang gradien ambient halus slate & emerald
 * - Kartu putih melengkung elegan dengan border halus & bayangan lembut
 * - Logo Building2 hijau emerald di bagian atas
 * - Judul: "Portal Login Sistem Terpadu" - Pesantren Modern Darul Ulum
 * - Kolom Username/Email dengan ikon amplop & Password dengan ikon gembok + eye toggle
 * - Tombol utama emerald "Masuk ke Dashboard"
 * - Dropdown Accordion "Pilih Akun Demo (7 Role Akses)" dengan auto-fill instan
 * ============================================================================
 */

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _isDemoPanelOpen = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    // Default akun Super Admin atau Admin Ri'ayah untuk kenyamanan awal
    _selectDemoAccount(DemoAccountsData.accounts[0]);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _selectDemoAccount(DemoAccountModel acc) {
    setState(() {
      _emailController.text = acc.email;
      _passwordController.text = acc.password;
      _errorMessage = null;
    });
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Harap masukkan Email atau Username Anda.');
      return;
    }
    if (password.isEmpty) {
      setState(() => _errorMessage = 'Harap masukkan Password Anda.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final session = await SessionService.authenticate(
        emailOrUsername: email,
        password: password,
      );

      if (!mounted) return;

      // Navigasi ke Dasbor Universal Enterprise
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => MainDashboardScreen(session: session),
        ),
      );
    } catch (e) {
      setState(() {
        _errorMessage = 'Gagal masuk: $e';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryEmerald = Color(0xFF059669);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // Slate 50
      body: Stack(
        children: [
          // Background Top Subtle Ambient Glow
          Positioned(
            top: -60,
            left: 0,
            right: 0,
            height: 280,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFD1FAE5), // emerald-100/60
                    Color(0xFFF0FDF4),
                    Color(0x00F8FAFC),
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Brand Icon (Building2 Emerald Box)
                      Center(
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: primaryEmerald,
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: primaryEmerald.withOpacity(0.3),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.apartment_rounded, size: 30, color: Colors.white),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Title & Subtitle Identik dengan Web
                      const Text(
                        'Portal Login Sistem Terpadu',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 21,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Pesantren Modern Darul Ulum • Smart Permit & Smart Ri\'ayah',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Main Form Card (Elevated White Card)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 14,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Error Message Banner (Rose 50)
                            if (_errorMessage != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF1F2),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFFECDD3)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.error_outline_rounded, color: Color(0xFFE11D48), size: 18),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _errorMessage!,
                                        style: const TextStyle(
                                          fontSize: 11.5,
                                          color: Color(0xFFBE123C),
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Field: Username / Email
                            const Text(
                              'Username / Email Akun',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF334155),
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0F172A),
                              ),
                              decoration: InputDecoration(
                                hintText: 'contoh: superadmin@gmail.com',
                                hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                prefixIcon: const Icon(Icons.mail_outline_rounded, color: primaryEmerald, size: 18),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: primaryEmerald, width: 1.8),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Field: Password
                            const Text(
                              'Password',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF334155),
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0F172A),
                              ),
                              decoration: InputDecoration(
                                hintText: 'Masukkan password akun...',
                                hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                prefixIcon: const Icon(Icons.lock_outline_rounded, color: primaryEmerald, size: 18),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                    color: const Color(0xFF94A3B8),
                                    size: 18,
                                  ),
                                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                ),
                                filled: true,
                                fillColor: const Color(0xFFF8FAFC),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(color: primaryEmerald, width: 1.8),
                                ),
                              ),
                            ),
                            const SizedBox(height: 22),

                            // Submit Button
                            SizedBox(
                              height: 48,
                              child: ElevatedButton(
                                onPressed: _isLoading ? null : _handleLogin,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: primaryEmerald,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                                child: _isLoading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                      )
                                    : const Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.lock_rounded, size: 16),
                                          SizedBox(width: 8),
                                          Text(
                                            'Masuk ke Dashboard',
                                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                                          ),
                                          SizedBox(width: 6),
                                          Icon(Icons.arrow_forward_rounded, size: 16),
                                        ],
                                      ),
                              ),
                            ),
                            const SizedBox(height: 20),

                            // Accordion Dropdown: Pilih Akun Demo (7 Role Akses)
                            Container(
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Column(
                                children: [
                                  InkWell(
                                    borderRadius: BorderRadius.circular(14),
                                    onTap: () => setState(() => _isDemoPanelOpen = !_isDemoPanelOpen),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Row(
                                            children: [
                                              Icon(Icons.auto_awesome_rounded, color: Color(0xFFF59E0B), size: 16),
                                              SizedBox(width: 8),
                                              Text(
                                                'Pilih Akun Demo (7 Role Akses)',
                                                style: TextStyle(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF334155),
                                                ),
                                              ),
                                            ],
                                          ),
                                          Row(
                                            children: [
                                              Text(
                                                _isDemoPanelOpen ? 'Tutup' : 'Lihat',
                                                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                              ),
                                              const SizedBox(width: 4),
                                              Icon(
                                                _isDemoPanelOpen ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                                                size: 18,
                                                color: const Color(0xFF64748B),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),

                                  if (_isDemoPanelOpen) ...[
                                    const Divider(height: 1, color: Color(0xFFE2E8F0)),
                                    ListView.separated(
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      padding: const EdgeInsets.all(8),
                                      itemCount: DemoAccountsData.accounts.length,
                                      separatorBuilder: (_, __) => const SizedBox(height: 6),
                                      itemBuilder: (ctx, index) {
                                        final acc = DemoAccountsData.accounts[index];
                                        final isCurrent = _emailController.text.toLowerCase() == acc.email.toLowerCase();

                                        return InkWell(
                                          borderRadius: BorderRadius.circular(10),
                                          onTap: () => _selectDemoAccount(acc),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                            decoration: BoxDecoration(
                                              color: isCurrent ? const Color(0xFFECFDF5) : Colors.white,
                                              borderRadius: BorderRadius.circular(10),
                                              border: Border.all(
                                                color: isCurrent ? const Color(0xFFA7F3D0) : const Color(0xFFE2E8F0),
                                              ),
                                            ),
                                            child: Row(
                                              children: [
                                                Container(
                                                  padding: const EdgeInsets.all(6),
                                                  decoration: BoxDecoration(
                                                    color: isCurrent ? primaryEmerald : const Color(0xFFF1F5F9),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Icon(
                                                    acc.icon,
                                                    size: 15,
                                                    color: isCurrent ? Colors.white : const Color(0xFF64748B),
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Row(
                                                        children: [
                                                          Flexible(
                                                            child: Text(
                                                              acc.roleName,
                                                              style: const TextStyle(
                                                                fontSize: 11.5,
                                                                fontWeight: FontWeight.bold,
                                                                color: Color(0xFF0F172A),
                                                              ),
                                                              overflow: TextOverflow.ellipsis,
                                                            ),
                                                          ),
                                                          const SizedBox(width: 6),
                                                          Container(
                                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                                            decoration: BoxDecoration(
                                                              color: const Color(0xFFF1F5F9),
                                                              borderRadius: BorderRadius.circular(4),
                                                            ),
                                                            child: Text(
                                                              'Role ${index + 1}',
                                                              style: const TextStyle(
                                                                fontSize: 9,
                                                                fontFamily: 'monospace',
                                                                color: Color(0xFF64748B),
                                                              ),
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                      Text(
                                                        '${acc.email} • pass: ${acc.password}',
                                                        style: const TextStyle(
                                                          fontSize: 9.5,
                                                          color: Color(0xFF64748B),
                                                          fontFamily: 'monospace',
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                                  decoration: BoxDecoration(
                                                    color: isCurrent ? const Color(0xFFD1FAE5) : const Color(0xFFF1F5F9),
                                                    borderRadius: BorderRadius.circular(6),
                                                  ),
                                                  child: Text(
                                                    isCurrent ? 'Dipilih' : 'Gunakan',
                                                    style: TextStyle(
                                                      fontSize: 9.5,
                                                      fontWeight: FontWeight.bold,
                                                      color: isCurrent ? const Color(0xFF047857) : const Color(0xFF475569),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
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
}
