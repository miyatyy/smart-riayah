import 'package:flutter/material.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - RFID CARD WIDGET
 * Visualisasi kartu identitas fisik Mifare Classic 13.56 MHz & Dompet Pintar
 * ============================================================================
 */

class RfidCardWidget extends StatelessWidget {
  final String rfidUid;
  final String santriNama;
  final String nis;
  final int saldo;
  final bool isBlocked;
  final VoidCallback? onSimulateTap;

  const RfidCardWidget({
    super.key,
    required this.rfidUid,
    required this.santriNama,
    required this.nis,
    required this.saldo,
    this.isBlocked = false,
    this.onSimulateTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isBlocked
              ? [const Color(0xFF475569), const Color(0xFF1E293B)]
              : [const Color(0xFF064E3B), const Color(0xFF047857), const Color(0xFF0F766E)],
        ),
        boxShadow: [
          BoxShadow(
            color: (isBlocked ? const Color(0xFF1E293B) : const Color(0xFF064E3B)).withOpacity(0.3),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Background Watermark / Geometric Accent
          Positioned(
            right: -25,
            top: -25,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.05),
              ),
            ),
          ),
          Positioned(
            right: 40,
            bottom: -30,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.04),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(22.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Card Header: Brand & Wireless Wave Icon
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.school, color: Colors.white, size: 18),
                        ),
                        const SizedBox(width: 10),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'SMART RI\'AYAH CARD',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 11,
                                letterSpacing: 0.8,
                              ),
                            ),
                            Text(
                              'Pesantren Modern Darul Ulum',
                              style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 9.5),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const Icon(Icons.contactless_rounded, color: Colors.white70, size: 26),
                  ],
                ),
                const SizedBox(height: 20),

                // Chip & UID
                Row(
                  children: [
                    // Golden Chip Mockup
                    Container(
                      width: 38,
                      height: 28,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(6),
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFDE68A), Color(0xFFD97706)],
                        ),
                        border: Border.all(color: const Color(0xFFB45309), width: 0.5),
                      ),
                      child: Center(
                        child: Container(
                          width: 26,
                          height: 16,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.black26, width: 0.5),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    // UID Hex Code
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'PHYSICAL RFID UID (HEX):',
                          style: TextStyle(
                            color: Color(0xFF6EE7B7),
                            fontSize: 8.5,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          rfidUid.isNotEmpty ? rfidUid : '04:A1:2B:9C',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            fontFamily: 'monospace',
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 22),

                // Card Footer: Santri Name, NIS & Saldo Dompet
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          santriNama.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 13.5,
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'NIS: $nis • Dompet Pintar Cashless',
                          style: const TextStyle(color: Color(0xFFA7F3D0), fontSize: 10),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text(
                          'SALDO RFID',
                          style: TextStyle(
                            color: Color(0xFF6EE7B7),
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Rp ${saldo.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

