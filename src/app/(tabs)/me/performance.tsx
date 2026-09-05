import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Reading } from '@/components/ui/reading';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useGetData, type Paginated } from '@/lib/api';
import { monthRange, clampAdjustment } from '@/lib/farm';
import { formatMoney, formatSignedPercent } from '@/lib/format';
import type { ScoreEntry, PayrollRecord } from '@/lib/types';

const monthLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();

/**
 * docs/PRD.md §6.3 -- what my points are worth. The loop that makes
 * performance-linked pay mean anything to the person being paid.
 *
 * The open month shows a PROJECTED percentage and no taka figure: the clamp
 * makes points and money non-linear near the edges, and PayrollRecord
 * doesn't exist until an Admin runs payroll. Past months show the real
 * locked figure, never editable.
 */
export default function PerformanceScreen() {
  const { employee } = useSession();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewed = new Date();
  viewed.setMonth(viewed.getMonth() + monthOffset);
  const { from, to } = monthRange(viewed);
  const isCurrentMonth = monthOffset === 0;

  const { data: scores } = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employee?.id ?? ''}&date_from=${from}&date_to=${to}&limit=100`,
    ['performance-score-entries', employee?.id ?? 'none', from],
    { enabled: !!employee },
  );

  const { data: payroll } = useGetData<Paginated<PayrollRecord>>(
    `/payroll-records?employee_id=${employee?.id ?? ''}&limit=24`,
    ['payroll-records', employee?.id ?? 'none'],
    { enabled: !!employee },
  );

  const entries = scores?.results ?? [];
  const points = entries.reduce((sum, e) => sum + e.points, 0);
  const projected = clampAdjustment(points);

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'My performance' }} />

      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonthOffset((o) => o - 1)} accessibilityRole="button" hitSlop={12}>
          <AppText variant="label" color="muted">
            ‹ Prev
          </AppText>
        </Pressable>
        <AppText variant="label">{monthLabel(viewed)}</AppText>
        <Pressable
          onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
          accessibilityRole="button"
          hitSlop={12}
          disabled={isCurrentMonth}
        >
          <AppText variant="label" color={isCurrentMonth ? 'line' : 'muted'}>
            Next ›
          </AppText>
        </Pressable>
      </View>

      <View style={styles.readings}>
        <Reading
          value={points > 0 ? `+${points}` : String(points)}
          label="Points"
          color={points > 0 ? 'success' : points < 0 ? 'critical' : 'ink'}
        />
        <Reading
          value={formatSignedPercent(projected)}
          label={isCurrentMonth ? 'Projected' : 'Adjustment'}
          color="muted"
        />
      </View>

      <Section label="Score history" />
      {entries.length === 0 ? (
        <AppText variant="body" color="muted">
          No score entries yet this month.
        </AppText>
      ) : (
        entries.map((entry) => (
          <LedgerRow
            key={entry.id}
            gutter={entry.points > 0 ? `+${entry.points}` : String(entry.points)}
            gutterColor={entry.points > 0 ? 'success' : 'critical'}
          >
            <View style={styles.entryHead}>
              <AppText variant="body">{entry.criterion.replaceAll('_', ' ').toLowerCase()}</AppText>
              <AppText variant="data" color="muted">
                {shortDate(entry.date)}
              </AppText>
            </View>
            <AppText variant="data" color="muted">
              {entry.reason}
            </AppText>
            {entry.given_by && (
              <AppText variant="data" color="muted">
                {entry.given_by.name}
              </AppText>
            )}
          </LedgerRow>
        ))
      )}

      <Section label="Payroll history" />
      {(payroll?.results ?? []).length === 0 ? (
        <AppText variant="body" color="muted">
          First payroll runs at month end.
        </AppText>
      ) : (
        payroll?.results.map((record) => {
          const percent = Number(record.adjustment_percent);
          return (
            <LedgerRow
              key={record.id}
              gutter={record.score_sum > 0 ? `+${record.score_sum}` : String(record.score_sum)}
              gutterColor={record.score_sum > 0 ? 'success' : record.score_sum < 0 ? 'critical' : 'muted'}
            >
              <View style={styles.entryHead}>
                <AppText variant="body">
                  {new Date(record.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </AppText>
                <AppText variant="figure">{formatMoney(record.final_salary)}</AppText>
              </View>
              <AppText variant="data" color="muted">
                {formatSignedPercent(percent)} on {formatMoney(record.baseline_salary)}
              </AppText>
            </LedgerRow>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  readings: { flexDirection: 'row', gap: Spacing.five },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
