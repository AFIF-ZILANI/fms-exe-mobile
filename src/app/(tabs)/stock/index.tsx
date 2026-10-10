import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconName } from '@/components/ui/icon';
import { StockItemCard, categoryIcon } from '@/components/stock-item-card';
import { Skeleton } from '@/components/ui/skeleton';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { can } from '@/lib/permissions';
import { humanise } from '@/lib/profile-format';
import { useSession } from '@/lib/session';
import {
  attentionOrder,
  categoryCounts,
  filterStock,
  searchStock,
  statusCounts,
  summarizeStock,
  type StockFilter,
  type StockRow,
} from '@/lib/stock-summary';
import type { Item } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;
const PAGE = 100;

const WORKER_SHORTCUTS: { label: string; path: string; icon: IconName }[] = [
  { label: 'Move to house', path: '/scan/allocate', icon: 'arrow-right' },
  { label: 'Use an item', path: '/scan/consume', icon: 'box' },
];

const STATUS_CHIPS: { value: StockFilter['status']; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'LOW', label: 'Low' },
  { value: 'OUT', label: 'Out' },
];

const EMPTY_BY_STATUS = {
  LOW: 'Nothing is below its reorder level.',
  OUT: 'Nothing is out of stock.',
} as const;

/** docs/navigation-redesign-design.md — what stock there is, what is running low, and the scan actions. */
export default function StockScreen() {
  const theme = useTheme();
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');
  const [status, setStatus] = useState<StockFilter['status']>('ALL');
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ponytail: limit=100 is the server max; past that the list says so (see `truncated`). Page it if a farm ever has more.
  const items = useGetData<Paginated<Item>>('/items?is_active=true&limit=100', ['items', 'active']);
  const rows = useGetData<StockRow[]>('/items/stock-by-location', ['items', 'stock-by-location']);

  const lines = useMemo(
    () => summarizeStock(items.data?.results ?? [], rows.data ?? []),
    [items.data, rows.data],
  );
  const counts = statusCounts(lines);
  const categories = categoryCounts(lines);
  const shown = attentionOrder(searchStock(filterStock(lines, { status, category }), query));
  const searching = query.trim().length > 0;
  const truncated = (items.data?.total ?? 0) > PAGE;

  const shortcuts = isManager
    ? [...WORKER_SHORTCUTS, { label: 'Link items', path: '/link', icon: 'maximize' as IconName }]
    : WORKER_SHORTCUTS;

  // `isPending`, not `isLoading`: offline with nothing cached a query is paused and never "loading".
  const isLoading = (items.isPending && !items.data) || (rows.isPending && !rows.data);
  const offlineNoData =
    (items.isPending && items.fetchStatus === 'paused') || (rows.isPending && rows.fetchStatus === 'paused');

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([
        Promise.allSettled([items.refetch(), rows.refetch()]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  const isError = (items.isError && !items.data) || (rows.isError && !rows.data);
  const clearFilters = () => {
    setStatus('ALL');
    setCategory(null);
    setQuery('');
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="Stock" />
      <SyncBanner />

      {/* The scan actions, compact: they are shortcuts, not the point of the screen. */}
      <View style={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Pressable
            key={s.path}
            onPress={() => router.push(s.path as Href)}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            style={({ pressed }) => [
              styles.shortcut,
              { backgroundColor: theme.surface, borderColor: theme.line },
              pressed && { backgroundColor: theme.surfaceAlt },
            ]}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: theme.primarySoft }]}>
              <Icon name={s.icon} size={20} color="primary" />
            </View>
            <AppText variant="caption" color="inkSoft" numberOfLines={1}>
              {s.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <Icon name="search" size={20} color="muted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search items"
          placeholderTextColor={theme.muted}
          accessibilityLabel="Search items"
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.searchInput, { color: theme.ink }]}
        />
        {searching ? (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={12}>
            <Icon name="x" size={20} color="muted" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chips}>
        {STATUS_CHIPS.map((c) => {
          const on = status === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => setStatus(c.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${c.label}, ${counts[c.value]}`}
              style={[
                styles.chip,
                { backgroundColor: on ? theme.primary : theme.surface, borderColor: on ? theme.primary : theme.line },
              ]}
            >
              <AppText variant="label" color={on ? 'onPrimary' : 'inkSoft'}>
                {c.label}
              </AppText>
              <AppText variant="data" color={on ? 'onPrimary' : 'muted'}>
                {counts[c.value]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {categories.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {categories.map((c) => {
            const on = category === c.category;
            return (
              <Pressable
                key={c.category}
                onPress={() => setCategory(on ? null : c.category)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${humanise(c.category)}, ${c.count}`}
                style={[
                  styles.chipSmall,
                  {
                    backgroundColor: on ? theme.primarySoft : theme.surface,
                    borderColor: on ? theme.primary : theme.line,
                  },
                ]}
              >
                <Icon name={categoryIcon(c.category)} size={16} color={on ? 'primary' : 'muted'} />
                <AppText variant="label" color={on ? 'primary' : 'inkSoft'}>
                  {humanise(c.category)}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={88} />
          ))}
        </View>
      ) : offlineNoData ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="wifi-off"
            tint="surfaceAlt"
            title="You're offline."
            body="Stock shows up once you're connected."
          />
        </Card>
      ) : isError ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load stock."
            action={{
              label: 'Retry',
              onPress: () => {
                void items.refetch();
                void rows.refetch();
              },
            }}
          />
        </Card>
      ) : lines.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState compact icon="archive" tint="surfaceAlt" title="No items yet." body="Items are set up in the admin dashboard." />
        </Card>
      ) : shown.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon={searching ? 'search' : 'check-circle'}
            tint={searching ? 'surfaceAlt' : 'tintGreen'}
            title={searching ? 'No items match.' : status === 'ALL' ? 'Nothing in this category.' : EMPTY_BY_STATUS[status]}
            action={{ label: 'Clear filters', onPress: clearFilters }}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {shown.map((line) => (
            <StockItemCard key={line.item.id} line={line} />
          ))}
        </View>
      )}

      {truncated ? (
        <AppText variant="caption" color="muted" style={styles.note}>
          Showing the first {PAGE} items. Search to narrow the list.
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shortcuts: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.card,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
  searchInput: { flex: 1, minHeight: 48, fontSize: 16 },
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
  categories: { gap: Spacing.sm, marginTop: Spacing.sm },
  chipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: Size.chip,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  note: { marginTop: Spacing.md, paddingHorizontal: Spacing.xs },
  card: { marginTop: Spacing.md },
  list: { gap: Spacing.sm, marginTop: Spacing.md },
});
