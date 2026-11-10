/** @jsxImportSource nativewind */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';

type Feature = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

const COLUMNS = 4;
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

/** Where a worker can go from Home. The first row always shows; the rest sit behind "See all". Add a
 *  feature here and it joins the grid. Team is a manager's tool, so it is offered to managers only.
 *  Alerts is not here: the bell and the alert strip already cover it. */
function featuresFor(isManager: boolean): Feature[] {
  const list: Feature[] = [
    { label: 'Houses', icon: 'home', href: '/houses' },
    { label: 'Stock', icon: 'cube', href: '/stock' },
  ];
  if (isManager) list.push({ label: 'Team', icon: 'people', href: '/team' });
  list.push(
    { label: 'Sync', icon: 'cloud-done', href: '/sync' },
    { label: 'Settings', icon: 'settings', href: '/settings' },
  );
  return list;
}

function Tile({ feature }: { feature: Feature }) {
  const theme = useTheme();
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
        <View className="items-center justify-center rounded border border-line bg-surface" style={styles.icon}>
          <Ionicons name={feature.icon} size={28} color={theme.primary} />
        </View>
        <Text className="font-body-medium text-label text-ink" numberOfLines={1}>
          {feature.label}
        </Text>
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

/** docs/layout/01-dashboard.md — shortcuts on the page itself, four to a row; "See all" reveals the rest. */
export function FeatureGrid({ isManager }: { isManager: boolean }) {
  const theme = useTheme();
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
    // The section grows and shrinks smoothly as rows appear, instead of jumping.
    <Animated.View layout={LinearTransition.duration(240)} style={styles.section}>
      <View className="mb-2 flex-row items-end justify-between">
        <Text className="font-heading text-title text-ink">Shortcuts</Text>
        {rest.length > 0 && (
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? 'Show fewer shortcuts' : 'See all shortcuts'}
            hitSlop={16}
            className="flex-row items-center gap-1"
          >
            <Text className="font-body-semibold text-label text-primary">{open ? 'Less' : 'See all'}</Text>
            <Animated.View style={chevron}>
              <Ionicons name="chevron-down" size={16} color={theme.primary} />
            </Animated.View>
          </Pressable>
        )}
      </View>

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
    </Animated.View>
  );
}

// Kept as style objects: these sit on Reanimated views or carry sizes outside the spacing scale.
const styles = StyleSheet.create({
  section: { marginTop: 24 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, alignItems: 'center' },
  tile: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  icon: { width: 64, height: 64 },
});
