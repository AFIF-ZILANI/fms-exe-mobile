import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { SectionHead } from '@/components/house-stock';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData, type Paginated } from '@/lib/api';
import { ACTIVITY_LOOK, activityMeta, type ActivityEntry } from '@/lib/house-activity';

/** One line of a house's history: what happened, then detail, who and which batch, and when. */
export function ActivityRow({
  entry,
  stamp,
  first,
}: {
  entry: ActivityEntry;
  stamp: { time: string | null; day: string | null };
  first?: boolean;
}) {
  const theme = useTheme();
  const look = ACTIVITY_LOOK[entry.kind];
  const meta = activityMeta(entry);
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: theme.line }]}>
      <IconTile name={look.icon} tint={look.tint} color={look.color} size={32} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {entry.title}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {meta}
          </AppText>
        ) : null}
      </View>
      <View style={styles.stamp}>
        {stamp.time ? (
          <AppText variant="data" color="ink">
            {stamp.time}
          </AppText>
        ) : null}
        {stamp.day ? (
          <AppText variant="caption" color="muted">
            {stamp.day}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** The five latest things recorded in a house. Written as a hook so the screen refreshes it with the rest. */
export function useHouseActivityPreview(houseId: string) {
  return useGetData<Paginated<ActivityEntry>>(`/houses/${houseId}/activity?limit=5`, ['house-activity', houseId, 'preview']);
}

/** The house screen's "Recent activity": the latest five and a way into the full history. Renders nothing
 *  until the house has a history, like the other house cards. */
export function HouseActivityCard({
  houseId,
  results,
  stamp,
}: {
  houseId: string;
  results: ActivityEntry[] | undefined;
  stamp: (entry: ActivityEntry) => { time: string | null; day: string };
}) {
  const theme = useTheme();
  if (!results?.length) return null;
  return (
    <Card rows style={styles.card}>
      <SectionHead
        title="Recent activity"
        icon="activity"
        tint="surfaceAlt"
        tone="muted"
        onSeeAll={() => router.push(`/houses/${houseId}/activity` as Href)}
      />
      <View style={[styles.rows, { borderTopColor: theme.line }]}>
        {results.map((e, i) => (
          <ActivityRow key={`${e.kind}:${e.id}`} entry={e} stamp={stamp(e)} first={i === 0} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  stamp: { alignItems: 'flex-end', gap: 2 },
  card: { marginTop: Spacing.lg },
  rows: { borderTopWidth: 1 },
});
