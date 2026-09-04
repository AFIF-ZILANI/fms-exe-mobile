import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';

type DayCycleBarProps = {
  day: number;
  expectedDays: number;
};

const SEGMENTS = 5;

/** `d21 ▓▓▓░░` -- docs/design.md §4.2. Rendered wherever a batch appears,
 *  since day-of-cycle changes what every other reading means. */
export function DayCycleBar({ day, expectedDays }: DayCycleBarProps) {
  const theme = useTheme();
  const ratio = expectedDays > 0 ? day / expectedDays : 0;
  const filled = Math.max(0, Math.min(SEGMENTS, Math.round(ratio * SEGMENTS)));

  return (
    <View style={styles.row}>
      <AppText variant="data" color="muted">
        d{day}
      </AppText>
      <View style={styles.segments}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i < filled ? theme.ink : theme.line }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segments: { flexDirection: 'row', gap: 2 },
  segment: { width: 8, height: 8 },
});
