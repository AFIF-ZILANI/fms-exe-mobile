import { useState } from 'react';
import { View, StyleSheet } from 'react-native';

import { FormScreen } from '@/components/ui/form-screen';
import { BatchPicker } from '@/components/ui/batch-picker';
import { ItemPicker } from '@/components/ui/item-picker';
import { NumberField } from '@/components/ui/number-field';
import { PillSelect } from '@/components/ui/pill-select';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { StatusPill } from '@/components/ui/status-pill';
import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import { dayOfCycle, expectedCycleDays } from '@/lib/farm';
import type { Batch, Item } from '@/lib/types';

type FeedType = 'PRE_STARTER' | 'STARTER' | 'GROWER' | 'FINISHER' | 'LAYER';

const FEED_TYPES: { value: FeedType; label: string }[] = [
  { value: 'PRE_STARTER', label: 'Pre-starter' },
  { value: 'STARTER', label: 'Starter' },
  { value: 'GROWER', label: 'Grower' },
  { value: 'FINISHER', label: 'Finisher' },
  { value: 'LAYER', label: 'Layer' },
];

type FeedingProgramEntry = {
  id: string;
  feed_type: FeedType;
  start_day: number;
  end_day: number | null;
  item: Item;
};

/** Gaps and overlaps in the day ranges. The server doesn't validate these, so
 *  a silent gap means a batch with no feed type on day 12 and nobody finds out
 *  until the feed hint on the consumption form says "no programme".
 *  docs/layout/17-feeding-program.md. */
function findProblems(rows: FeedingProgramEntry[]): string[] {
  const problems: string[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const row = rows[i];
    const next = rows[i + 1];
    if (row.end_day === null) {
      problems.push(`Open-ended phase from d${row.start_day} overlaps later phases`);
      continue;
    }
    if (next.start_day > row.end_day + 1) {
      problems.push(`No feed set for days ${row.end_day + 1}–${next.start_day - 1}`);
    } else if (next.start_day <= row.end_day) {
      problems.push(`Days ${next.start_day}–${row.end_day} are covered twice`);
    }
  }
  return problems;
}

/** docs/layout/17-feeding-program.md — which feed a batch gets, on which days.
 *  A viewer with an editing affordance, not a form: the timeline is the whole
 *  reason this is a screen, because a gap on day 12 is invisible in three rows
 *  of text and obvious in one bar. */
