import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Avatar } from '@/components/ui/avatar';
import { FormCard } from '@/components/ui/form-card';
import { FormScreen } from '@/components/ui/form-screen';
import { EmployeePicker, usePrefillEmployee } from '@/components/ui/employee-picker';
import { TextField } from '@/components/ui/text-field';
import { PillSelect } from '@/components/ui/pill-select';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { monthRange } from '@/lib/farm';
import { formatSignedPoints } from '@/lib/format';
import { useGetData, type Paginated } from '@/lib/api';
import { POSITIVE_CRITERIA, NEGATIVE_CRITERIA, needsAdminPaperwork, pointsFor, type Criterion } from '@/lib/criteria';
import type { ScoreEntry } from '@/lib/types';
import { goBack } from '@/lib/nav';

/**
 * docs/layout/14-rate-employee.md — fifteen seconds is the design constraint,
 * not a nice-to-have: a manager who has to navigate three levels to record
 * "helped a coworker" records it never, and the point ledger degrades into
 * month-end guesswork.
 *
 * A fixed criterion's point value is shown, never editable — it's a
 * server-side snapshot from FIXED_CRITERION_POINTS, and a manager who can set
 * "Helped coworker" to +5 has turned a shared scale into a personal one.
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

  const points = criterion ? pointsFor(criterion) : 0;
  const reasonMissing = touchedReason && reason.trim() === '';
  const isValid =
    !!employee &&
    !!criterion &&
    reason.trim() !== '' &&
    !needsAdminPaperwork(criterion, points);

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
        },
      });
      if (queued) goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const pickCriterion = (v: Criterion | null) => {
    setCriterion(v);
    // A chip and the stepper are the same field.
  };

  return (
    <FormScreen
      title="Rate"
      hint="Points go on this month's record and move their pay."
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
          <Avatar name={employee?.profile.name ?? ''} uri={employee?.profile.avatar?.image_url} size={44} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{employee?.profile.name ?? '…'}</AppText>
            <AppText variant="caption" color="muted">
              {employee?.role.toLowerCase()} · {formatSignedPoints(mtd)} this month
            </AppText>
          </View>
        </View>
      ) : (
        <FormCard>
          <EmployeePicker value={employee} onChange={setEmployee} />
        </FormCard>
      )}

      {/* Positive first, deliberately: the ledger is meant to be mostly a
          record of good work, and surfacing penalties first teaches the
          opposite. */}
      <FormCard title="Good work">
        <PillSelect
          options={POSITIVE_CRITERIA.map((c) => ({
            value: c.value,
            label: `+${c.points} ${c.label}`,
            tone: 'success' as const,
          }))}
          value={criterion}
          onChange={pickCriterion}
        />
      </FormCard>

      <FormCard title="Problems">
        <PillSelect
          options={NEGATIVE_CRITERIA.map((c) => ({
            value: c.value,
            label: `${c.points} ${c.label}`,
            tone: 'critical' as const,
            disabled: needsAdminPaperwork(c.value, c.points),
          }))}
          value={criterion}
          onChange={pickCriterion}
        />
        <AppText variant="caption" color="muted">
          −4 and worse need written notice first, which an admin adds on the web. Pick a smaller one here.
        </AppText>
      </FormCard>

      <FormCard title="Why">
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
      </FormCard>
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
