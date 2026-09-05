import { View, StyleSheet } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { SyncBanner } from '@/components/ui/sync-banner';
import { LedgerRow } from '@/components/ui/ledger-row';
import { DayCycleBar } from '@/components/ui/day-cycle-bar';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useGetData, type Paginated } from '@/lib/api';
import { useHouseOptions } from '@/components/ui/house-picker';
import { dayOfCycle, expectedCycleDays, houseToken } from '@/lib/farm';
import type { BatchHouseBalance } from '@/lib/types';

/** docs/PRD.md §6.4 -- pick where you are. Inactive houses are hidden, not
 *  greyed: is_active exists so history survives, not so the field app lists
 *  retired buildings. */
export default function HousesScreen() {
  const { data: houses, isLoading } = useHouseOptions();
  const { data: balances } = useGetData<Paginated<BatchHouseBalance>>(
    '/batch-house-balances?limit=100',
    ['batch-house-balances', 'all'],
  );

  const balanceFor = (houseId: string) =>
    (balances?.results ?? []).find((b) => b.house_id === houseId && b.quantity > 0);

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Houses' }} />
      <SyncBanner />

      {isLoading ? (
        <AppText variant="body" color="muted" style={styles.pad}>
          Loading…
        </AppText>
      ) : (houses?.results ?? []).length === 0 ? (
        <AppText variant="body" color="muted" style={styles.pad}>
          No active houses.
        </AppText>
      ) : (
        houses?.results.map((house) => {
          const balance = balanceFor(house.id);
          return (
            <LedgerRow
              key={house.id}
              gutter={houseToken(house.number)}
              onPress={() => router.push(`/houses/${house.id}` as Href)}
            >
              <View style={styles.head}>
                <AppText variant="body">{house.name}</AppText>
                <AppText variant="figure">
                  {balance ? balance.quantity.toLocaleString() : '—'}
                </AppText>
              </View>
              <View style={styles.meta}>
                <AppText variant="data" color="muted">
                  {house.type.toLowerCase()}
                  {balance?.batch ? ` · ${balance.batch.batch_code}` : ' · empty'}
                </AppText>
                {balance?.batch && (
                  <DayCycleBar
                    day={dayOfCycle(balance.batch.starting_date)}
                    expectedDays={expectedCycleDays(balance.batch)}
                  />
                )}
              </View>
            </LedgerRow>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingTop: Spacing.three },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
