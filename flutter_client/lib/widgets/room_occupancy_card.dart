import 'package:flutter/material.dart';
import '../models/room_model.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - ROOM OCCUPANCY CARD WIDGET
 * Menampilkan status kamar asrama putra/putri, progress bar okupansi kasur,
 * dan tombol aksi (Edit & Hapus) dengan desain Material 3 rapi & modern.
 * ============================================================================
 */

class RoomOccupancyCard extends StatelessWidget {
  final RoomModel room;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const RoomOccupancyCard({
    super.key,
    required this.room,
    this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final bool isPutri = room.isPutri;
    final bool isFull = room.isFull;
    final double percent = room.persentaseTerisi;

    final primaryThemeColor = isPutri ? const Color(0xFF0D9488) : const Color(0xFF047857);
    final badgeBgColor = isPutri ? const Color(0xFFCCFBF1) : const Color(0xFFD1FAE5);
    final badgeTextColor = isPutri ? const Color(0xFF0F766E) : const Color(0xFF065F46);

    Color progressColor;
    if (isFull) {
      progressColor = const Color(0xFFEF4444); // Red
    } else if (percent > 0.8) {
      progressColor = const Color(0xFFF59E0B); // Amber
    } else {
      progressColor = const Color(0xFF10B981); // Emerald
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isPutri ? const Color(0xFF99F6E4).withOpacity(0.5) : const Color(0xFFA7F3D0).withOpacity(0.5),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Category Badge & Actions
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: badgeBgColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isPutri ? 'ASRAMA PUTRI (SANTRIWATI)' : 'ASRAMA PUTRA (SANTRI)',
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      color: badgeTextColor,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                Row(
                  children: [
                    if (onEdit != null)
                      InkWell(
                        onTap: onEdit,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF475569)),
                        ),
                      ),
                    if (onDelete != null) ...[
                      const SizedBox(width: 6),
                      InkWell(
                        onTap: onDelete,
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Room Title
            Text(
              '${room.nomorKamar} — Lt. ${room.lantai}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
              ),
            ),
            Text(
              room.namaGedung,
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),

            // Occupancy Indicator Box
            Container(
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
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Keterisian Kasur:',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                      ),
                      Text(
                        '${room.terisi} / ${room.kapasitas} Kasur (${(percent * 100).round()}%)',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: isFull ? const Color(0xFFDC2626) : primaryThemeColor,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Progress Bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LinearProgressIndicator(
                      value: percent,
                      minHeight: 7,
                      backgroundColor: const Color(0xFFE2E8F0),
                      valueColor: AlwaysStoppedAnimation<Color>(progressColor),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Meta details
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Sisa: ${room.sisaKasur} kasur',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: room.sisaKasur > 0 ? const Color(0xFF0F766E) : const Color(0xFFDC2626),
                        ),
                      ),
                      Text(
                        'Ketua: ${room.ketuaKamar}',
                        style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

