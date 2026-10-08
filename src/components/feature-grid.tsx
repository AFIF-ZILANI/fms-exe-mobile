import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/ui/card';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { Spacing, type ThemeColor } from '@/constants/theme';

type Feature = {
  label: string;
  icon: IconName;
  tint: 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue' | 'primarySoft';
  color: ThemeColor;
  href: string;
};

const COLUMNS = 4;
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

/** Where a worker can go from Home. The first row always shows; the rest sit behind "See more". Add a
 *  feature here and it joins the grid. Team is a manager's tool, so it is offered to managers only. */
function featuresFor(isManager: boolean): Feature[] {
  const list: Feature[] = [
    { label: 'Houses', icon: 'home', tint: 'tintGreen', color: 'success', href: '/houses' },
    { label: 'Stock', icon: 'archive', tint: 'tintBlue', color: 'info', href: '/stock' },
    { label: 'Alerts', icon: 'bell', tint: 'tintAmber', color: 'warning', href: '/alerts' },
    { label: 'Sync', icon: 'refresh-cw', tint: 'primarySoft', color: 'primary', href: '/sync' },
  ];
  if (isManager) list.push({ label: 'Team', icon: 'users', tint: 'tintGreen', color: 'success', href: '/team' });
  list.push({ label: 'Settings', icon: 'settings', tint: 'primarySoft', color: 'primary', href: '/settings' });
  return list;
}

function Tile({ feature }: { feature: Feature }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        router.push(feature.href as Href);
      }}
      onPressIn={() => scale.set(withSpring(0.92, SPRING))}
      onPressOut={() => scale.set(withSpring(1, SPRING))}
      accessibilityRole="button"
      accessibilityLabel={feature.label}
      style={styles.cell}
    >
      <Animated.View style={[styles.tile, style]}>
        <IconTile name={feature.icon} tint={feature.tint} color={feature.color} size={56} />
        <AppText variant="caption" color="inkSoft" numberOfLines={1}>
          {feature.label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

function Row({ items }: { items: Feature[] }) {
  return (
    <View style={styles.row}>
      {items.map((f) => (
        <Tile key={f.label} feature={f} />
      ))}
      {/* Pad the last row so its tiles keep the same width as a full row's. */}
      {Array.from({ length: COLUMNS - items.length }, (_, i) => (
        <View key={`pad${i}`} style={styles.cell} />
      ))}
    </View>
  );
}

/** docs/layout/01-dashboard.md — a grid of shortcuts, four to a row, the rest behind "See more". */
export function FeatureGrid({ isManager }: { isManager: boolean }) {
  const [open, setOpen] = useState(false);
  const turn = useSharedValue(0);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  const features = featuresFor(isManager);
  const rows: Feature[][] = [];
  for (let i = 0; i < features.length; i += COLUMNS) rows.push(features.slice(i, i + COLUMNS));
  const [first, ...rest] = rows;

  const toggle = () => {
    turn.set(withTiming(open ? 0 : 1, { duration: 220 }));
    setOpen((o) => !o);
  };

  return (
    // The card grows and shrinks smoothly as rows appear, instead of jumping.
    <Animated.View layout={LinearTransition.duration(240)} style={styles.card}>
      <Card eyebrow="Features">
        <Row items={first} />

        {open &&
          rest.map((items, i) => (
            <Animated.View
              key={i}
              entering={FadeIn.duration(220).delay(i * 40)}
              exiting={FadeOut.duration(120)}
            >
              <Row items={items} />
            </Animated.View>
          ))}

        {rest.length > 0 && (
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? 'Show fewer features' : 'See more features'}
            style={styles.more}
          >
            <AppText variant="label" color="primary">
              {open ? 'Show less' : 'See more'}
            </AppText>
            <Animated.View style={chevron}>
              <Icon name="chevron-down" size={18} color="primary" />
            </Animated.View>
          </Pressable>
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  tile: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    marginTop: Spacing.xs,
  },
});
