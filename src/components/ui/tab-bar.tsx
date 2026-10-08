import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The four slots, in fixed order, identical for every role — docs/navigation-redesign-design.md.
 * The centre button opens the Log launcher rather than navigating. What differs by role
 * is only what the launcher and Home offer, never the bar.
 */
// Five equal cells; the centre action takes the middle one so the indicator maths stays trivial.
const CELL_OF_SLOT = [0, 1, 3, 4];

type Glyph = keyof typeof Ionicons.glyphMap;

const SLOTS: { route: string; label: string; icon: Glyph; iconActive: Glyph }[] = [
  { route: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { route: 'tasks', label: 'Tasks', icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle' },
  { route: 'performance', label: 'Performance', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { route: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

/** Routes that live under a tab but are not a tab themselves, and which tab should look active
 *  while you are on them. Team is reached from Home's card and the launcher. */
const ACTIVE_ALIAS: Record<string, string> = { team: 'index', houses: 'index' };

const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

// ponytail: haptics fail silently (Low Power Mode, no hardware) — never block navigation on them.
const tick = () => void Haptics.selectionAsync().catch(() => {});

/** Scales down while held, springs back on release. */
function usePressScale(to = 0.9) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => scale.set(withSpring(to, SPRING)),
    onPressOut: () => scale.set(withSpring(1, SPRING)),
  };
}

function TabButton({
  slot,
  focused,
  onPress,
}: {
  slot: (typeof SLOTS)[number];
  focused: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale(0.88);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={slot.label}
      style={styles.cell}
    >
      <Animated.View style={[styles.tab, press.style]}>
        <Ionicons
          name={focused ? slot.iconActive : slot.icon}
          size={24}
          color={focused ? theme.primary : theme.muted}
        />
        <AppText variant="caption" color={focused ? 'primary' : 'muted'} style={styles.label}>
          {slot.label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

type TabBarProps = BottomTabBarProps & {
  /** Opens the log launcher. The centre button is not a route. */
  onLogPress: () => void;
};

export function TabBar({ state, navigation, onLogPress }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const centre = usePressScale(0.92);

  const current = state.routes[state.index]?.name;
  const activeRoute = (current && ACTIVE_ALIAS[current]) ?? current;
  const activeSlot = SLOTS.findIndex((s) => s.route === activeRoute);

  // Indicator sits at the top edge of the active cell; hidden when no tab is active.
  const cellWidth = width / 5;
  const indicator = useAnimatedStyle(() => ({
    opacity: withTiming(activeSlot === -1 ? 0 : 1, { duration: 150 }),
    transform: [
      { translateX: withSpring(cellWidth * (CELL_OF_SLOT[Math.max(activeSlot, 0)] + 0.5) - 12, SPRING) },
    ],
  }));

  const renderSlot = (slot: (typeof SLOTS)[number]) => {
    const route = state.routes.find((r) => r.name === slot.route);
    if (!route) return <View key={slot.route} style={styles.cell} />;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) return;
      if (activeRoute !== slot.route) tick();
      // Pressing the focused tab pops its stack to the root; from a hidden tab (Team) it goes home.
      navigation.navigate(route.name as never);
    };

    return <TabButton key={slot.route} slot={slot} focused={activeRoute === slot.route} onPress={onPress} />;
  };

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.bar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          height: Size.tabBar + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Animated.View style={[styles.indicator, { backgroundColor: theme.primary }, indicator]} />

      {SLOTS.slice(0, 2).map(renderSlot)}

      <View style={styles.cell}>
        <Pressable
          onPress={() => {
            tick();
            onLogPress();
          }}
          onPressIn={centre.onPressIn}
          onPressOut={centre.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Quick actions"
          hitSlop={8}
        >
          <Animated.View style={[styles.centre, { backgroundColor: theme.primary }, centre.style]}>
            <Ionicons name="add" size={30} color={theme.onPrimary} />
          </Animated.View>
        </Pressable>
      </View>

      {SLOTS.slice(2).map(renderSlot)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tab: { alignItems: 'center', gap: 3, paddingVertical: Spacing.xs },
  label: { fontSize: 11, lineHeight: 14 },
  indicator: {
    position: 'absolute',
    top: -StyleSheet.hairlineWidth,
    left: 0,
    width: 24,
    height: 3,
    borderBottomLeftRadius: Radius.pill,
    borderBottomRightRadius: Radius.pill,
  },
  centre: {
    width: Size.tabCentre,
    height: Size.tabCentre,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
