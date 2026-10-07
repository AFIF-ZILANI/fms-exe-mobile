import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { AppText } from '@/components/ui/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The four slots, in fixed order, identical for every role — docs/navigation-redesign-design.md.
 * The raised centre button opens the Log launcher rather than navigating. What differs by role
 * is only what the launcher and Home offer, never the bar.
 */
const SLOTS: { route: string; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'houses', label: 'Houses', icon: 'grid' },
  { route: 'stock', label: 'Stock', icon: 'archive' },
  { route: 'me', label: 'Me', icon: 'user' },
];

/** Routes that live under a tab but are not a tab themselves, and which tab should look active
 *  while you are on them. Team is reached from Home's card and the launcher. */
const ACTIVE_ALIAS: Record<string, string> = { team: 'index' };

type TabBarProps = BottomTabBarProps & {
  /** Opens the log launcher. The centre button is not a route. */
  onLogPress: () => void;
};

export function TabBar({ state, navigation, onLogPress }: TabBarProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();

  const current = state.routes[state.index]?.name;
  const activeRoute = (current && ACTIVE_ALIAS[current]) ?? current;

  const left = SLOTS.slice(0, 2);
  const right = SLOTS.slice(2);

  const renderSlot = (slot: (typeof SLOTS)[number]) => {
    const index = state.routes.findIndex((r) => r.name === slot.route);
    if (index === -1) return <View key={slot.route} style={styles.slot} />;

    const focused = activeRoute === slot.route;
    const route = state.routes[index];

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) return;
      // Pressing the focused tab pops its stack to the root; from a hidden tab (Team) it goes home.
      navigation.navigate(route.name as never);
    };

    return (
      <Pressable
        key={slot.route}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={slot.label}
        style={({ pressed }) => [styles.slot, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <View style={[styles.pill, focused && { backgroundColor: theme.primarySoft }]}>
          <Icon name={slot.icon} size={24} color={focused ? 'primary' : 'muted'} />
        </View>
        <AppText variant="label" color={focused ? 'primary' : 'muted'}>
          {slot.label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View
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
      {left.map(renderSlot)}

      <View style={styles.centreSlot}>
        <Pressable
          onPress={onLogPress}
          accessibilityRole="button"
          accessibilityLabel="Log or do something"
          style={({ pressed }) => [
            styles.centre,
            { backgroundColor: pressed ? theme.primaryPressed : theme.primary },
            elevation(scheme, 'raised'),
            { transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Icon name="plus" size={24} color="onPrimary" />
        </Pressable>
      </View>

      {right.map(renderSlot)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  slot: { flex: 1, alignItems: 'center', gap: 2 },
  pill: {
    width: 56,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreSlot: { width: Size.tabCentre + Spacing.lg, alignItems: 'center' },
  centre: {
    width: Size.tabCentre,
    height: Size.tabCentre,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Sits proud of the bar's top edge. docs/design.md §6.1.
    marginTop: -14,
  },
});