export default function FeedingProgramScreen() {
  const theme = useTheme();
  const submit = useQueuedSubmit();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [feedType, setFeedType] = useState<FeedType | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [startDay, setStartDay] = useState('');
  const [endDay, setEndDay] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: existing } = useGetData<Paginated<FeedingProgramEntry>>(
    batch ? `/batch-feeding-programs?batch_id=${batch.id}&limit=100` : '',
    ['batch-feeding-programs', batch?.id ?? 'none'],
    { enabled: !!batch },
  );

  const rows = [...(existing?.results ?? [])].sort((a, b) => a.start_day - b.start_day);
  const problems = findProblems(rows);

  const startNum = Number(startDay);
  const endNum = endDay.trim() ? Number(endDay) : null;
  const isValid =
    !!batch &&
    !!feedType &&
    !!item &&
    startNum >= 0 &&
    Number.isInteger(startNum) &&
    (endDay.trim() === '' || (endNum !== null && endNum >= startNum));

  const today = batch ? dayOfCycle(batch.starting_date) : 0;
  const total = batch ? expectedCycleDays(batch) : 35;

  const handleSubmit = async () => {
    if (!batch || !feedType || !item) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/batch-feeding-programs',
        body: {
          batch_id: batch.id,
          feed_type: feedType,
          item_id: item.id,
          start_day: startNum,
          ...(endNum !== null && { end_day: endNum }),
        },
      });
      // Stays on the screen to add the next phase — but only clears the fields
      // once the write is actually queued, so a failure doesn't wipe what the
      // manager just typed.
      if (queued) {
        setFeedType(null);
        setItem(null);
        setStartDay('');
        setEndDay('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
      title="Feeding program"
      dirty={!!feedType || !!item || !!startDay}
      submit={{
        label: 'Add phase',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <BatchPicker value={batch} onChange={setBatch} />

      {batch && (
        <Card rows eyebrow="Program" style={styles.card}>
          {rows.length === 0 ? (
            <EmptyState
              compact
              icon="calendar"
              tint="tintAmber"
              title="No feeding program set for this batch."
              body="Add a phase below to start."
            />
          ) : (
            <>
              {/* Opacity steps rather than distinct hues: the phases don't mean
                  anything different from each other, they're just adjacent. */}
              <View style={styles.timelineWrap}>
                <View style={styles.axis}>
                  <AppText variant="data" color="muted">
                    d0
                  </AppText>
                  <AppText variant="data" color="muted">
                    d{total}
                  </AppText>
                </View>
                <View style={[styles.timeline, { backgroundColor: theme.surfaceAlt }]}>
                  {rows.map((row, i) => {
                    const end = row.end_day ?? total;
                    const width = Math.max(0, Math.min(total, end) - row.start_day) / total;
                    return (
                      <View
                        key={row.id}
                        style={{
                          flex: Math.max(width, 0.01),
                          backgroundColor: theme.primary,
                          opacity: 1 - i * 0.22,
                        }}
                      />
                    );
                  })}
                </View>
                <AppText variant="caption" color="muted">
                  Today is d{today}
                </AppText>
              </View>

              {rows.map((row, i) => {
                const end = row.end_day;
                const isCurrent = today >= row.start_day && (end === null || today <= end);
                return (
                  <LedgerRow
                    key={row.id}
                    // 52dp: "11–24" doesn't fit the standard 44. The one gutter
                    // width exception in the app.
                    gutterWidth={52}
                    gutter={`${row.start_day}–${end ?? ''}`}
                    last={i === rows.length - 1}
                  >
                    <View style={styles.rowHead}>
                      <AppText variant="bodyStrong" style={styles.flex}>
                        {FEED_TYPES.find((f) => f.value === row.feed_type)?.label ?? row.feed_type}
                      </AppText>
                      {isCurrent ? <StatusPill status="CURRENT" /> : null}
                    </View>
                    <AppText variant="caption" color="muted">
                      {row.item.name}
                    </AppText>
                  </LedgerRow>
                );
              })}
            </>
          )}
        </Card>
      )}

      {problems.length > 0 && (
        <View style={[styles.warning, { backgroundColor: theme.tintAmber }]}>
          <Icon name="alert-triangle" size={20} color="warning" />
          <View style={styles.flex}>
            {problems.slice(0, 3).map((p) => (
              <AppText key={p} variant="caption">
                {p}
              </AppText>
            ))}
            {problems.length > 3 ? (
              <AppText variant="caption" color="muted">
                and {problems.length - 3} more
              </AppText>
            ) : null}
          </View>
        </View>
      )}

      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          Add a phase
        </AppText>
        <PillSelect options={FEED_TYPES} value={feedType} onChange={setFeedType} />
      </View>

      <ItemPicker value={item} onChange={setItem} category="FEED" />

      <View style={styles.days}>
        <View style={styles.flex}>
          <NumberField
            label="Start day"
            value={startDay}
            onChangeText={setStartDay}
            allowDecimal={false}
          />
        </View>
        <View style={styles.flex}>
          <NumberField
            label="End day"
            value={endDay}
            onChangeText={setEndDay}
            allowDecimal={false}
            helper="Blank = open-ended"
          />
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: Spacing.xs },
  group: { gap: Spacing.sm },
  timelineWrap: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  timeline: {
    flexDirection: 'row',
    height: 24,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    gap: 2,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  warning: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
  },
  days: { flexDirection: 'row', gap: Spacing.md },
});
