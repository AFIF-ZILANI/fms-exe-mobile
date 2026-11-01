import { StyleSheet, View } from 'react-native';

import { LedgerRow } from '@/components/ui/ledger-row';
import { StatusPill } from '@/components/ui/status-pill';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import {
  METHOD_LABEL,
  dateOfDay,
  relativeDay,
  shortDate,
  type VaccineScheduleRow,
} from '@/lib/vaccine-schedule';

type Props = {
  row: VaccineScheduleRow;
  today: number;
  startingDate: string;
  houseId?: string;
  last?: boolean;
  onPress?: () => void;
};

/** One vaccine in the ledger: the batch day in the gutter, the purpose as the title, and one line of what
 *  matters for its state. Only a due row carries a status pill -- the section it sits in says the rest. */
export function VaccineRow({ row, today, startingDate, houseId, last, onPress }: Props) {
  const here = row.houses.find((h) => h.id === houseId);
  const pending = row.status === 'PENDING';
  const doneHere = pending && !!here?.confirm;
  const due = pending && !doneHere && row.day <= today;
  const overdue = due && row.day < today;

  const waiting = row.houses.filter((h) => !h.confirm).map((h) => h.name);
  const detail = doneHere
    ? [`Done here · ${here?.confirm?.confirmed_by.name}`, waiting.length ? `waiting on ${waiting.join(', ')}` : null]
    : row.status === 'DONE'
      ? [
          `Done · ${row.confirmed_by?.name ?? '—'}`,
          row.confirmed_at ? shortDate(new Date(row.confirmed_at)) : null,
          row.houses.length > 1 ? `${row.houses.length} houses` : null,
        ]
      : row.status === 'CANCELLED'
        ? ['Cancelled', row.reason]
        : [
            shortDate(dateOfDay(startingDate, row.day)),
            row.day === today ? null : relativeDay(row.day, today),
            row.method ? METHOD_LABEL[row.method] : null,
            row.day !== row.planned_day ? `moved from Day ${row.planned_day}` : null,
          ];

  return (
    <LedgerRow
      gutter={`D${row.day}`}
      gutterColor={overdue ? 'critical' : undefined}
      last={last}
      onPress={onPress}
    >
      <View style={styles.title}>
        <AppText
          variant="bodyStrong"
          color={row.status === 'CANCELLED' ? 'muted' : 'ink'}
          style={[styles.flex, row.status === 'CANCELLED' && styles.struck]}
          numberOfLines={1}
        >
          {row.purposeRef.label}
        </AppText>
        {due ? <StatusPill status={overdue ? 'OVERDUE' : 'DUE_TODAY'} /> : null}
      </View>
      <AppText variant="caption" color="muted" numberOfLines={1}>
        {detail.filter(Boolean).join(' · ')}
      </AppText>
    </LedgerRow>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
});
