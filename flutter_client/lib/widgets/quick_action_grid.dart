import 'package:flutter/material.dart';

class QuickAction {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const QuickAction({
    required this.label,
    required this.icon,
    required this.color,
    this.onTap,
  });
}

class QuickActionGrid extends StatelessWidget {
  final List<QuickAction> actions;

  const QuickActionGrid({super.key, required this.actions});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 4,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 0.80, // Memberikan cukup tinggi agar teks 2 baris tidak overflow
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: actions.map(_buildItem).toList(),
    );
  }

  Widget _buildItem(QuickAction action) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: action.onTap,
          borderRadius: BorderRadius.circular(16),
          splashColor: action.color.withValues(alpha: 0.12),
          highlightColor: const Color(0xFFF1F5F9),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: action.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: action.color.withValues(alpha: 0.25),
                      width: 1,
                    ),
                  ),
                  child: Icon(action.icon, color: action.color, size: 19),
                ),
                const SizedBox(height: 5),
                Flexible(
                  child: Text(
                    action.label,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF334155),
                      height: 1.15,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
