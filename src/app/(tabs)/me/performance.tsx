import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerRow } from '@/components/ui/ledger-row';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useGetData, type Paginated } from '@/lib/api';
import { monthRange, clampAdjustment } from '@/lib/farm';
import { formatMoney, formatSignedPercent, formatSignedPoints } from '@/lib/format';
import type { ScoreEntry, PayrollRecord } from '@/lib/types';

const monthLabel = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase();

/**
 * docs/layout/03-my-performance.md — what my points are worth. The loop that
 * makes performance-linked pay mean anything to the person being paid.
 *
 * The open month shows a PROJECTED percentage and no taka figure: the clamp
 * makes points and money non-linear near the edges, and PayrollRecord doesn't
 * exist until an Admin runs payroll. Past months show the real locked figure,
 * never editable.
 */
export default function PerformanceScreen() {
  const theme = useTheme();
  const { employee } = useSession();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewed = new Date();
  viewed.setMonth(viewed.getMonth() + monthOffset);
  const { from, to } = monthRange(viewed);
  const isCurrentMonth = monthOffset === 0;

  const { data: scores, isLoading } = useGetData<Paginated<ScoreEntry>>(
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
  const records = payroll?.results ?? [];

  const pointsColor = points > 0 ? 'success' : points < 0 ? 'critical' : 'ink';

  return (
    <Screen>
      <Header title="My performance" leading="back" />

      {/* Month stepper. Forward is disabled at the current month — there is no
          future payroll to look at. */}
      <View style={styles.monthRow}>
        <MonthButton icon="chevron-left" label="Previous month" onPress={() => setMonthOffset((o) => o - 1)} />
        <AppText variant="label">{monthLabel(viewed)}</AppText>
        <MonthButton
          icon="chevron-right"
          label="Next month"
          onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
          disabled={isCurrentMonth}
        />
      </View>

      <Card style={styles.hero}>
        <AppText variant="eyebrow" color="muted" style={styles.centre}>
          Points this month
        </AppText>

        {isLoading ? (
          <View style={styles.heroSkeleton}>
            <Skeleton width="40%" height={44} />
          </View>
        ) : (
          // Zero is shown as 0, never hidden — a blank where a number belongs
          // reads as a bug. docs/layout/03-my-performance.md.
          <AppText variant="hero" color={pointsColor} style={styles.centre}>
            {formatSignedPoints(points)}
          </AppText>
        )}

        <View style={[styles.rule, { backgroundColor: theme.line }]} />

        <View style={styles.projected}>
          <AppText variant="label" color="muted">
            {isCurrentMonth ? 'Projected' : 'Adjustment'}
          </AppText>
          <AppText variant="figure" color={pointsColor}>
            {formatSignedPercent(projected)}
          </AppText>
        </View>
        <AppText variant="caption" color="muted" style={styles.centre}>
          {isCurrentMonth ? "on next month's pay" : 'applied to this month'}
        </AppText>
      </Card>

      <Card rows eyebrow="Score history" style={styles.card}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={44} />
            ))}
          </View>
        ) : entries.length === 0 ? (
          <EmptyState
            compact
            icon="award"
            tint="tintAmber"
            title="No score entries yet this month."
          />
        ) : (
          entries.map((entry, i) => (
            <LedgerRow
              key={entry.id}
              gutter={formatSignedPoints(entry.points)}
              gutterColor={entry.points > 0 ? 'success' : 'critical'}
              last={i === entries.length - 1}
            >
              <View style={styles.entryHead}>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {entry.criterion.replaceAll('_', ' ').toLowerCase()}
                </AppText>
                <AppText variant="data" color="muted">
                  {shortDate(entry.date)}
                </AppText>
              </View>
              {/* Never truncated to one line — this is the only place a worker
                  sees *why* they were scored. */}
              {entry.reason ? (
                <AppText variant="body" color="inkSoft" numberOfLines={2}>
                  &ldquo;{entry.reason}&rdquo;
                </AppText>
              ) : null}
              {entry.given_by && (
                <AppText variant="caption" color="muted">
                  {entry.given_by.name}
                </AppText>
              )}
            </LedgerRow>
          ))
        )}
      </Card>

      <Card rows eyebrow="Payroll history" style={styles.card}>
        {records.length === 0 ? (
          <EmptyState
            compact
            icon="calendar"
            tint="surfaceAlt"
            title="First payroll runs at month end."
          />
        ) : (
          // Four mono columns — the one place mono's alignment is structural.
          // PayrollRecord is immutable: no edit affordance, ever.
          records.map((record, i) => (
            <View
              key={record.id}
              style={[
                styles.payrollRow,
                i < records.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.line },
              ]}
            >
              <AppText variant="data" color="muted" style={styles.flex}>
                {new Date(record.month)
                  .toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                  .toUpperCase()}
              </AppText>
              <AppText
                variant="data"
                color={record.score_sum > 0 ? 'success' : record.score_sum < 0 ? 'critical' : 'muted'}
                style={styles.colPoints}
              >
                {formatSignedPoints(record.score_sum)}
              </AppText>
              <AppText
                variant="data"
                color={record.score_sum > 0 ? 'success' : record.score_sum < 0 ? 'critical' : 'muted'}
                style={styles.colPercent}
              >
                {formatSignedPercent(Number(record.adjustment_percent))}
              </AppText>
              <AppText variant="figure" style={styles.colMoney}>
                {formatMoney(record.final_salary)}
              </AppText>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function MonthButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.monthButton,
        { backgroundColor: theme.surface, borderColor: theme.line, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      <Icon name={icon} size={20} color={disabled ? 'muted' : 'ink'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  monthButton: {
    width: Size.iconButton,
    height: Size.iconButton,
    borderWidth: 1,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { padding: Spacing.xl },
  heroSkeleton: { alignItems: 'center', paddingVertical: Spacing.xs },
  rule: { height: 1, marginVertical: Spacing.lg },
  projected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  card: { marginTop: Spacing.md },
  skeletons: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  entryHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  payrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Size.rowSingle,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  colPoints: { width: 48, textAlign: 'right' },
  colPercent: { width: 64, textAlign: 'right' },
  colMoney: { flex: 1, textAlign: 'right' },
});
