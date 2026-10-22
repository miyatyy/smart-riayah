import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/santri_model.dart';

class SantriCard extends StatelessWidget {
  final SantriModel santri;
  final VoidCallback? onTap;

  const SantriCard({super.key, required this.santri, this.onTap});

  Color get _statusColor {
    if (santri.isPresent) return AppColors.emerald600;
    if (santri.isIzin) return AppColors.warning;
    return AppColors.danger;
  }

  Color get _statusBg {
    if (santri.isPresent) return AppColors.emerald50;
    if (santri.isIzin) return const Color(0xFFFEF3C7);
    return const Color(0xFFFEE2E2);
  }

  Color get _poinColor {
    if (santri.poinDisiplin >= 80) return AppColors.emerald600;
    if (santri.poinDisiplin >= 60) return AppColors.warning;
    return AppColors.danger;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            splashColor: AppColors.emerald100,
            highlightColor: AppColors.emerald50,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  _buildAvatar(),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                santri.namaLengkap,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  color: AppColors.textPrimary,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            _buildStatusBadge(),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'NIS: ${santri.nis} • ${santri.kelas}',
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '🏠 Kamar ${santri.kamar}',
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 8),
                        _buildFooter(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar() {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.emerald700, AppColors.emerald500],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Center(
        child: Text(
          santri.initials,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _statusBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        santri.statusLabel,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: _statusColor,
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "Poin Ri'ayah",
                    style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                  ),
                  Text(
                    santri.poinLabel,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: _poinColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 3),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: santri.poinDisiplin / 100.0,
                  backgroundColor: AppColors.borderColor,
                  color: _poinColor,
                  minHeight: 5,
                ),
              ),
            ],
          ),
        ),
        if (santri.saldoRfid != null) ...[
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.emerald50,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              santri.saldoFormatted,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.emerald700,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
