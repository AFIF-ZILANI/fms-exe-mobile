import { useState } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { BatchPicker } from '@/components/ui/batch-picker';
import { ItemPicker } from '@/components/ui/item-picker';
import { NumberField } from '@/components/ui/number-field';
import { PillSelect } from '@/components/ui/pill-select';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { LedgerRow } from '@/components/ui/ledger-row';
import { AppText } from '@/components/ui/text';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
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

/** docs/PRD.md §6.17. The server doesn't validate day ranges, so a silent
 *  gap or overlap means a batch with no feed type on some day -- flagged
 *  here rather than assumed away. */
export default function FeedingProgramScreen() {
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

  const startNum = Number(startDay);
  const endNum = endDay.trim() ? Number(endDay) : null;
  const isValid =
    !!batch && !!feedType && !!item && startNum >= 0 && Number.isInteger(startNum) &&
    (endDay.trim() === '' || (endNum !== null && endNum >= startNum));

  const rows = [...(existing?.results ?? [])].sort((a, b) => a.start_day - b.start_day);
  const hasGapOrOverlap = rows.some((row, i) => {
    const next = rows[i + 1];
    if (!next || row.end_day === null) return false;
    return next.start_day !== row.end_day + 1;
  });

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
      // Stays on the screen to add the next phase -- but only clears the
      // fields once the write is actually queued, so a failure doesn't wipe
      // what the manager just typed.
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
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Feeding program' }} />
      <Section label="Batch" />
      <BatchPicker value={batch} onChange={setBatch} />

      {batch && (
        <>
          <Section label="Current program" />
          {rows.length === 0 ? (
            <AppText variant="body" color="muted">
              No feeding program set for this batch.
            </AppText>
          ) : (
            <View>
              {rows.map((row) => (
                <LedgerRow key={row.id} gutter={`d${row.start_day}`}>
                  <AppText variant="body">{row.item.name}</AppText>
                  <AppText variant="data" color="muted">
                    {FEED_TYPES.find((f) => f.value === row.feed_type)?.label} · day {row.start_day}
                    {row.end_day !== null ? `–${row.end_day}` : '–'}
                  </AppText>
                </LedgerRow>
              ))}
              {hasGapOrOverlap && (
                <AppText variant="data" color="warning" style={{ marginTop: 8 }}>
                  Day ranges overlap or leave a gap -- check the schedule.
                </AppText>
              )}
            </View>
          )}
        </>
      )}

      <Section label="Add phase" />
      <PillSelect options={FEED_TYPES} value={feedType} onChange={setFeedType} />
      <ItemPicker value={item} onChange={setItem} category="FEED" />
      <NumberField label="Start day" value={startDay} onChangeText={setStartDay}  allowDecimal={false} />
      <NumberField label="End day" value={endDay} onChangeText={setEndDay} allowDecimal={false} />

      <SubmitBar label="Add phase" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
