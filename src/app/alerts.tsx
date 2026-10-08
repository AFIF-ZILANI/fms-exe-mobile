import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';

import { InboxTabs } from '@/components/inbox-tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { FontFamily, Radius, Spacing, elevation, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  alertTarget,
  alertTypeLabel,
  countByLevel,
  filterAlerts,
  levelWord,
  sortAlerts,
  unseenAlerts,
  type LevelFilter,
} from '@/lib/alerts-view';
import { ApiError, apiFetch, useGetData, type Paginated } from '@/lib/api';
import { can } from '@/lib/permissions';
import { useSeenAlerts } from '@/lib/use-seen-alerts';
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

type AlertCardProps = {
  alert: FarmAlert;
  resolved: boolean;
  /** Not yet seen on this phone. */
  isNew?: boolean;
  /** Present for a manager on an active alert. Throws when the server could not be reached. */
  onResolve?: () => Promise<void>;
};

/** One alert as its own card. Tap to read the whole description and reach what it is about; the severity is
 *  an icon AND a word, and a new alert says so in words as well as a dot. */
function AlertCard({ alert, resolved, isNew, onResolve }: AlertCardProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const level = LEVEL_STYLE[alert.level];
  const when = formatRelative(resolved ? (alert.resolved_at ?? alert.issued_at) : alert.issued_at);
  const target = resolved ? null : alertTarget(alert);

  const resolve = async () => {
    if (!onResolve) return;
    setBusy(true);
    setFailed(false);
    try {
      await onResolve();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={[isNew ? 'New' : null, resolved ? 'Resolved' : levelWord(alert.level), alert.title, alert.description]
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
            {isNew ? (
              <View style={[styles.newTag, { backgroundColor: theme.primarySoft }]}>
                <AppText variant="caption" color="primary" style={styles.newText}>
                  New
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" color={resolved ? 'muted' : level.color}>
              {resolved ? 'Resolved' : levelWord(alert.level)}
            </AppText>
            <AppText variant="caption" color="muted">
              · {alertTypeLabel(alert.type)} · {when}
            </AppText>
          </View>

          {open && (target || onResolve) ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.actions}>
              {target ? (
                <Button
                  label={target.label}
                  variant="secondary"
                  icon="arrow-right"
                  onPress={() => router.push(target.href as Href)}
                />
              ) : null}
              {onResolve && !confirming ? (
                <Button label="Mark resolved" variant="ghost" onPress={() => setConfirming(true)} />
              ) : null}
              {onResolve && confirming ? (
                <View style={styles.confirm}>
                  <AppText variant="caption" color={failed ? 'critical' : 'muted'}>
                    {failed ? "Couldn't reach the server. Try again." : 'Resolve this alert for everyone?'}
                  </AppText>
                  <View style={styles.confirmRow}>
                    <View style={styles.flex}>
                      <Button label="Cancel" variant="ghost" disabled={busy} onPress={() => setConfirming(false)} />
                    </View>
                    <View style={styles.flex}>
                      <Button label="Resolve" variant="secondary" loading={busy} onPress={() => void resolve()} />
                    </View>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** docs/navigation-redesign-design.md Phase 3 — the farm's alerts, read-only. Severity is an icon AND a word. */
export default function AlertsScreen() {
  const theme = useTheme();
  const { signedIn, employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');
  const queryClient = useQueryClient();
  const { seen, markSeen } = useSeenAlerts();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LevelFilter>('ALL');
  const [showResolved, setShowResolved] = useState(false);

  // Same URL and key as Home's bell, so the cache is shared and the badge and list agree.
  const active = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const resolved = useGetData<Paginated<FarmAlert>>('/alerts?status=RESOLVED&limit=20', ['alerts', 'resolved']);

  const activeAll = sortAlerts(active.data?.results ?? []);

  // What the person has now been shown, saved when they leave so the "New" tags stay put during the visit.
  const shownIds = useRef<string[]>([]);
  useEffect(() => {
    shownIds.current = activeAll.map((a) => a.id);
  });
  useFocusEffect(
    useCallback(
      () => () => {
        void markSeen(shownIds.current);
      },
      [markSeen],
    ),
  );

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const newIds = new Set(seen ? unseenAlerts(activeAll, seen).map((a) => a.id) : []);
  const counts = countByLevel(activeAll);
  const activeList = filterAlerts(activeAll, filter);
  const resolvedList = sortAlerts(resolved.data?.results ?? [], false);

  // Online only, on purpose: resolving is a manager's supervisory call, not a field record, so it
  // does not go through the offline outbox. Already-resolved (409) counts as done.
  const resolveAlert = async (id: string) => {
    try {
      await apiFetch(`/alerts/${id}/resolve`, { method: 'POST' });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err;
    }
    await queryClient.invalidateQueries({ queryKey: ['alerts'] });
  };

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
      <View style={styles.tabs}>
        <InboxTabs current="alerts" />
      </View>

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
                <AlertCard
                  key={a.id}
                  alert={a}
                  resolved={false}
                  isNew={newIds.has(a.id)}
                  onResolve={isManager ? () => resolveAlert(a.id) : undefined}
                />
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
            Alerts clear on their own once the issue is fixed.
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
  tabs: { marginTop: Spacing.xs },
  chips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
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
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  newTag: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm },
  newText: { fontFamily: FontFamily.sansSemiBold },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
  confirm: { gap: Spacing.xs },
  confirmRow: { flexDirection: 'row', gap: Spacing.sm },
  resolvedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  note: { marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
});
