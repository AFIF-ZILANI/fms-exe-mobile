import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, elevation, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { alertTypeLabel, countByLevel, filterAlerts, levelWord, sortAlerts, type LevelFilter } from '@/lib/alerts-view';
import { useGetData, type Paginated } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { AlertLevel, FarmAlert } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

const LEVEL_STYLE: Record<
  AlertLevel,
  { icon: IconName; color: ThemeColor; tint: 'tintRed' | 'tintAmber' | 'tintBlue' }
> = {
  CRITICAL: { icon: 'alert-octagon', color: 'critical', tint: 'tintRed' },
  WARNING: { icon: 'alert-triangle', color: 'warning', tint: 'tintAmber' },
  INFO: { icon: 'info', color: 'info', tint: 'tintBlue' },
};

const FILTERS: { value: LevelFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'INFO', label: 'Info' },
];

/** One alert as its own card. Tap to read the whole description; the severity is an icon AND a word. */
function AlertCard({ alert, resolved }: { alert: FarmAlert; resolved: boolean }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [open, setOpen] = useState(false);
  const level = LEVEL_STYLE[alert.level];
  const when = formatRelative(resolved ? (alert.resolved_at ?? alert.issued_at) : alert.issued_at);

  return (
    <Animated.View layout={LinearTransition.duration(200)} entering={FadeIn.duration(200)}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={[resolved ? 'Resolved' : levelWord(alert.level), alert.title, alert.description]
          .filter(Boolean)
          .join('. ')}
        style={({ pressed }) => [
          styles.alert,
          { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
          elevation(scheme, 'card'),
        ]}
      >
        {resolved ? (
          <IconTile name="check-circle" tint="surfaceAlt" color="muted" />
        ) : (
          <IconTile name={level.icon} tint={level.tint} color={level.color} />
        )}
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={resolved ? 'inkSoft' : 'ink'}>
            {alert.title}
          </AppText>
          {alert.description ? (
            <AppText variant="body" color="inkSoft" numberOfLines={open ? undefined : 2}>
              {alert.description}
            </AppText>
          ) : null}
          <View style={styles.meta}>
            <AppText variant="caption" color={resolved ? 'muted' : level.color}>
              {resolved ? 'Resolved' : levelWord(alert.level)}
            </AppText>
            <AppText variant="caption" color="muted">
              · {alertTypeLabel(alert.type)} · {when}
            </AppText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** docs/navigation-redesign-design.md Phase 3 — the farm's alerts, read-only. Severity is an icon AND a word. */
export default function AlertsScreen() {
  const theme = useTheme();
  const { signedIn } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LevelFilter>('ALL');
  const [showResolved, setShowResolved] = useState(false);

  // Same URL and key as Home's bell, so the cache is shared and the badge and list agree.
  const active = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const resolved = useGetData<Paginated<FarmAlert>>('/alerts?status=RESOLVED&limit=20', ['alerts', 'resolved']);

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const activeAll = sortAlerts(active.data?.results ?? []);
  const counts = countByLevel(activeAll);
  const activeList = filterAlerts(activeAll, filter);
  const resolvedList = sortAlerts(resolved.data?.results ?? [], false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([
        Promise.allSettled([active.refetch(), resolved.refetch()]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Resolved is optional: only the Active list gates loading and failure.
  const loading = active.isPending && !active.data;
  const failed = active.isError && !active.data;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="Alerts" leading="back" />
      <SyncBanner />

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={96} />
          ))}
        </View>
      ) : failed ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load alerts."
            action={{
              label: 'Retry',
              onPress: () => void Promise.all([active.refetch(), resolved.refetch()]),
            }}
          />
        </Card>
      ) : (
        <>
          <View style={styles.chips}>
            {FILTERS.map((f) => {
              const on = filter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${f.label}, ${counts[f.value]}`}
                  style={[
                    styles.chip,
                    { backgroundColor: on ? theme.primary : theme.surface, borderColor: on ? theme.primary : theme.line },
                  ]}
                >
                  <AppText variant="label" color={on ? 'onPrimary' : 'inkSoft'}>
                    {f.label}
                  </AppText>
                  <AppText variant="data" color={on ? 'onPrimary' : 'muted'}>
                    {counts[f.value]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {activeList.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState
                compact
                icon="check-circle"
                tint="tintGreen"
                title={filter === 'ALL' ? 'No active alerts.' : `No ${levelWord(filter).toLowerCase()} alerts.`}
                body="Anything that needs attention shows up here."
              />
            </Card>
          ) : (
            <View style={styles.list}>
              {activeList.map((a) => (
                <AlertCard key={a.id} alert={a} resolved={false} />
              ))}
            </View>
          )}

          {resolvedList.length > 0 ? (
            <>
              <Pressable
                onPress={() => setShowResolved((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showResolved }}
                style={styles.resolvedToggle}
              >
                <AppText variant="eyebrow" color="muted" style={styles.flex}>
                  Resolved · {resolvedList.length}
                </AppText>
                <Icon name={showResolved ? 'chevron-up' : 'chevron-down'} size={18} color="muted" />
              </Pressable>
              {showResolved ? (
                <View style={styles.list}>
                  {resolvedList.map((a) => (
                    <AlertCard key={a.id} alert={a} resolved />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          <AppText variant="caption" color="muted" style={styles.note}>
            Alerts are resolved by your manager.
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.md },
  list: { gap: Spacing.sm, marginTop: Spacing.md },
  chips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  alert: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  meta: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  resolvedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  note: { marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
});
