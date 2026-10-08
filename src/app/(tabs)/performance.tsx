import { useState } from 'react';
import { Pressable, RefreshControl, View, StyleSheet } from 'react-native';

import { AdjustmentScale } from '@/components/adjustment-scale';
import { ScoreItem } from '@/components/member-sections';
import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card, StatCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Icon, IconTile } from '@/components/ui/icon';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useGetData, type Paginated } from '@/lib/api';
import { monthRange, clampAdjustment } from '@/lib/farm';
import { formatMoney, formatSignedPoints } from '@/lib/format';
import { monthOffsetFor, recordForMonth, signedPercent, splitPoints } from '@/lib/performance-view';
import type { ScoreEntry, PayrollRecord } from '@/lib/types';

const REFRESH_TIMEOUT_MS = 6000;
const SHOWN = 4;

const monthName = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shortMonth = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

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
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { employee } = useSession();
  // Held in state: new Date() during render is impure, and the month maths needs one stable "now".
  const [now] = useState(() => new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const [allScores, setAllScores] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const viewed = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const { from, to } = monthRange(viewed);
  const isCurrentMonth = monthOffset === 0;

  const scoresQ = useGetData<Paginated<ScoreEntry>>(
    `/performance-score-entries?employee_id=${employee?.id ?? ''}&date_from=${from}&date_to=${to}&status=ACTIVE&limit=100`,
    ['performance-score-entries', employee?.id ?? 'none', from],
    { enabled: !!employee },
  );
  const payrollQ = useGetData<Paginated<PayrollRecord>>(
    `/payroll-records?employee_id=${employee?.id ?? ''}&limit=24`,
    ['payroll-records', employee?.id ?? 'none'],
    { enabled: !!employee },
  );

  const entries = scoresQ.data?.results ?? [];
  const records = payrollQ.data?.results ?? [];
  const points = entries.reduce((sum, e) => sum + e.points, 0);
  const { earned, lost } = splitPoints(entries);
  const record = recordForMonth(records, viewed);
  // A locked month shows what was actually applied; an open one shows the projection.
  const adjustment = record ? Number(record.adjustment_percent) : clampAdjustment(points);
  const pointsColor = points > 0 ? 'success' : points < 0 ? 'critical' : 'ink';
  const adjustColor = adjustment > 0 ? 'success' : adjustment < 0 ? 'critical' : 'ink';
  const isLoading = scoresQ.isLoading;

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Offline, refetches are paused and never settle: don't wait for them forever.
      await Promise.race([
        Promise.allSettled([scoresQ.refetch(), payrollQ.refetch()]),
        new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const label = record ? 'Applied' : isCurrentMonth ? 'Projected' : 'Adjustment';
  const caption = record
    ? `to ${monthName(viewed)} pay`
    : isCurrentMonth
      ? "on next month's pay"
      : 'Payroll for this month has not run yet';

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }
    >
      <Header title="My performance" />

      {/* Month stepper. Forward is disabled at the current month — there is no future payroll to look at. */}
      <View style={styles.monthRow}>
        <MonthButton icon="chevron-left" label="Previous month" onPress={() => setMonthOffset((o) => o - 1)} />
        <AppText variant="h2">{monthName(viewed)}</AppText>
        <MonthButton
          icon="chevron-right"
          label="Next month"
          onPress={() => setMonthOffset((o) => Math.min(0, o + 1))}
          disabled={isCurrentMonth}
        />
      </View>

      <Card style={styles.hero}>
        <AppText variant="eyebrow" color="muted" style={styles.centre}>
          Points {isCurrentMonth ? 'so far' : 'earned'}
        </AppText>
        {isLoading ? (
          <View style={styles.heroSkeleton}>
            <Skeleton width="40%" height={44} />
          </View>
        ) : (
          // Zero is shown as 0, never hidden — a blank where a number belongs reads as a bug.
          <AppText variant="hero" color={pointsColor} style={styles.centre}>
            {formatSignedPoints(points)}
          </AppText>
        )}

        <View style={styles.scale}>
          <AdjustmentScale points={points} />
        </View>

        <View style={styles.projected}>
          <AppText variant="label" color="muted">
            {label}
          </AppText>
          <AppText variant="figure" color={adjustColor}>
            {signedPercent(adjustment)}
          </AppText>
        </View>
        <AppText variant="caption" color="muted" style={styles.centre}>
          {caption}
        </AppText>
      </Card>

      {entries.length > 0 ? (
        <View style={styles.statRow}>
          <StatCard
            value={`+${earned}`}
            eyebrow="Earned"
            tint="tintGreen"
            valueColor="success"
            icon={<IconTile name="trending-up" tint="tintGreen" color="success" size={32} />}
          />
          <StatCard
            value={lost > 0 ? `-${lost}` : '0'}
            eyebrow="Lost"
            tint={lost > 0 ? 'tintRed' : 'tintGreen'}
            valueColor={lost > 0 ? 'critical' : 'success'}
            icon={<IconTile name="trending-down" tint={lost > 0 ? 'tintRed' : 'tintGreen'} color={lost > 0 ? 'critical' : 'success'} size={32} />}
          />
        </View>
      ) : null}

      {record ? (
        <Card rows eyebrow={`Payslip · ${shortMonth(viewed)}`} style={styles.card}>
          <PayRow label="Fixed wage" value={formatMoney(record.fixed_wage)} />
          <PayRow label={`Performance allowance (${signedPercent(adjustment)})`} value={formatMoney(record.allowance)} />
          <PayRow label="Total pay" value={formatMoney(record.total_pay)} strong last />
        </Card>
      ) : null}

      <View style={styles.sectionHead}>
        <AppText variant="eyebrow" color="muted">
          Points · {monthName(viewed)}
        </AppText>
        {entries.length > 0 ? <AppText variant="data" color="muted">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</AppText> : null}
      </View>
      {isLoading ? (
        <View style={styles.list}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={88} />
          ))}
        </View>
      ) : entries.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState
            compact
            icon="award"
            tint="tintAmber"
            title={isCurrentMonth ? 'No points yet this month.' : 'No points that month.'}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {/* Never truncated to one line — this is the only place a worker sees *why* they were scored. */}
          {(allScores ? entries : entries.slice(0, SHOWN)).map((entry) => (
            <ScoreItem key={entry.id} entry={entry} givenBy={entry.given_by?.name ?? ''} />
          ))}
          {entries.length > SHOWN ? (
            <Pressable onPress={() => setAllScores((v) => !v)} accessibilityRole="button" style={styles.more}>
              <AppText variant="label" color="primary">
                {allScores ? 'Show less' : `Show all ${entries.length}`}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.sectionHead}>
        <AppText variant="eyebrow" color="muted">
          Pay history
        </AppText>
      </View>
      {records.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState compact icon="calendar" tint="surfaceAlt" title="First payroll runs at month end." />
        </Card>
      ) : (
        // PayrollRecord is immutable: no edit affordance, ever. Tapping a month opens it above.
        <View style={styles.list}>
          {records.map((r) => {
            const month = new Date(Date.UTC(new Date(r.month).getUTCFullYear(), new Date(r.month).getUTCMonth(), 1));
            const offset = monthOffsetFor(r.month, now);
            const active = offset === monthOffset;
            const pct = Number(r.adjustment_percent);
            return (
              <Pressable
                key={r.id}
                onPress={() => setMonthOffset(Math.min(0, offset))}
                accessibilityRole="button"
                accessibilityLabel={`${shortMonth(month)}, ${formatSignedPoints(r.score_sum)} points, ${signedPercent(pct)}, ${formatMoney(r.total_pay)}`}
                style={({ pressed }) => [
                  styles.payCard,
                  { backgroundColor: pressed ? theme.surfaceAlt : theme.surface, borderColor: active ? theme.primary : 'transparent' },
                  elevation(scheme, 'card'),
                ]}
              >
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</AppText>
                  <AppText variant="caption" color={r.score_sum > 0 ? 'success' : r.score_sum < 0 ? 'critical' : 'muted'}>
                    {formatSignedPoints(r.score_sum)} points · {signedPercent(pct)}
                  </AppText>
                </View>
                <AppText variant="figure">{formatMoney(r.total_pay)}</AppText>
                <Icon name="chevron-right" size={20} color="muted" />
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function PayRow({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.payRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }]}>
      <AppText variant={strong ? 'bodyStrong' : 'body'} color={strong ? 'ink' : 'inkSoft'} style={styles.flex}>
        {label}
      </AppText>
      <AppText variant={strong ? 'figure' : 'data'}>{value}</AppText>
    </View>
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
  scale: { marginVertical: Spacing.lg },
  projected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  card: { marginTop: Spacing.md },
  list: { gap: Spacing.sm, marginTop: Spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    marginTop: Spacing.xl,
  },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderWidth: 2,
  },
});
