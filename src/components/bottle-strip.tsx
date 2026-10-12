import { View, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Past this many bottles the segments get too thin to read, so it becomes one bar. */
const MAX_SEGMENTS = 24;

type Props = { linked: number; total: number | null; height?: number };

/**
 * One segment per bottle, filled as its code is linked — the lot as it sits on
 * the pallet. Indigo while open, success green once every bottle has a code.
 * `total` null (lot not split yet) draws an empty track.
 */
export function BottleStrip({ linked, total, height = 8 }: Props) {
  const theme = useTheme();
  const done = total !== null && linked >= total;
  const fill = done ? theme.success : theme.primary;

  if (total === null || total > MAX_SEGMENTS) {
    const pct = total ? Math.min(100, (linked / total) * 100) : 0;
    return (
      <View style={[styles.track, { height, backgroundColor: theme.line }]}>
        <View style={{ width: `${pct}%`, height, backgroundColor: fill, borderRadius: Radius.pill }} />
      </View>
    );
  }

  return (
    <View style={[styles.row, { height }]}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, { backgroundColor: i < linked ? fill : theme.line }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, borderRadius: Radius.pill },
  track: { borderRadius: Radius.pill, overflow: 'hidden' },
});
