import { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { FormCard } from '@/components/ui/form-card';
import { FormScreen } from '@/components/ui/form-screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { PickerField } from '@/components/ui/picker-field';
import { useGetData, type Paginated } from '@/lib/api';
import { openCasesIn, type DiseaseCase } from '@/lib/disease-cases';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { goBack } from '@/lib/nav';

/** Warn past this share of the house's live birds. A fat-fingered 50 for 5 is
 *  the costly typo here, and this write decrements BatchHouseBalance for real.
 *  docs/layout/07-log-mortality.md. */
const WARN_RATIO = 0.02;

/** docs/layout/07-log-mortality.md. Count is focused on mount — it's the
 *  reason this screen exists. Warns but never blocks: a real mass-mortality
 *  event is exactly when the app must not argue. */
export default function MortalityScreen() {
  const params = useLocalSearchParams<{ house_id?: string; task_id?: string }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [count, setCount] = useState('');
  const [causeNote, setCauseNote] = useState('');
  const [pickedCase, setPickedCase] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  // Open outbreaks in this house; picking one puts these deaths down to it (the case's death count).
  const cases = useGetData<Paginated<DiseaseCase>>(
    balance ? `/disease-cases?batch_id=${balance.batch_id}&status=ACTIVE&limit=100` : '',
    ['disease-cases', balance?.batch_id ?? 'none', 'active'],
    { enabled: !!balance },
  );
  const openCases = openCasesIn(cases.data?.results ?? [], house?.id);
  // A case picked for another house no longer applies once the house changes.
  const diseaseCaseId = openCases.some((c) => c.id === pickedCase) ? pickedCase : null;
  const countNum = Number(count);
  const isValid = !!house && !!balance && countNum > 0 && Number.isInteger(countNum);
  const overThreshold = balance ? countNum > balance.quantity * WARN_RATIO : false;

  // The cheapest possible sanity check, and it catches the decimal-place error
  // a threshold on absolute count never would: 12 deaths is routine in a flock
  // of 5,000 and catastrophic in a flock of 200.
  const share = balance && balance.quantity > 0 && countNum > 0
    ? (countNum / balance.quantity) * 100
    : null;

  const doSubmit = async () => {
    if (!house || !balance || !employee) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/mortality-logs',
        body: {
          batch_id: balance.batch_id,
          house_id: house.id,
          count_died: countNum,
          date: new Date().toISOString(),
          ...(causeNote.trim() && { cause_note: causeNote.trim() }),
          ...(diseaseCaseId && { disease_case_id: diseaseCaseId }),
        },
        taskId: params.task_id,
      });
      if (queued) goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (overThreshold) {
      Alert.alert(
        `Record ${countNum} deaths in ${house?.name}?`,
        `That's ${share?.toFixed(1)}% of the ${balance?.quantity.toLocaleString()} live birds in this house.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Record', style: 'destructive', onPress: doSubmit },
        ],
      );
      return;
    }
    void doSubmit();
  };

  return (
    <FormScreen
      title="Log mortality"
      hint="Deaths come off the house's live count."
      dirty={!!count || !!causeNote}
      submit={{
        label: countNum > 0 ? `Record ${countNum} death${countNum === 1 ? '' : 's'}` : 'Record mortality',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <FormCard>
        <HousePicker value={house} onChange={setHouse} />
        <BatchResolver houseId={house?.id} />
      </FormCard>

      <FormCard>
        <NumberField
          label="Birds that died"
          value={count}
          onChangeText={setCount}
          autoFocus
          allowDecimal={false}
          steppers
          hero
          quick={[1, 2, 5, 10]}
          warn={overThreshold}
          helper={
            share === null
              ? undefined
              : overThreshold
                ? `${countNum} is ${share.toFixed(1)}% of the flock. Unusual — check the count.`
                : `${share.toFixed(2)}% of the flock`
          }
          helperColor={overThreshold ? 'warning' : 'muted'}
        />
        {openCases.length > 0 ? (
          <PickerField
            label="Disease"
            placeholder="None"
            helper="Pick one if these deaths come from an open case."
            value={openCases.find((c) => c.id === diseaseCaseId) ?? null}
            options={openCases}
            getKey={(c) => c.id}
            getLabel={(c) => c.disease.label}
            onChange={(c) => setPickedCase(c.id)}
            onClear={() => setPickedCase(null)}
          />
        ) : null}
        <TextField
          label="Cause (optional)"
          placeholder="e.g. heat stress, crushed at the feeder"
          value={causeNote}
          onChangeText={setCauseNote}
          multiline
        />
      </FormCard>
    </FormScreen>
  );
}
