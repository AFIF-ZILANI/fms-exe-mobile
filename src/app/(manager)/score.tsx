import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Avatar } from '@/components/ui/avatar';
import { FormCard } from '@/components/ui/form-card';
import { FormScreen } from '@/components/ui/form-screen';
import { EmployeePicker, usePrefillEmployee } from '@/components/ui/employee-picker';
import { TextField } from '@/components/ui/text-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { monthRange } from '@/lib/farm';
import { formatSignedPoints } from '@/lib/format';
import { humanise } from '@/lib/profile-format';
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
type Kind = 'good' | 'problem';

export default function ScoreScreen() {
  const params = useLocalSearchParams<{ employee_id?: string }>();
  const theme = useTheme();
  const { employee: actor } = useSession();
  const submit = useQueuedSubmit();

  const [employee, setEmployee] = usePrefillEmployee(params.employee_id);
  const [kind, setKind] = useState<Kind>('good');
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

  // Switching kind drops a choice from the other list: a "+3" must not stay selected under "Problem".
  const switchKind = (next: Kind) => {
    setKind(next);
    setCriterion(null);
  };

  // The ones this phone can send come first; the ones that need paperwork sit greyed at the end.
  const base = kind === 'good' ? POSITIVE_CRITERIA : NEGATIVE_CRITERIA;
  const list = [...base].sort(
    (a, b) => Number(needsAdminPaperwork(a.value, a.points)) - Number(needsAdminPaperwork(b.value, b.points)),
  );
  const after = mtd + points;

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
        <View style={[styles.subject, { backgroundColor: theme.surface }]}>
          <Avatar name={employee?.profile.name ?? ''} uri={employee?.profile.avatar?.image_url} size={48} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{employee?.profile.name ?? '…'}</AppText>
            <AppText variant="caption" color="muted">
              {employee ? humanise(employee.role) : ''}
            </AppText>
          </View>
          <View style={styles.month}>
            <AppText variant="figure" color={criterion ? 'muted' : mtd > 0 ? 'success' : mtd < 0 ? 'critical' : 'ink'}>
              {formatSignedPoints(mtd)}
            </AppText>
            {criterion ? (
              <AppText variant="figure" color={after > 0 ? 'success' : after < 0 ? 'critical' : 'ink'}>
                {`→ ${formatSignedPoints(after)}`}
              </AppText>
            ) : null}
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
      <SegmentedToggle
        height={48}
        options={[
          { value: 'good', label: 'Good work', activeTint: 'tintGreen', activeColor: 'success' },
          { value: 'problem', label: 'A problem', activeTint: 'tintRed', activeColor: 'critical' },
        ]}
        value={kind}
        onChange={switchKind}
      />

      <View style={[styles.list, { backgroundColor: theme.surface }]}>
        {list.map((c, i) => {
          const on = criterion === c.value;
          const blocked = needsAdminPaperwork(c.value, c.points);
          const tone = c.points > 0 ? theme.success : theme.critical;
          return (
            <View key={c.value}>
              {i > 0 ? <View style={[styles.rule, { backgroundColor: theme.line }]} /> : null}
              <Pressable
                onPress={() => setCriterion(c.value)}
                disabled={blocked}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: blocked }}
                accessibilityLabel={`${c.label}, ${formatSignedPoints(c.points)} points${blocked ? ', needs written notice first' : ''}`}
                style={({ pressed }) => [
                  styles.row,
                  { opacity: blocked ? 0.45 : 1 },
                  (on || pressed) && { backgroundColor: on ? theme.primarySoft : theme.surfaceAlt },
                ]}
              >
                <View style={[styles.radio, { borderColor: on ? theme.primary : theme.line }]}>
                  {on ? <View style={[styles.radioDot, { backgroundColor: theme.primary }]} /> : null}
                </View>
                <View style={styles.flex}>
                  <AppText variant="body" numberOfLines={2}>
                    {c.label}
                  </AppText>
                  {blocked ? (
                    <AppText variant="caption" color="muted">
                      Needs written notice (web)
                    </AppText>
                  ) : null}
                </View>
                <View style={[styles.badge, { backgroundColor: c.points > 0 ? theme.tintGreen : theme.tintRed }]}>
                  <AppText variant="data" style={{ color: tone }}>
                    {formatSignedPoints(c.points)}
                  </AppText>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

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
    padding: Spacing.lg,
    borderRadius: Radius.card,
  },
  month: { alignItems: 'flex-end' },
  list: { borderRadius: Radius.card, overflow: 'hidden' },
  row: {
    minHeight: Size.rowSingle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg + 22 + Spacing.md },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  badge: {
    minWidth: 40,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
