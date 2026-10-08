import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CycleProgress } from '@/lib/houses-summary';

/** A continuous bar for where a batch is in its planned cycle; amber and full once past the planned end.
 *  The words ("Day 17 of ~60") are shown by the caller next to it, so colour is never the only signal. */
export function CycleBar({ progress }: { progress: CycleProgress }) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.line }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(progress.ratio * 100)}%`,
            backgroundColor: progress.over ? theme.warning : theme.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: Radius.pill },
});
