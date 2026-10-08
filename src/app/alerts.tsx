import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { alertTypeLabel, levelWord, sortAlerts } from '@/lib/alerts-view';
import { useGetData, type Paginated } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { AlertLevel, FarmAlert } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

const LEVEL_ICON: Record<AlertLevel, { icon: IconName; color: ThemeColor }> = {
  CRITICAL: { icon: 'alert-octagon', color: 'critical' },
  WARNING: { icon: 'alert-triangle', color: 'warning' },
  INFO: { icon: 'info', color: 'info' },
};

/** docs/navigation-redesign-design.md Phase 3 — the farm's alerts, read-only. Severity is an icon AND a word. */
export default function AlertsScreen() {
  const theme = useTheme();
  const { signedIn } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  // Same URL and key as Home's bell, so the cache is shared and the badge and list agree.
  const active = useGetData<Paginated<FarmAlert>>('/alerts?status=ACTIVE&limit=50', ['alerts', 'active']);
  const resolved = useGetData<Paginated<FarmAlert>>('/alerts?status=RESOLVED&limit=20', ['alerts', 'resolved']);

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const activeList = sortAlerts(active.data?.results ?? []);
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

  const row = (alert: FarmAlert, last: boolean, isResolved: boolean) => {
    const { icon, color } = isResolved ? { icon: 'check-circle' as IconName, color: 'muted' as ThemeColor } : LEVEL_ICON[alert.level];
    return (
      <View
        key={alert.id}
        accessible
        accessibilityLabel={`${levelWord(alert.level)}. ${alert.title}. ${alert.description ?? ''}`}
        style={[styles.item, !last && { borderBottomWidth: 1, borderBottomColor: theme.line }]}
      >
        <Icon name={icon} size={20} color={color} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={isResolved ? 'inkSoft' : 'ink'}>
            {alert.title}
          </AppText>
          {alert.description ? (
            <AppText variant="body" color="inkSoft" numberOfLines={3}>
              {alert.description}
            </AppText>
          ) : null}
          <AppText variant="caption" color={isResolved ? 'muted' : color}>
            {isResolved ? 'Resolved' : levelWord(alert.level)} · {alertTypeLabel(alert.type)} ·{' '}
            {formatRelative(isResolved ? (alert.resolved_at ?? alert.issued_at) : alert.issued_at)}
          </AppText>
        </View>
      </View>
    );
  };

  const loading = (active.isPending && !active.data) || (resolved.isPending && !resolved.data);
  const failed = (active.isError && !active.data) || (resolved.isError && !resolved.data);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="Alerts" leading="back" />
      <SyncBanner />

      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={84} />
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
          {activeList.length === 0 ? (
            <Card style={styles.card}>
              <EmptyState
                compact
                icon="check-circle"
                tint="tintGreen"
                title="No active alerts."
                body="Anything that needs attention shows up here."
              />
            </Card>
          ) : (
            <Card eyebrow="Active" note={String(active.data?.total ?? activeList.length)} style={styles.card}>
              {activeList.map((a, i) => row(a, i === activeList.length - 1, false))}
            </Card>
          )}

          {resolvedList.length > 0 ? (
            <Card eyebrow="Resolved" style={styles.card}>
              {resolvedList.map((a, i) => row(a, i === resolvedList.length - 1, true))}
            </Card>
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
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  item: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md },
  note: { marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
});
