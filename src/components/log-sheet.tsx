import { useMemo } from 'react';
import { Modal, Pressable, View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, elevation, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

type LogAction = {
  label: string;
  description: string;
  path: string;
  icon: IconName;
  tint: Extract<ThemeColor, 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue'>;
  /** Manager rows sit below a divider, so the two tiers read as two groups
   *  without needing a second heading. */
  manager?: boolean;
};

/** Ordered by frequency — mortality is logged daily, treatment is not.
 *  docs/layout/00-app-shell.md. */
function buildActions(role: string | undefined, houseId: string | null): LogAction[] {
  const withHouse = (path: string) => (houseId ? `${path}?house_id=${houseId}` : path);

  const worker: LogAction[] = [
    {
      label: 'Mortality',
      description: 'Birds that died today',
      path: withHouse('/log/mortality'),
      icon: 'alert-circle',
      tint: 'tintRed',
    },
    {
      label: 'Feed',
      description: 'Feed or supplies drawn',
      path: withHouse('/log/consumption'),
      icon: 'package',
      tint: 'tintAmber',
    },
    {
      label: 'Weight',
      description: 'Average sample weight',
      path: withHouse('/log/weight'),
      icon: 'bar-chart-2',
      tint: 'tintBlue',
    },
    {
      label: 'Environment',
      description: 'Temperature, humidity, gas',
      path: withHouse('/log/environment'),
      icon: 'thermometer',
      tint: 'tintBlue',
    },
    {
      label: 'Treatment',
      description: 'Medication or vaccination',
      path: withHouse('/log/treatment'),
      icon: 'plus-square',
      tint: 'tintGreen',
    },
    {
      label: 'Move to house',
      description: 'Scan units into a house',
      path: withHouse('/scan/allocate'),
      icon: 'arrow-right',
      tint: 'tintGreen',
    },
    {
      label: 'Use an item',
      description: 'Scan a bottle or tool you used',
      path: withHouse('/scan/consume'),
      icon: 'box',
      tint: 'tintAmber',
    },
  ];

  if (!can(role, 'assign_task')) return worker;

  return [
    ...worker,
    {
      label: 'Rate someone',
      description: 'Give or take points',
      path: '/score',
      icon: 'award',
      tint: 'tintAmber',
      manager: true,
    },
    {
      label: 'Assign a task',
      description: 'Put work on a dashboard',
      path: '/assign',
      icon: 'check-square',
      tint: 'tintGreen',
      manager: true,
    },
    {
      label: 'Report discrepancy',
      description: "Stock doesn't match",
      path: withHouse('/adjust'),
      icon: 'clipboard',
      tint: 'tintAmber',
      manager: true,
    },
    {
      label: 'Link items',
      description: 'Scan QR codes onto a delivery',
      path: '/link',
      icon: 'maximize',
      tint: 'tintGreen',
      manager: true,
    },
  ];
}

type LogSheetProps = { open: boolean; onClose: () => void };

/**
 * Opened by the tab bar's centre button. Reads the current house from the
 * pathname (not a separate context) so every action carries `?house_id=` when
 * opened from a house screen, and asks when opened from anywhere else.
 * docs/PRD.md §5.
 */
export function LogSheet({ open, onClose }: LogSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pathname = usePathname();
  const { employee } = useSession();

  const houseId = useMemo(() => /^\/houses\/([^/]+)$/.exec(pathname)?.[1] ?? null, [pathname]);
  const actions = useMemo(() => buildActions(employee?.role, houseId), [employee?.role, houseId]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: theme.surface }, elevation(scheme, 'sheet')]}
        edges={['bottom']}
      >
        <View style={[styles.handle, { backgroundColor: theme.line }]} />

        <View style={styles.titleBlock}>
          <AppText variant="h2">Log an entry</AppText>
          {houseId ? (
            <AppText variant="caption" color="muted">
              For the house you&apos;re in
            </AppText>
          ) : null}
        </View>

        <ScrollView bounces={false}>
          {actions.map((action, i) => {
            const startsManagerGroup = action.manager && !actions[i - 1]?.manager;
            return (
              <View key={action.label}>
                {startsManagerGroup ? (
                  <View style={[styles.groupRule, { backgroundColor: theme.line }]} />
                ) : i > 0 ? (
                  <View style={[styles.rowRule, { backgroundColor: theme.line }]} />
                ) : null}

                <Pressable
                  onPress={() => {
                    onClose();
                    router.push(action.path as Href);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <IconTile name={action.icon} tint={action.tint} />
                  <View style={styles.rowText}>
                    <AppText variant="bodyStrong">{action.label}</AppText>
                    <AppText variant="caption" color="muted">
                      {action.description}
                    </AppText>
                  </View>
                  <Icon name="chevron-right" size={20} color="muted" />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    maxHeight: '80%',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  titleBlock: { padding: Spacing.xl, paddingBottom: Spacing.lg, gap: 2 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rowText: { flex: 1 },
  // Inset so it starts at the title, not under the tile.
  rowRule: { height: 1, marginLeft: 72 },
  groupRule: { height: 1, marginVertical: Spacing.sm },
});
