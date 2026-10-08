import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ADJUST_MAX, ADJUST_MIN, ZERO_POSITION, scalePosition } from '@/lib/performance-view';

const MARKER = 22;
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

/**
 * Where this month's points land on the pay band: −10% at the left end, +20% at the right, zero a third of
 * the way in. The band is the reason a point is worth what it is -- the floor is easier to reach than the
 * ceiling -- and a worker sees it at a glance instead of working it out from a percentage.
 */
export function AdjustmentScale({ points }: { points: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const pos = scalePosition(points);
  const tone = points > 0 ? theme.success : points < 0 ? theme.critical : theme.muted;
  // The filled stretch runs from zero to the marker.
  const fillLeft = Math.min(pos, ZERO_POSITION) * width;
  const fillWidth = Math.abs(pos - ZERO_POSITION) * width;

  const marker = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(pos * width - MARKER / 2, SPRING) }],
  }));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={`Pay adjustment, from ${ADJUST_MIN} to plus ${ADJUST_MAX} percent`}>
      <View style={styles.trackWrap}>
        <View style={[styles.track, { backgroundColor: theme.surfaceAlt }]}>
          <View style={{ flex: ZERO_POSITION, backgroundColor: theme.tintRed }} />
          <View style={{ flex: 1 - ZERO_POSITION, backgroundColor: theme.tintGreen }} />
        </View>
        <View style={[styles.fill, { left: fillLeft, width: fillWidth, backgroundColor: tone }]} />
        <View style={[styles.zeroTick, { left: ZERO_POSITION * width - 1, backgroundColor: theme.line }]} />
        <Animated.View style={[styles.marker, { backgroundColor: tone, borderColor: theme.surface }, marker]} />
      </View>
      <View style={styles.labels}>
        <AppText variant="caption" color="muted">
          {ADJUST_MIN}%
        </AppText>
        <AppText variant="caption" color="muted" style={{ position: 'absolute', left: ZERO_POSITION * width - 8 }}>
          0
        </AppText>
        <AppText variant="caption" color="muted">
          +{ADJUST_MAX}%
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackWrap: { height: MARKER, justifyContent: 'center' },
  track: { height: 10, borderRadius: Radius.pill, overflow: 'hidden', flexDirection: 'row' },
  fill: { position: 'absolute', height: 10, top: (MARKER - 10) / 2, borderRadius: Radius.pill },
  zeroTick: { position: 'absolute', width: 2, height: 14, top: (MARKER - 14) / 2 },
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MARKER,
    height: MARKER,
    borderRadius: Radius.pill,
    borderWidth: 3,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
});
