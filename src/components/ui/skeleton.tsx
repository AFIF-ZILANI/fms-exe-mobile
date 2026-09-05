import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
};

/**
 * A block matching the layout about to appear — never a spinner. A spinner
 * tells a worker nothing; a skeleton tells them what's coming.
 * docs/design.md §7.
 */
export function Skeleton({ width = '100%', height = 18, radius = Radius.control }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    let cancelled = false;
    // Reduce Motion turns the pulse off but keeps the block — losing the
    // animation must not lose the feedback. docs/design.md §9.
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      opacity.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
    });
    return () => {
      cancelled = true;
    };
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.surfaceAlt }, animated]}
    />
  );
}

/** A stack of skeleton lines standing in for one list row. */
export function SkeletonRow({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.row}>
      <Skeleton width="55%" height={16} />
      {lines > 1 ? <Skeleton width="35%" height={13} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm, paddingVertical: Spacing.md },
});
