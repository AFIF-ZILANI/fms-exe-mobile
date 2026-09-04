import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatusEntry = { tone: ThemeColor; label: string };

/** Every status vocabulary this app renders, mapped once. Extend here, not
 *  per call site -- docs/design.md §1.2, never colour alone for status. */
const STATUS_MAP: Record<string, StatusEntry> = {
  PENDING: { tone: 'warning', label: 'Pending' },
  DONE: { tone: 'success', label: 'Done' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  RUNNING: { tone: 'success', label: 'Running' },
  CLOSED: { tone: 'neutral', label: 'Closed' },
  SOLD: { tone: 'neutral', label: 'Sold' },
  UNASSIGNED: { tone: 'neutral', label: 'Unassigned' },
  IN_STOCK: { tone: 'success', label: 'In stock' },
  IN_USE: { tone: 'info', label: 'In use' },
  CONSUMED: { tone: 'neutral', label: 'Consumed' },
  DISPOSED: { tone: 'neutral', label: 'Disposed' },
};

export function StatusPill({ status }: { status: string }) {
  const theme = useTheme();
  const entry = STATUS_MAP[status] ?? { tone: 'muted', label: status };

  return (
    <View style={[styles.pill, { borderColor: theme[entry.tone] }]}>
      <View style={[styles.dot, { backgroundColor: theme[entry.tone] }]} />
      <AppText variant="label" color={entry.tone}>
        {entry.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderWidth: 1,
    borderRadius: Radius,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
