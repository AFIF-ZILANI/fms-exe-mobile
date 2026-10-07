import { useMemo } from 'react';
import { Modal, Pressable, View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { buildLauncher } from '@/lib/launcher';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

type LogSheetProps = { open: boolean; onClose: () => void };

/**
 * Opened by the tab bar's centre button: Record, Stock and (managers only) Manage. What each
 * role may launch is decided by `buildLauncher`, a tested pure function. Reads the current
 * house from the pathname so every house-scoped action carries `?house_id=` when opened from a
 * house screen. docs/navigation-redesign-design.md.
 */
export function LogSheet({ open, onClose }: LogSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pathname = usePathname();
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');

  const houseId = useMemo(() => /^\/houses\/([^/]+)$/.exec(pathname)?.[1] ?? null, [pathname]);
  const groups = useMemo(() => buildLauncher(isManager, houseId), [isManager, houseId]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: theme.surface }, elevation(scheme, 'sheet')]}
        edges={['bottom']}
      >
        <View style={[styles.handle, { backgroundColor: theme.line }]} />

        <View style={styles.titleBlock}>
          <AppText variant="h2">Quick actions</AppText>
          {houseId ? (
            <AppText variant="caption" color="muted">
              For the house you&apos;re in
            </AppText>
          ) : null}
        </View>

        <ScrollView bounces={false}>
          {groups.map((group) => (
            <View key={group.title}>
              <AppText variant="eyebrow" color="muted" style={styles.groupTitle}>
                {group.title}
              </AppText>
              {group.items.map((item, i) => (
                <View key={item.label}>
                  {i > 0 ? <View style={[styles.rowRule, { backgroundColor: theme.line }]} /> : null}
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(item.path as Href);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
                  >
                    <IconTile name={item.icon} tint={item.tint} />
                    <View style={styles.rowText}>
                      <AppText variant="bodyStrong">{item.label}</AppText>
                      <AppText variant="caption" color="muted">
                        {item.description}
                      </AppText>
                    </View>
                    <Icon name="chevron-right" size={20} color="muted" />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
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
    maxHeight: '85%',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  titleBlock: { padding: Spacing.xl, paddingBottom: Spacing.sm, gap: 2 },
  groupTitle: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xs },
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
});
