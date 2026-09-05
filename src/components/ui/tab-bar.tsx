import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { AppText } from '@/components/ui/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { can, type Capability } from '@/lib/permissions';

/**
 * The four slots, in fixed order. A slot the current role can't reach (Team,
 * for a Worker) renders as an empty column rather than collapsing — so the
 * centre button never shifts between roles and muscle memory survives a
 * promotion. docs/layout/00-app-shell.md.
 *
 * The capability is checked here rather than trusted from the navigator:
 * `href: null` hides a tab from expo-router's own bar but leaves the route in
 * navigation state, so a custom bar still sees it.
 */
const SLOTS: { route: string; label: string; icon: IconName; capability?: Capability }[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'houses', label: 'Houses', icon: 'grid' },
  { route: 'team', label: 'Team', icon: 'users', capability: 'assign_task' },
  { route: 'me', label: 'Me', icon: 'user' },
];

type TabBarProps = BottomTabBarProps & {
  /** Opens the log sheet. The centre button is not a route — it has no screen
   *  and no back state. docs/layout/00-app-shell.md. */
  onLogPress: () => void;
};

export function TabBar({ state, navigation, onLogPress }: TabBarProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const { employee } = useSession();

  const left = SLOTS.slice(0, 2);
  const right = SLOTS.slice(2);

  const renderSlot = (slot: (typeof SLOTS)[number]) => {
    const allowed = !slot.capability || can(employee?.role, slot.capability);
    const index = allowed ? state.routes.findIndex((r) => r.name === slot.route) : -1;

    // Out of reach for this role, or not registered — hold the column open.
    if (index === -1) return <View key={slot.route} style={styles.slot} />;

    const focused = state.index === index;
    const route = state.routes[index];

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) return;
      // Navigating to an already-focused tab pops its stack to the root, which
      // is the "second press goes home" behaviour the tab router gives us free.
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
        <View
          style={[
            styles.pill,
            focused && { backgroundColor: theme.primarySoft },
          ]}
        >
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
          accessibilityLabel="Log an entry"
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
