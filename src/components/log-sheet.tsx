import { useMemo } from 'react';
import { Modal, Pressable, View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { buildLauncher, type LauncherItem } from '@/lib/launcher';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

type LogSheetProps = { open: boolean; onClose: () => void };

/**
 * Opened by the tab bar's centre button: Record, Stock and (managers only) Manage, as plain grouped lists --
 * one card per group, a small icon, the name and a chevron. Quiet on purpose: it is a menu, not a dashboard. What each role may launch is
 * decided by `buildLauncher`, a tested pure function. Reads the current house from the pathname so every
 * house-scoped action carries `?house_id=` when opened from a house screen. docs/navigation-redesign-design.md.
 */
export function LogSheet({ open, onClose }: LogSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const pathname = usePathname();
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');

  const houseId = useMemo(() => /^\/houses\/([^/]+)$/.exec(pathname)?.[1] ?? null, [pathname]);
  const groups = useMemo(() => buildLauncher(isManager, houseId), [isManager, houseId]);

  const go = (item: LauncherItem) => {
    void Haptics.selectionAsync().catch(() => {});
    onClose();
    router.push(item.path as Href);
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: theme.ground }, elevation(scheme, 'sheet')]}
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
              <View style={[styles.card, { backgroundColor: theme.surface }, elevation(scheme, 'card')]}>
                {group.items.map((item, i) => (
                  <View key={item.label}>
                    {i > 0 ? <View style={[styles.rule, { backgroundColor: theme.line }]} /> : null}
                    <Pressable
                      onPress={() => go(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label}. ${item.description}`}
                      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceAlt }]}
                    >
                      <Icon name={item.icon} size={20} color="inkSoft" />
                      <AppText variant="body" style={styles.flex}>
                        {item.label}
                      </AppText>
                      <Icon name="chevron-right" size={18} color="muted" />
                    </Pressable>
                  </View>
                ))}
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
    maxHeight: '90%',
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
  card: { borderRadius: Radius.card, overflow: 'hidden' },
  row: {
    minHeight: Size.rowSingle - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg + 20 + Spacing.md },
});
