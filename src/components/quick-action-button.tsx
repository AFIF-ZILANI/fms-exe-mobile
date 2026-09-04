import { useMemo, useState } from 'react';
import { Modal, Pressable, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';
import { AppText } from '@/components/ui/text';
import { Divider } from '@/components/ui/divider';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { can } from '@/lib/permissions';

/** Routes the FAB disappears on -- every form screen, plus the identity
 *  switcher. docs/PRD.md §5. Prefix-matched, so the five /log/* forms are
 *  covered by one entry rather than listed individually. */
const HIDDEN_ON = [
  '/profile',
  '/log/',
  '/assign',
  '/score',
  '/transfer',
  '/feeding-program',
  '/receive',
  '/adjust',
  '/flag-stock',
];

const isHidden = (pathname: string) =>
  HIDDEN_ON.some((route) => pathname === route || pathname.startsWith(route));

type QuickAction = { label: string; path: string };

function buildActions(role: string | undefined, houseId: string | null): QuickAction[] {
  const withHouse = (path: string) => (houseId ? `${path}?house_id=${houseId}` : path);

  const worker: QuickAction[] = [
    { label: 'Log mortality', path: withHouse('/log/mortality') },
    { label: 'Log feed / consumption', path: withHouse('/log/consumption') },
    { label: 'Log weight sample', path: withHouse('/log/weight') },
    { label: 'Log environment reading', path: withHouse('/log/environment') },
    { label: 'Log treatment', path: withHouse('/log/treatment') },
  ];

  if (!can(role, 'assign_task')) return worker;

  return [
    ...worker,
    { label: 'Rate an employee', path: '/score' },
    { label: 'Assign a task', path: '/assign' },
    { label: 'Report stock discrepancy', path: withHouse('/adjust') },
  ];
}

/**
 * A persistent FAB rendered once in the root layout -- docs/PRD.md §5. Reads
 * the current house from the pathname itself (not a separate context) so
 * every action carries `?house_id=` when opened from a house screen, and
 * asks when opened from anywhere else.
 */
export function QuickActionButton() {
  const theme = useTheme();
  const pathname = usePathname();
  const { employee } = useSession();
  const [open, setOpen] = useState(false);

  const houseId = useMemo(() => /^\/houses\/([^/]+)$/.exec(pathname)?.[1] ?? null, [pathname]);
  const actions = useMemo(() => buildActions(employee?.role, houseId), [employee?.role, houseId]);

  if (!employee || isHidden(pathname)) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Quick actions"
        style={[styles.fab, { backgroundColor: theme.ink }]}
      >
        <AppText variant="title" color="paper">
          +
        </AppText>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.paper }]} edges={['bottom']}>
          {actions.map((action, i) => (
            <View key={action.label}>
              {i > 0 && <Divider />}
              <Pressable
                onPress={() => {
                  setOpen(false);
                  router.push(action.path as Href);
                }}
                accessibilityRole="button"
                style={styles.row}
              >
                <AppText variant="body">{action.label}</AppText>
              </Pressable>
            </View>
          ))}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: Radius * 2, borderTopRightRadius: Radius * 2, paddingHorizontal: Spacing.three },
  row: { minHeight: 56, justifyContent: 'center' },
});
