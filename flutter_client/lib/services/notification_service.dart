import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/**
 * ============================================================================
 * SMART RI'AYAH MOBILE - NOTIFICATION SERVICE
 * Menghandle local push notifications dan heads-up banner:
 * - Pesan Live Chat baru
 * - Reaksi emoji pesan chat
 * - Pengajuan izin baru & permohonan perpanjangan izin
 * - Persetujuan atau penolakan perizinan & perpanjangan masa liburan
 * ============================================================================
 */
class NotificationService {
  static final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static const String channelId = 'smart_riayah_channel';
  static const String channelName = 'Smart Ri\'ayah Notifikasi';
  static const String channelDescription =
      'Pemberitahuan aktivitas perizinan, pesan live chat, dan status santri';

  static bool _isInitialized = false;

  /// Inisialisasi plugin notifikasi lokal & daftarkan channel Android
  static Future<void> initialize() async {
    if (_isInitialized) return;

    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const InitializationSettings initSettings = InitializationSettings(
      android: androidSettings,
    );

    await _notificationsPlugin.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Callback saat user mengetuk notifikasi di heads-up banner
        print('🔔 [NotificationService] User mengetuk notifikasi: ${response.payload}');
      },
    );

    // Daftarkan Channel Notifikasi dengan Prioritas Tertinggi (Heads-Up Banner)
    final androidImplementation = _notificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

    if (androidImplementation != null) {
      // Request izin POST_NOTIFICATIONS untuk Android 13 (Tiramisu) ke atas
      await androidImplementation.requestNotificationsPermission();

      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        channelId,
        channelName,
        description: channelDescription,
        importance: Importance.max,
        enableVibration: true,
        playSound: true,
        showBadge: true,
      );

      await androidImplementation.createNotificationChannel(channel);
    }

    _isInitialized = true;
    print('✅ [NotificationService] Berhasil diinisialisasi.');
  }

  /// Menampilkan push notification lokal (Heads-up banner dengan suara & getaran)
  static Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
    int? id,
  }) async {
    try {
      if (!_isInitialized) {
        await initialize();
      }

      final notificationId = id ?? DateTime.now().millisecondsSinceEpoch ~/ 1000;

      final AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: channelDescription,
        importance: Importance.max,
        priority: Priority.high,
        ticker: 'Smart Ri\'ayah',
        icon: '@mipmap/ic_launcher',
        enableVibration: true,
        playSound: true,
        styleInformation: BigTextStyleInformation(
          body,
          contentTitle: title,
          htmlFormatContentTitle: false,
          htmlFormatBigText: false,
        ),
      );

      final NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
      );

      await _notificationsPlugin.show(
        id: notificationId,
        title: title,
        body: body,
        notificationDetails: platformDetails,
        payload: payload,
      );

      print('🔔 [NotificationService] Notifikasi ditampilkan: "$title" - "$body"');
    } catch (e) {
      print('❌ [NotificationService] Gagal menampilkan notifikasi: $e');
    }
  }
}

