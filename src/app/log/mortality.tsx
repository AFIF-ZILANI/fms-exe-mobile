import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';

/** docs/PRD.md §6.7. Count is focused on mount -- it's the reason this
 *  screen exists. Warns (doesn't block) past 2% of the house's live birds,
 *  since a fat-fingered 50 for 5 is the costly typo here and this write
 *  decrements BatchHouseBalance for real. */
export default function MortalityScreen() {
  const params = useLocalSearchParams<{ house_id?: string; task_id?: string }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [count, setCount] = useState('');
  const [causeNote, setCauseNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  const countNum = Number(count);
  const isValid = !!house && !!balance && countNum > 0 && Number.isInteger(countNum);
  const overThreshold = balance ? countNum > balance.quantity * 0.02 : false;

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
          recorded_by_id: employee.profile.id,
          ...(causeNote.trim() && { cause_note: causeNote.trim() }),
        },
        taskId: params.task_id,
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (overThreshold) {
      Alert.alert(
        `Record ${countNum} deaths in ${house?.name}?`,
        `That's more than 2% of the ${balance?.quantity.toLocaleString()} live birds in this house.`,
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
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Mortality' }} />
      <Section label="House" />
      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      <Section label="Count" />
      <NumberField
        label="Count died"
        value={count}
        onChangeText={setCount}
        unit="birds"
        required
        autoFocus
        allowDecimal={false}
      />

      <Section label="Detail" />
      <TextField label="Cause note" value={causeNote} onChangeText={setCauseNote} multiline />

      <SubmitBar
        label={countNum > 0 ? `Record ${countNum} death${countNum === 1 ? '' : 's'}` : 'Record'}
        onPress={handleSubmit}
        disabled={!isValid}
        loading={submitting}
      />
    </Screen>
  );
}
