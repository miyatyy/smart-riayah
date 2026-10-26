import 'package:flutter/material.dart';

class MudirChartsView extends StatefulWidget {
  const MudirChartsView({super.key});

  @override
  State<MudirChartsView> createState() => _MudirChartsViewState();
}

class _MudirChartsViewState extends State<MudirChartsView> with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _chartAnim;
  int _selectedFilter = 0; // 0: Mingguan, 1: Bulanan

  final List<Map<String, dynamic>> _weeklyData = [
    {'hari': 'Sen', 'pesiar': 4, 'pulang': 1, 'berobat': 2},
    {'hari': 'Sel', 'pesiar': 3, 'pulang': 0, 'berobat': 3},
    {'hari': 'Rab', 'pesiar': 6, 'pulang': 2, 'berobat': 1},
    {'hari': 'Kam', 'pesiar': 5, 'pulang': 1, 'berobat': 4},
    {'hari': 'Jum', 'pesiar': 18, 'pulang': 8, 'berobat': 2},
    {'hari': 'Sab', 'pesiar': 24, 'pulang': 14, 'berobat': 1},
    {'hari': 'Ahd', 'pesiar': 32, 'pulang': 19, 'berobat': 2},
  ];

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _chartAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutCubic);
    _animCtrl.forward();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _chartAnim,
      builder: (context, child) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            // Banner Eksekutif Mudir
            _buildExecutiveBanner(),
            const SizedBox(height: 16),

            // Stat Cards Eksekutif
            _buildExecutiveKpiGrid(),
            const SizedBox(height: 16),

            // Diagram Berjalan: Tren Izin Mingguan
            _buildTrendChartCard(),
            const SizedBox(height: 16),

            // Diagram Distribusi Kedisiplinan Adab
            _buildDisciplineBarChart(),
            const SizedBox(height: 16),

            // DSS (Decision Support System) AI Insight
            _buildDssInsightCard(),
          ],
        );
      },
    );
  }

  Widget _buildExecutiveBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFD97706), Color(0xFFB45309)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFD97706).withValues(alpha: 0.2),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'ROLE: PIMPINAN / MUDIR',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const Text(
                'الرعاية والتربية الإسلامية',
                style: TextStyle(
                  color: Color(0xFFFEF3C7),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Executive Analytics & DSS',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Pemantauan holistik dinamika santri, ketertiban gerbang Smart Gate, dan rekapitulasi data akreditasi pesantren.',
            style: TextStyle(color: Color(0xFFFEF3C7), fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildExecutiveKpiGrid() {
    return Row(
      children: [
        Expanded(
          child: _buildKpiCard(
            title: 'Tingkat Disiplin',
            value: '98.2%',
            sub: '+1.4% vs bln lalu',
            color: const Color(0xFF059669),
            icon: Icons.verified_rounded,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildKpiCard(
            title: 'Kepatuhan Jam',
            value: '96.8%',
            sub: '0 pelanggaran malam',
            color: const Color(0xFF0284C7),
            icon: Icons.alarm_on_rounded,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildKpiCard(
            title: 'Santri di Luar',
            value: '4 Santri',
            sub: 'Semua izin aktif',
            color: const Color(0xFFD97706),
            icon: Icons.exit_to_app_rounded,
          ),
        ),
      ],
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String sub,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
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
          Icon(icon, color: color, size: 18),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w800),
          ),
          Text(
            title,
            style: const TextStyle(color: Color(0xFF334155), fontSize: 11, fontWeight: FontWeight.w600),
          ),
          Text(
            sub,
            style: const TextStyle(color: Color(0xFF64748B), fontSize: 9),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildTrendChartCard() {
    const maxVal = 55.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Judul & Filter
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.show_chart_rounded, color: Color(0xFF059669), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Diagram Tren Izin Keluar',
                    style: TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () {
                  setState(() => _selectedFilter = _selectedFilter == 0 ? 1 : 0);
                  _animCtrl.forward(from: 0.0);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Text(
                    _selectedFilter == 0 ? '7 Hari ▾' : '30 Hari ▾',
                    style: const TextStyle(color: Color(0xFF0284C7), fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Legend Row
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _buildLegendItem('Pesiar', const Color(0xFF059669)),
              const SizedBox(width: 12),
              _buildLegendItem('Pulang', const Color(0xFFD97706)),
            ],
          ),
          const SizedBox(height: 14),

          // Custom Animated Bar/Area Chart (Safe height, no overflow)
          SizedBox(
            height: 165,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: _weeklyData.map((d) {
                final total = ((d['pesiar'] as int) + (d['pulang'] as int)).toDouble();
                final heightPesiar = (d['pesiar'] as int) / maxVal * 85 * _chartAnim.value;
                final heightPulang = (d['pulang'] as int) / maxVal * 85 * _chartAnim.value;

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          '${total.toInt()}',
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Stack(
                          alignment: Alignment.bottomCenter,
                          children: [
                            Container(
                              width: 14,
                              height: (heightPesiar + heightPulang).clamp(4.0, 95.0),
                              decoration: BoxDecoration(
                                color: const Color(0xFFD97706),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            Container(
                              width: 14,
                              height: heightPesiar.clamp(2.0, 95.0),
                              decoration: BoxDecoration(
                                color: const Color(0xFF059669),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          d['hari'] as String,
                          style: const TextStyle(
                            color: Color(0xFF475569),
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),
          const Center(
            child: Text(
              'Lonjakan izin wajar di hari Jum\'at s/d Ahad (Jam Pesiar Resmi Pesantren)',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontStyle: FontStyle.italic),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 10)),
      ],
    );
  }

  Widget _buildDisciplineBarChart() {
    final List<Map<String, dynamic>> dist = [
      {'label': 'Mumtaz (90-100)', 'count': 4, 'pct': 0.8, 'color': const Color(0xFF059669)},
      {'label': 'Jayyid (80-89)', 'count': 1, 'pct': 0.2, 'color': const Color(0xFF0284C7)},
      {'label': 'Maqbul (70-79)', 'count': 0, 'pct': 0.0, 'color': const Color(0xFFD97706)},
      {'label': 'Perlu Bimbingan (<70)', 'count': 0, 'pct': 0.0, 'color': const Color(0xFFDC2626)},
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.military_tech_rounded, color: Color(0xFFD97706), size: 18),
              SizedBox(width: 8),
              Text(
                'Distribusi Skor Adab & Disiplin',
                style: TextStyle(
                  color: Color(0xFF0F172A),
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...dist.map((d) {
            final pct = (d['pct'] as double) * _chartAnim.value;
            final count = d['count'] as int;
            final color = d['color'] as Color;

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        d['label'] as String,
                        style: const TextStyle(color: Color(0xFF334155), fontSize: 11),
                      ),
                      Text(
                        '$count Santri (${(pct * 100).toInt()}%)',
                        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: pct,
                      minHeight: 7,
                      backgroundColor: const Color(0xFFF1F5F9),
                      valueColor: AlwaysStoppedAnimation<Color>(color),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildDssInsightCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFDE68A),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.psychology_rounded, color: Color(0xFFB45309), size: 20),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'DSS Pimpinan (AI Recommendation)',
                  style: TextStyle(
                    color: Color(0xFF92400E),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Integritas sistem Smart Gate 100% prima. Kartu RFID Nurmiyaty dan santri lainnya tercatat tertib. Tidak ditemukan anomali perizinan.',
                  style: TextStyle(color: Color(0xFFB45309), fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
