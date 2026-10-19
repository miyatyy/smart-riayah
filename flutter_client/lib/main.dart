import 'package:flutter/material.dart';
import 'api_service.dart';

void main() {
  runApp(const SmartRiayahFlutterApp());
}

class SmartRiayahFlutterApp extends StatelessWidget {
  const SmartRiayahFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart Riayah Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF059669)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      ),
      home: const WaliSantriHomeScreen(),
    );
  }
}

class WaliSantriHomeScreen extends StatefulWidget {
  const WaliSantriHomeScreen({super.key});

  @override
  State<WaliSantriHomeScreen> createState() => _WaliSantriHomeScreenState();
}

class _WaliSantriHomeScreenState extends State<WaliSantriHomeScreen> {
  bool _isLoading = true;
  bool _isServerOnline = false;
  List<Map<String, dynamic>> _santriList = [];
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final online = await SmartRiayahApiService.checkHealth();
    setState(() => _isServerOnline = online);

    try {
      final list = await SmartRiayahApiService.getSantriList();
      setState(() {
        _santriList = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Smart Riayah Mobile',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
            ),
            Text(
              'Pesantren Modern Darul Ulum',
              style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 11),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(
              backgroundColor: _isServerOnline ? const Color(0xFF065F46) : const Color(0xFF991B1B),
              label: Text(
                _isServerOnline ? 'API ONLINE' : 'OFFLINE',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF059669)))
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Banner Kartu RFID Digital Santri
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF064E3B), Color(0xFF047857)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF059669).withOpacity(0.3),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'SMART CARD SANTRI (13.56 MHz)',
                              style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.amber.shade700,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'ACTIVE RFID',
                                style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Ahmad Fauzi',
                          style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const Text(
                          'NIS: 125456 • Kamar: Umar bin Khattab 204',
                          style: TextStyle(color: Color(0xFFD1FAE5), fontSize: 12),
                        ),
                        const Divider(color: Colors.white24, height: 24),
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Saldo Dompet POS', style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 11)),
                                Text('Rp 85.000', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('Poin Ri\'ayah', style: TextStyle(color: Color(0xFFA7F3D0), fontSize: 11)),
                                Text('92 / 100', style: TextStyle(color: Colors.amberAccent, fontSize: 16, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),
                  const Text(
                    'Daftar Santri Terdaftar di Database:',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 8),

                  if (_errorMessage.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        border: Border.all(color: Colors.amber.shade300),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'Peringatan API: $_errorMessage\nPastikan backend telah aktif: npm run server',
                        style: TextStyle(color: Colors.amber.shade900, fontSize: 11),
                      ),
                    ),

                  ..._santriList.map((s) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0.5,
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFFD1FAE5),
                            child: Text(
                              s['nama_lengkap'] != null ? s['nama_lengkap'][0] : 'S',
                              style: const TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(s['nama_lengkap'] ?? 'Santri', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          subtitle: Text('Kamar: ${s['kamar'] ?? '-'} • Status: ${s['status_asrama'] ?? 'DI_ASRAMA'}', style: const TextStyle(fontSize: 11)),
                          trailing: Text(
                            'Poin: ${s['poin_disiplin'] ?? 100}',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF047857)),
                          ),
                        ),
                      )),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _loadData,
        backgroundColor: const Color(0xFF059669),
        icon: const Icon(Icons.refresh, color: Colors.white),
        label: const Text('Refresh API', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
