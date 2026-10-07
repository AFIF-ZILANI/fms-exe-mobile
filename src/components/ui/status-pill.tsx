import { View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatusEntry = { tone: ThemeColor; label: string };

/** Every status vocabulary this app renders, mapped once. Extend here, not
 *  per call site — docs/design.md §1.1, never colour alone for status. */
const STATUS_MAP: Record<string, StatusEntry> = {
  PENDING: { tone: 'warning', label: 'Pending' },
  DONE: { tone: 'neutral', label: 'Done' },
  OVERDUE: { tone: 'critical', label: 'Overdue' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  RUNNING: { tone: 'success', label: 'Running' },
  EMPTY: { tone: 'neutral', label: 'Empty' },
  CLOSED: { tone: 'neutral', label: 'Closed' },
  SOLD: { tone: 'neutral', label: 'Sold' },
  UNASSIGNED: { tone: 'neutral', label: 'Unassigned' },
  IN_STOCK: { tone: 'success', label: 'In stock' },
  IN_USE: { tone: 'info', label: 'In use' },
  CONSUMED: { tone: 'neutral', label: 'Consumed' },
  DISPOSED: { tone: 'neutral', label: 'Disposed' },
  CURRENT: { tone: 'success', label: 'Current' },
  LOW: { tone: 'warning', label: 'Low' },
};

/** A dot plus a word — never the dot alone. docs/design.md §10. */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const theme = useTheme();
  const entry = STATUS_MAP[status] ?? { tone: 'muted' as ThemeColor, label: status };

  return (
    <View style={[styles.pill, { borderColor: theme[entry.tone] }]}>
      <View style={[styles.dot, { backgroundColor: theme[entry.tone] }]} />
      <AppText variant="caption" color={entry.tone}>
        {label ?? entry.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
