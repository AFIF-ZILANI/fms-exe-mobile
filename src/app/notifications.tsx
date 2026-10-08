import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { InboxTabs } from '@/components/inbox-tabs';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { IconTile } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch, useGetData, type Paginated } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { groupNotifications, notificationHref, notificationLook, unreadCount } from '@/lib/notifications-view';
import { useSession } from '@/lib/session';
import { NOTIFICATIONS_KEY, UNREAD_KEY } from '@/lib/use-unread-notifications';
import type { AppNotification } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;

/** What has happened to me: tasks given, points, pay, account changes. Read by tapping; tapping goes where it
 *  is about. The farm's own warnings are the other tab (Alerts). */
export default function NotificationsScreen() {
  const theme = useTheme();
  const { signedIn } = useSession();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  // Held in state: new Date() during render is impure, and grouping needs one stable "now".
  const [now] = useState(() => new Date());

  const list = useGetData<Paginated<AppNotification>>('/notifications?limit=50', NOTIFICATIONS_KEY, {
    enabled: signedIn,
  });
  const items = list.data?.results ?? [];
  const unread = unreadCount(items);

  // After logout the session clears before the route unmounts; render nothing rather than flash.
  if (!signedIn) return null;

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  // Online only, on purpose: reading a notification is not a field record, so it skips the offline outbox.
  // The row flips to read at once; if the server never hears, the next refresh shows it unread again.
  const open = (n: AppNotification) => {
    if (!n.read_at) {
      const readAt = new Date().toISOString();
      queryClient.setQueryData<Paginated<AppNotification>>(NOTIFICATIONS_KEY, (old) =>
        old ? { ...old, results: old.results.map((x) => (x.id === n.id ? { ...x, read_at: readAt } : x)) } : old,
      );
      queryClient.setQueryData<{ count: number }>(UNREAD_KEY, (old) =>
        old ? { count: Math.max(0, old.count - 1) } : old,
      );
      void apiFetch(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {}).finally(settle);
    }
    const href = notificationHref(n);
    if (href) router.push(href as Href);
  };

  const markAll = () => {
    const readAt = new Date().toISOString();
    queryClient.setQueryData<Paginated<AppNotification>>(NOTIFICATIONS_KEY, (old) =>
      old ? { ...old, results: old.results.map((x) => ({ ...x, read_at: x.read_at ?? readAt })) } : old,
    );
    queryClient.setQueryData<{ count: number }>(UNREAD_KEY, { count: 0 });
    void apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => {}).finally(settle);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([
        Promise.allSettled([list.refetch(), queryClient.invalidateQueries({ queryKey: UNREAD_KEY })]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const loading = list.isPending && !list.data;
  const failed = list.isError && !list.data;
  const groups = groupNotifications(items, now);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header
        title="Notifications"
        leading="back"
        action={unread > 0 ? { icon: 'check-circle', label: 'Mark all as read', onPress: markAll } : undefined}
      />
      <SyncBanner />
      <View style={styles.tabs}>
        <InboxTabs current="notifications" />
      </View>

      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} />
          ))}
        </View>
      ) : failed ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load notifications."
            action={{ label: 'Retry', onPress: () => void list.refetch() }}
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="bell"
            tint="surfaceAlt"
            title="You're all caught up."
            body="Tasks, points and pay updates for you show up here."
          />
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.title} rows eyebrow={group.title} style={styles.card}>
            {group.items.map((n, i) => {
              const look = notificationLook(n.kind);
              const isUnread = !n.read_at;
              return (
                <Pressable
                  key={n.id}
                  onPress={() => open(n)}
                  accessibilityRole="button"
                  accessibilityLabel={[isUnread ? 'Unread' : null, n.title, n.body].filter(Boolean).join('. ')}
                  style={({ pressed }) => [
                    styles.row,
                    i < group.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
                    pressed && { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <IconTile name={look.icon} tint={look.tint} color={isUnread ? 'ink' : 'muted'} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color={isUnread ? 'ink' : 'inkSoft'}>
                      {n.title}
                    </AppText>
                    {n.body ? (
                      <AppText variant="caption" color="inkSoft" numberOfLines={2}>
                        {n.body}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color="muted">
                      {formatRelative(n.created_at)}
                    </AppText>
                  </View>
                  {isUnread ? <View style={[styles.dot, { backgroundColor: theme.primary }]} /> : null}
                </Pressable>
              );
            })}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { marginTop: Spacing.xs },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, marginTop: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Size.row,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dot: { width: 10, height: 10, borderRadius: Radius.pill },
});
