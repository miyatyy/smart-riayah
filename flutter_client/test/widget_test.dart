import 'package:flutter_test/flutter_test.dart';

import 'package:smart_riayah_mobile/main.dart';

void main() {
  testWidgets('Smart Riayah app smoke test', (WidgetTester tester) async {
    // Build the app and trigger a frame.
    await tester.pumpWidget(const SmartRiayahApp());

    // Verify that the Login Screen renders
    expect(find.text('Smart Riayah'), findsWidgets);
  });
}
