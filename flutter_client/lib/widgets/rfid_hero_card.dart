import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/santri_model.dart';

class RfidHeroCard extends StatelessWidget {
  final SantriModel? santri;

  const RfidHeroCard({super.key, this.santri});

  @override
  Widget build(BuildContext context) {
    final name   = santri?.namaLengkap ?? 'Ahmad Fauzi';
    final nis    = santri?.nis ?? '125456';
    final kamar  = santri?.kamar ?? 'Umar bin Khattab 204';
    final saldo  = santri?.saldoFormatted ?? 'Rp 0';
    final poin   = santri?.poinLabel ?? '- / 100';
    final kelas  = santri?.kelas ?? 'XII IPA';
    final poinVal = santri?.poinDisiplin ?? 0;

    Color poinColor = AppColors.gold300;
    if (poinVal >= 80) {
      poinColor = AppColors.emerald300;
    } else if (poinVal < 60) {
      poinColor = const Color(0xFFFCA5A5);
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          colors: [AppColors.emerald950, AppColors.emerald900, Color(0xFF047857)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: [0.0, 0.5, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.emerald800.withValues(alpha: 0.5),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Decorative circles
          Positioned(
            top: -30,
            right: -20,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.emerald600.withValues(alpha: 0.15),
              ),
            ),
          ),
          Positioned(
            bottom: -20,
            right: 40,
            child: Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold400.withValues(alpha: 0.1),
              ),
            ),
          ),
          // Content
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.emerald600.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.nfc_rounded, color: AppColors.emerald300, size: 16),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'SMART CARD SANTRI',
                        style: TextStyle(
                          color: AppColors.emerald300,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.gold500.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.gold400.withValues(alpha: 0.5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: AppColors.gold400,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Text(
                          'ACTIVE',
                          style: TextStyle(
                            color: AppColors.gold300,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                name,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'NIS: $nis  •  $kelas  •  Kamar $kamar',
                style: const TextStyle(
                  color: AppColors.emerald200,
                  fontSize: 11.5,
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(color: Colors.white12, thickness: 1),
              ),
              Row(
                children: [
                  Expanded(
                    child: _buildStat(
                      label: 'Saldo RFID',
                      value: saldo,
                      icon: Icons.account_balance_wallet_rounded,
                      valueColor: Colors.white,
                    ),
                  ),
                  Container(
                    width: 1,
                    height: 40,
                    color: Colors.white12,
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  Expanded(
                    child: _buildStat(
                      label: "Poin Ri'ayah",
                      value: poin,
                      icon: Icons.military_tech_rounded,
                      valueColor: poinColor,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStat({
    required String label,
    required String value,
    required IconData icon,
    required Color valueColor,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 12, color: AppColors.emerald300),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(color: AppColors.emerald200, fontSize: 10)),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(color: valueColor, fontSize: 17, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}
