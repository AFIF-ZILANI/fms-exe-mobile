import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';

/** docs/PRD.md §6.9. The server enforces one sample per (batch, house, day)
 *  -- `date` is truncated to midnight so same-day resubmits actually collide
 *  on that constraint instead of always landing as distinct timestamps.
 *  There's no update endpoint for WeightRecords (create+list only), so a
 *  same-day duplicate surfaces through the outbox's normal dead-letter path
 *  (docs/offline-sync.md §4.3) rather than a bespoke "replace" flow. */
export default function WeightScreen() {
  const params = useLocalSearchParams<{ house_id?: string; task_id?: string }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [averageWeight, setAverageWeight] = useState('');
  const [sampleSize, setSampleSize] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  const avgNum = Number(averageWeight);
  const sampleNum = Number(sampleSize);
  const isValid = !!house && avgNum > 0 && sampleNum > 0 && Number.isInteger(sampleNum);

  const handleSubmit = async () => {
    if (!house || !employee) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/weight-records',
        body: {
          house_id: house.id,
          average_wt_grams: avgNum,
          sample_size: sampleNum,
          date: today.toISOString(),
          measured_by_id: employee.profile.id,
          ...(balance && { batch_id: balance.batch_id }),
        },
        taskId: params.task_id,
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Weight sample' }} />
      <Section label="House" />
      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      <Section label="Sample" />
      <NumberField
        label="Average weight"
        value={averageWeight}
        onChangeText={setAverageWeight}
        unit="g"
        required
        autoFocus
      />
      <NumberField
        label="Sample size"
        value={sampleSize}
        onChangeText={setSampleSize}
        unit="birds"
        required
        allowDecimal={false}
      />

      <SubmitBar label="Record sample" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
