import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/ui/screen';
import { EmployeePicker, usePrefillEmployee } from '@/components/ui/employee-picker';
import { TextField } from '@/components/ui/text-field';
import { PillSelect } from '@/components/ui/pill-select';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { POSITIVE_CRITERIA, NEGATIVE_CRITERIA, pointsFor, type Criterion } from '@/lib/criteria';

const OTHER_POINTS: { value: string; label: string; tone: 'success' | 'critical' }[] = [
  -5, -4, -3, -2, -1, 1, 2, 3, 4, 5,
].map((n) => ({
  value: String(n),
  label: n > 0 ? `+${n}` : String(n),
  tone: n > 0 ? 'success' : 'critical',
}));

/**
 * docs/PRD.md §6.14 -- fast enough to actually use, or the whole point
 * ledger degrades into month-end guesswork. Chips show a fixed criterion's
 * point value read-only (server snapshot, not client-editable); OTHER is the
 * only case that reveals a stepper, clamped to ±1..±5 excluding 0 -- the
 * same range the server itself refines.
 */
export default function ScoreScreen() {
  const params = useLocalSearchParams<{ employee_id?: string }>();
  const { employee: actor } = useSession();
  const submit = useQueuedSubmit();

  const [employee, setEmployee] = usePrefillEmployee(params.employee_id);
  const [criterion, setCriterion] = useState<Criterion | null>(null);
  const [otherPoints, setOtherPoints] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const points = criterion ? pointsFor(criterion, otherPoints ? Number(otherPoints) : undefined) : 0;
  const isValid = !!employee && !!criterion && reason.trim() !== '' && (criterion !== 'OTHER' || otherPoints !== null);

  const handleSubmit = async () => {
    if (!employee || !criterion || !actor) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/performance-score-entries',
        body: {
          employee_id: employee.id,
          given_by_id: actor.profile.id,
          criterion,
          reason: reason.trim(),
          date: new Date().toISOString(),
          ...(criterion === 'OTHER' && { points: Number(otherPoints) }),
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Rate' }} />
      {!params.employee_id && (
        <>
          <Section label="Who" />
          <EmployeePicker value={employee} onChange={setEmployee} />
        </>
      )}

      <Section label="Positive" />
      <PillSelect
        options={POSITIVE_CRITERIA.map((c) => ({ value: c.value, label: `+${c.points} ${c.label}`, tone: 'success' }))}
        value={criterion}
        onChange={(v) => {
          setCriterion(v);
          setOtherPoints(null);
        }}
      />

      <Section label="Negative" />
      <PillSelect
        options={NEGATIVE_CRITERIA.map((c) => ({ value: c.value, label: `${c.points} ${c.label}`, tone: 'critical' }))}
        value={criterion}
        onChange={(v) => {
          setCriterion(v);
          setOtherPoints(null);
        }}
      />

      <Section label="Other" />
      <PillSelect
        options={[{ value: 'OTHER', label: 'Other…' }]}
        value={criterion}
        onChange={setCriterion}
      />
      {criterion === 'OTHER' && (
        <View style={{ marginTop: Spacing.two }}>
          <PillSelect options={OTHER_POINTS} value={otherPoints} onChange={setOtherPoints} />
        </View>
      )}

      <Section label="Reason" />
      <TextField label="Reason" value={reason} onChangeText={setReason} multiline  />

      <SubmitBar
        label={criterion ? `Record ${points > 0 ? '+' : ''}${points} points` : 'Record'}
        onPress={handleSubmit}
        disabled={!isValid}
        loading={submitting}
      />
    </Screen>
  );
}
