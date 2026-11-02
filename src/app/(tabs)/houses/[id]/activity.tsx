import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';

import { ActivityRow } from '@/components/house-activity';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { apiFetch, useGetData, type Paginated } from '@/lib/api';
import { activityTime, groupByDay, type ActivityEntry } from '@/lib/house-activity';
import type { House } from '@/lib/types';

const PAGE = 30;

/** houses/:id/activity -- everything recorded in the house, newest first, under a heading per farm day. */
export default function HouseActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Read once per mount and on pull-down: `new Date()` during render is impure.
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const houseQ = useGetData<House>(`/houses/${id}`, ['houses', id]);
  const listQ = useInfiniteQuery({
    queryKey: ['house-activity', id, 'all'],
    queryFn: ({ pageParam }) =>
      apiFetch<Paginated<ActivityEntry>>(`/houses/${id}/activity?page=${pageParam}&limit=${PAGE}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const entries = listQ.data?.pages.flatMap((p) => p.results) ?? [];
  const total = listQ.data?.pages[0]?.total ?? 0;
  const groups = groupByDay(entries, now);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setNow(new Date());
      await Promise.allSettled([houseQ.refetch(), listQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <Header title="Activity" eyebrow={houseQ.data?.name} leading="back" />

      {listQ.isPending ? (
        <Skeleton height={240} />
      ) : listQ.isError && !listQ.data ? (
        <Card>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this."
            action={{ label: 'Retry', onPress: () => void listQ.refetch() }}
          />
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon="activity"
            tint="surfaceAlt"
            title="Nothing recorded here yet."
            body="Deaths, supplies used, weights, readings and moves in this house show up here."
          />
        </Card>
      ) : (
        <>
          {groups.map((g) => (
            <View key={g.label} style={styles.group}>
              <View style={styles.dayHead}>
                <AppText variant="h2">{g.label}</AppText>
                <AppText variant="caption" color="muted">
                  {g.entries.length}
                </AppText>
              </View>
              <Card rows>
                {g.entries.map((e, i) => (
                  <ActivityRow key={`${e.kind}:${e.id}`} entry={e} stamp={activityTime(e)} first={i === 0} />
                ))}
              </Card>
            </View>
          ))}
          <AppText variant="caption" color="muted" style={styles.count}>
            {entries.length} of {total}
          </AppText>
          {listQ.hasNextPage ? (
            <Button
              variant="ghost"
              label="Show more"
              block
              loading={listQ.isFetchingNextPage}
              onPress={() => void listQ.fetchNextPage()}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: Spacing.lg },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  count: { textAlign: 'center', marginTop: Spacing.lg },
});
