import 'package:flutter/material.dart';
import '../models/santri_model.dart';

class SantriCard extends StatelessWidget {
  final SantriModel santri;
  final VoidCallback? onTap;

  const SantriCard({super.key, required this.santri, this.onTap});

  Color get _statusColor {
    if (santri.isPresent) return const Color(0xFF10B981);
    if (santri.isIzin) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  Color get _statusBg {
    if (santri.isPresent) return const Color(0xFF10B981).withValues(alpha: 0.12);
    if (santri.isIzin) return const Color(0xFFF59E0B).withValues(alpha: 0.12);
    return const Color(0xFFEF4444).withValues(alpha: 0.12);
  }

  Color get _poinColor {
    if (santri.poinDisiplin >= 90) return const Color(0xFF10B981);
    if (santri.poinDisiplin >= 75) return const Color(0xFF38BDF8);
    if (santri.poinDisiplin >= 60) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  LinearGradient get _avatarGradient {
    if (santri.isAkhwat) {
      return const LinearGradient(
        colors: [Color(0xFFEC4899), Color(0xFF8B5CF6)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
    }
    return const LinearGradient(
      colors: [Color(0xFF0284C7), Color(0xFF0D9488)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          splashColor: const Color(0xFF10B981).withValues(alpha: 0.08),
          highlightColor: const Color(0xFFF8FAFC),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Avatar, Name, Class & Status Badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Avatar
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: _avatarGradient,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: Text(
                          santri.initials,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 17,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Name, NIS & Gender Pill
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
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14.5,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: -0.2,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              _buildStatusBadge(),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: santri.gender == 'P' ? const Color(0xFFFDF2F8) : const Color(0xFFF0F9FF),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: santri.gender == 'P' ? const Color(0xFFFBCFE8) : const Color(0xFFBAE6FD),
                                  ),
                                ),
                                child: Text(
                                  santri.gender == 'P' ? 'Akhwat' : 'Ikhwan',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w600,
                                    color: santri.gender == 'P' ? const Color(0xFFDB2777) : const Color(0xFF0284C7),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'NIS: ${santri.nis}',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                              ),
                              const SizedBox(width: 4),
                              const Text('•', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11)),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  santri.kelas,
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 12),
                Container(height: 1, color: const Color(0xFFF1F5F9)),
                const SizedBox(height: 10),

                // Middle Info: Kamar & RFID Tag
                Row(
                  children: [
                    // Kamar Asrama Badge
                    Expanded(
                      child: Row(
                        children: [
                          const Icon(Icons.night_shelter_rounded, size: 15, color: Color(0xFF059669)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              santri.kamar,
                              style: const TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF334155),
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // RFID UID Badge
                    if (santri.rfidUid != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.nfc_rounded, size: 11, color: Color(0xFF64748B)),
                            const SizedBox(width: 4),
                            Text(
                              santri.rfidUid!,
                              style: const TextStyle(
                                fontSize: 9.5,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 10),

                // Bottom Metrics: Poin Disiplin Bar & Saldo RFID
                Row(
                  children: [
                    // Poin Disiplin Progress Bar
                    Expanded(
                      flex: 6,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Poin Ri\'ayah',
                                style: TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                '${santri.poinDisiplin} / 100',
                                style: TextStyle(
                                  color: _poinColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 5),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: (santri.poinDisiplin / 100).clamp(0.0, 1.0),
                              backgroundColor: const Color(0xFFF1F5F9),
                              valueColor: AlwaysStoppedAnimation<Color>(_poinColor),
                              minHeight: 5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),

                    // Saldo RFID Pill
                    Expanded(
                      flex: 4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text(
                              'Saldo RFID',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 9),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              santri.saldoFormatted,
                              style: const TextStyle(
                                color: Color(0xFF059669),
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _statusBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _statusColor.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _statusColor,
              boxShadow: [
                BoxShadow(
                  color: _statusColor.withValues(alpha: 0.6),
                  blurRadius: 4,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
          const SizedBox(width: 5),
          Text(
            santri.statusLabel,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: _statusColor,
            ),
          ),
        ],
      ),
    );
  }
}
