import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { SyncBanner } from '@/components/ui/sync-banner';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { can } from '@/lib/permissions';
import { humanise } from '@/lib/profile-format';
import { useSession } from '@/lib/session';
import { formatBalance, summarizeStock, type StockRow } from '@/lib/stock-summary';
import type { Item } from '@/lib/types';

type Filter = 'ALL' | 'LOW';

const WORKER_SHORTCUTS: { label: string; path: string; icon: IconName }[] = [
  { label: 'Move to house', path: '/scan/allocate', icon: 'arrow-right' },
  { label: 'Use an item', path: '/scan/consume', icon: 'box' },
];

/** docs/navigation-redesign-design.md — what stock there is, what is running low, and the scan actions. */
export default function StockScreen() {
  const theme = useTheme();
  const { employee } = useSession();
  const isManager = can(employee?.role, 'assign_task');
  const [filter, setFilter] = useState<Filter>('ALL');

  const items = useGetData<Paginated<Item>>('/items?is_active=true&limit=100', ['items', 'active']);
  const rows = useGetData<StockRow[]>('/items/stock-by-location', ['items', 'stock-by-location']);

  const lines = useMemo(
    () => summarizeStock(items.data?.results ?? [], rows.data ?? []),
    [items.data, rows.data],
  );
  const lowCount = lines.filter((l) => l.isLow).length;
  const shown = filter === 'LOW' ? lines.filter((l) => l.isLow) : lines;

  const shortcuts = isManager
    ? [...WORKER_SHORTCUTS, { label: 'Link items', path: '/link', icon: 'maximize' as IconName }]
    : WORKER_SHORTCUTS;

  const isLoading = items.isLoading || rows.isLoading;
  const isError = (items.isError && !items.data) || (rows.isError && !rows.data);

  return (
    <Screen>
      <Header title="Stock" />
      <SyncBanner />

      <View style={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Pressable
            key={s.path}
            onPress={() => router.push(s.path as Href)}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            style={({ pressed }) => [
              styles.shortcut,
              { backgroundColor: theme.surfaceAlt },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <Icon name={s.icon} size={20} color="primary" />
            <AppText variant="label" style={styles.flex}>
              {s.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['ALL', 'LOW'] as const).map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme.primarySoft : theme.surface,
                  borderColor: active ? theme.primary : theme.line,
                },
              ]}
            >
              <AppText variant="label" color={active ? 'primary' : 'inkSoft'}>
                {f === 'ALL' ? 'All' : `Low${lowCount ? ` · ${lowCount}` : ''}`}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card rows style={styles.card}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} />
            ))}
          </View>
        ) : isError ? (
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
        ) : lines.length === 0 ? (
          <EmptyState compact icon="archive" tint="surfaceAlt" title="No items yet." body="Items are set up in the admin dashboard." />
        ) : shown.length === 0 ? (
          <EmptyState
            compact
            icon="check-circle"
            tint="tintGreen"
            title="Nothing below reorder level right now."
            action={{ label: 'Show all', onPress: () => setFilter('ALL') }}
          />
        ) : (
          shown.map((line, i) => (
            <LedgerRow
              key={line.item.id}
              gutterNode={
                <IconTile
                  name="package"
                  tint={line.isLow ? 'tintAmber' : 'surfaceAlt'}
                  color={line.isLow ? 'warning' : 'muted'}
                  size={32}
                />
              }
              last={i === shown.length - 1}
            >
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                  {line.item.name}
                </AppText>
                <AppText variant="figure" color={line.isLow ? 'warning' : 'ink'}>
                  {formatBalance(line.balance)}
                </AppText>
              </View>
              <View style={styles.rowTop}>
                <AppText variant="caption" color="muted" style={styles.flex}>
                  {humanise(line.item.category)} · {line.item.unit.toLowerCase()}
                </AppText>
                {line.isLow ? <StatusPill status="LOW" label="Low" /> : null}
              </View>
            </LedgerRow>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.xs },
  shortcut: {
    width: '47.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
  },
  filters: { gap: Spacing.sm, marginTop: Spacing.md },
  chip: {
    minHeight: Size.chip,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
