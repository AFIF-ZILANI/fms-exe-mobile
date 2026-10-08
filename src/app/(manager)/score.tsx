import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { EmployeePicker, usePrefillEmployee } from '@/components/ui/employee-picker';
import { TextField } from '@/components/ui/text-field';
import { PillSelect } from '@/components/ui/pill-select';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { initials, monthRange } from '@/lib/farm';
import { formatSignedPoints } from '@/lib/format';
import { useGetData, type Paginated } from '@/lib/api';
import { POSITIVE_CRITERIA, NEGATIVE_CRITERIA, pointsFor, type Criterion } from '@/lib/criteria';
import type { ScoreEntry } from '@/lib/types';

/** ±1..±5 excluding 0 — the same range the server itself refines. */
const OTHER_POINTS: { value: string; label: string; tone: 'success' | 'critical' }[] = [
  -5, -4, -3, -2, -1, 1, 2, 3, 4, 5,
].map((n) => ({
  value: String(n),
  label: formatSignedPoints(n),
  tone: n > 0 ? 'success' : 'critical',
}));

/**
 * docs/layout/14-rate-employee.md — fifteen seconds is the design constraint,
 * not a nice-to-have: a manager who has to navigate three levels to record
 * "helped a coworker" records it never, and the point ledger degrades into
 * month-end guesswork.
 *
 * A fixed criterion's point value is shown, never editable — it's a
 * server-side snapshot from FIXED_CRITERION_POINTS, and a manager who can set
 * "Helped coworker" to +5 has turned a shared scale into a personal one.
 * OTHER is the only case revealing a points control.
 *
 * No confirm dialog: it's an append-only ledger entry, a correction is a new
 * offsetting entry, and a dialog on the fastest path defeats the screen.
 */
export default function ScoreScreen() {
  const params = useLocalSearchParams<{ employee_id?: string }>();
  const theme = useTheme();
  const { employee: actor } = useSession();
  const submit = useQueuedSubmit();

  const [employee, setEmployee] = usePrefillEmployee(params.employee_id);
  const [criterion, setCriterion] = useState<Criterion | null>(null);
  const [otherPoints, setOtherPoints] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touchedReason, setTouchedReason] = useState(false);

  const { from, to } = monthRange(new Date());
  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employee?.id ?? ''}&date_from=${from}&date_to=${to}&status=ACTIVE&limit=100`,
    ['performance-score-entries', 'mtd', employee?.id ?? 'none'],
    { enabled: !!employee },
  );
  const mtd = (scores?.results ?? []).reduce((sum, s) => sum + s.points, 0);

  const points = criterion ? pointsFor(criterion, otherPoints ? Number(otherPoints) : undefined) : 0;
  const reasonMissing = touchedReason && reason.trim() === '';
  const isValid =
    !!employee &&
    !!criterion &&
    reason.trim() !== '' &&
    (criterion !== 'OTHER' || otherPoints !== null);

  const handleSubmit = async () => {
    // Validated before enqueueing: the server rejects blank, and a queued row
    // would dead-letter for a reason the manager can't see.
    if (reason.trim() === '') {
      setTouchedReason(true);
      return;
    }
    if (!employee || !criterion || !actor) return;

    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/performance-score-entries',
        body: {
          employee_id: employee.id,
          criterion,
          reason: reason.trim(),
          // The day it happened: the server needs it to know which month's pay the points land in.
          incident_date: new Date().toISOString(),
          ...(criterion === 'OTHER' && { points: Number(otherPoints) }),
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const pickCriterion = (v: Criterion | null) => {
    setCriterion(v);
    // A chip and the stepper are the same field.
    if (v !== 'OTHER') setOtherPoints(null);
  };

  return (
    <FormScreen
      title="Rate"
      dirty={!!criterion || !!reason}
      submit={{
        label: criterion ? `Record ${formatSignedPoints(points)} points` : 'Record points',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      {/* Always shown, even when deep-linked: a manager committing points to
          someone's pay must be able to confirm who. Tappable only when the
          employee wasn't passed in. */}
      {params.employee_id ? (
        <View style={[styles.subject, { backgroundColor: theme.primarySoft }]}>
          <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
            <AppText variant="label" color="primary">
              {initials(employee?.profile.name ?? '')}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{employee?.profile.name ?? '…'}</AppText>
            <AppText variant="caption" color="muted">
              {employee?.role.toLowerCase()} · {formatSignedPoints(mtd)} this month
            </AppText>
          </View>
        </View>
      ) : (
        <EmployeePicker value={employee} onChange={setEmployee} />
      )}

      {/* Positive first, deliberately: the ledger is meant to be mostly a
          record of good work, and surfacing penalties first teaches the
          opposite. */}
      <View style={styles.group}>
        <AppText variant="eyebrow" color="success">
          Positive
        </AppText>
        <PillSelect
          options={POSITIVE_CRITERIA.map((c) => ({
            value: c.value,
            label: `+${c.points} ${c.label}`,
            tone: 'success' as const,
          }))}
          value={criterion}
          onChange={pickCriterion}
        />
      </View>

      <View style={styles.group}>
        <AppText variant="eyebrow" color="critical">
          Negative
        </AppText>
        <PillSelect
          options={NEGATIVE_CRITERIA.map((c) => ({
            value: c.value,
            label: `${c.points} ${c.label}`,
            tone: 'critical' as const,
          }))}
          value={criterion}
          onChange={pickCriterion}
        />
      </View>

      <View style={styles.group}>
        <PillSelect
          options={[{ value: 'OTHER', label: 'Other…' }]}
          value={criterion}
          onChange={pickCriterion}
        />
        {criterion === 'OTHER' && (
          <View style={[styles.otherWell, { backgroundColor: theme.surfaceAlt }]}>
            <AppText variant="eyebrow" color="muted">
              Points
            </AppText>
            <PillSelect options={OTHER_POINTS} value={otherPoints} onChange={setOtherPoints} />
            <AppText variant="caption" color="muted">
              −5 to +5, not zero
            </AppText>
          </View>
        )}
      </View>

      <TextField
        label="Reason"
        value={reason}
        onChangeText={(t) => {
          setReason(t);
          setTouchedReason(true);
        }}
        placeholder="What happened?"
        multiline
        error={reasonMissing ? 'A reason is required.' : undefined}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.card,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { gap: Spacing.sm },
  otherWell: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginTop: Spacing.xs,
  },
});
