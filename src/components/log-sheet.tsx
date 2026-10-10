import { useMemo } from 'react';
import { Modal, Pressable, View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { buildLauncher, type LauncherItem } from '@/lib/launcher';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

type LogSheetProps = { open: boolean; onClose: () => void };

const COLUMNS = 3;
const GAP = Spacing.sm;

/**
 * Opened by the tab bar's centre button: Record, Stock and (managers only) Manage, as a grid of big tiles
 * (three to a row) so a worker finds the one they want without scrolling a list. What each role may launch is
 * decided by `buildLauncher`, a tested pure function. Reads the current house from the pathname so every
 * house-scoped action carries `?house_id=` when opened from a house screen. docs/navigation-redesign-design.md.
 */
export function LogSheet({ open, onClose }: LogSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');

  const houseId = useMemo(() => /^\/houses\/([^/]+)$/.exec(pathname)?.[1] ?? null, [pathname]);
  const groups = useMemo(() => buildLauncher(isManager, houseId), [isManager, houseId]);

  const tileWidth = (width - Spacing.xl * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const go = (item: LauncherItem) => {
    void Haptics.selectionAsync().catch(() => {});
    onClose();
    router.push(item.path as Href);
  };

  let index = 0;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: theme.surface }, elevation(scheme, 'sheet')]}
        edges={['bottom']}
      >
        <View style={[styles.handle, { backgroundColor: theme.line }]} />

        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <AppText variant="h2">Quick actions</AppText>
            {houseId ? (
              <AppText variant="caption" color="muted">
                For the house you&apos;re in
              </AppText>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={[styles.close, { backgroundColor: theme.surfaceAlt }]}
          >
            <Icon name="x" size={20} color="inkSoft" />
          </Pressable>
        </View>

        <ScrollView bounces={false} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <AppText variant="eyebrow" color="muted" style={styles.groupTitle}>
                {group.title}
              </AppText>
              <View style={styles.grid}>
                {group.items.map((item) => {
                  const delay = 40 * index++;
                  return (
                    <Animated.View key={item.label} entering={FadeInDown.duration(220).delay(delay)}>
                      <Pressable
                        onPress={() => go(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.label}. ${item.description}`}
                        style={({ pressed }) => [
                          styles.tile,
                          {
                            width: tileWidth,
                            backgroundColor: pressed ? theme.surfaceAlt : theme.ground,
                            transform: [{ scale: pressed ? 0.96 : 1 }],
                          },
                        ]}
                      >
                        <IconTile name={item.icon} tint={item.tint} size={40} />
                        <AppText variant="label" numberOfLines={2} style={styles.tileLabel}>
                          {item.label}
                        </AppText>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  group: { marginTop: Spacing.md },
  groupTitle: { marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    // Fixed, so a two-line label ("Report discrepancy") doesn't make its row taller than the rest.
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.card,
  },
  tileLabel: { textAlign: 'center' },
});
