import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';

/** docs/layout/09-log-weight.md. The server enforces one sample per
 *  (batch, house, day) — `date` is truncated to midnight so same-day
 *  resubmits actually collide on that constraint instead of always landing as
 *  distinct timestamps. There's no update endpoint for WeightRecords
 *  (create+list only), so a same-day duplicate surfaces through the outbox's
 *  normal dead-letter path rather than a bespoke "replace" flow. */
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
    <FormScreen
      title="Log weight"
      dirty={!!averageWeight || !!sampleSize}
      submit={{
        label: avgNum > 0 ? `Record ${avgNum.toLocaleString()} g average` : 'Record weight',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      {/* Grams is a fixed suffix, not a picker — the server stores grams and
          there is no second unit. */}
      <NumberField
        label="Average weight"
        value={averageWeight}
        onChangeText={setAverageWeight}
        unit="g"
        autoFocus
      />
      <NumberField
        label="Sample size"
        value={sampleSize}
        onChangeText={setSampleSize}
        unit="birds"
        allowDecimal={false}
      />
    </FormScreen>
  );
}
