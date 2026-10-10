import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { FormCard } from '@/components/ui/form-card';
import { FormScreen } from '@/components/ui/form-screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { PillSelect } from '@/components/ui/pill-select';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { goBack } from '@/lib/nav';

type TimePeriod = 'MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING' | 'NIGHT' | 'MIDNIGHT' | 'LATENIGHT';

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'NOON', label: 'Noon' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'NIGHT', label: 'Night' },
  { value: 'MIDNIGHT', label: 'Midnight' },
  { value: 'LATENIGHT', label: 'Late night' },
];

function defaultTimePeriod(hour: number): TimePeriod {
  if (hour < 5) return 'LATENIGHT';
  if (hour < 11) return 'MORNING';
  if (hour < 13) return 'NOON';
  if (hour < 17) return 'AFTERNOON';
  if (hour < 20) return 'EVENING';
  if (hour < 23) return 'NIGHT';
  return 'MIDNIGHT';
}

/**
 * Normal ranges are display constants, not server validation — they live here
 * beside the form rather than in a migration. An out-of-range value is NOT an
 * error: it's the reading, and frequently the whole reason someone opened the
 * form. It warns and never blocks. docs/layout/10-log-environment.md.
 */
const RANGES: Record<string, [number, number]> = {
  temperature: [18, 34],
  humidity: [40, 70],
  ammonia: [0, 20],
  co2: [0, 3000],
  pressure: [950, 1050],
};

function outOfRange(key: keyof typeof RANGES, value: string): boolean {
  if (value.trim() === '') return false;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const [min, max] = RANGES[key];
  return n < min || n > max;
}

/** docs/layout/10-log-environment.md. Unlike consumption/weight, batch_id is
 *  REQUIRED by the server here — submit stays blocked until a batch resolves.
 *
 *  Five readings in one stacked column, not a grid: a worker walks the shed
 *  once with the phone, and the form should match that walk. */
export default function EnvironmentScreen() {
  const params = useLocalSearchParams<{ house_id?: string; task_id?: string }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');
  const [ammonia, setAmmonia] = useState('');
  const [co2, setCo2] = useState('');
  const [pressure, setPressure] = useState('');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(() =>
    defaultTimePeriod(new Date().getHours()),
  );
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  const values = [temperature, humidity, ammonia, co2, pressure];
  const isValid =
    !!house && !!balance && values.every((v) => v.trim() !== '' && Number.isFinite(Number(v)));

  const handleSubmit = async () => {
    if (!house || !balance || !employee) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/environment-records',
        body: {
          batch_id: balance.batch_id,
          house_id: house.id,
          temperature_c: Number(temperature),
          humidity_percent: Number(humidity),
          ammonia_ppm: Number(ammonia),
          co2_ppm: Number(co2),
          air_pressure_hpa: Number(pressure),
          time_period: timePeriod,
        },
        taskId: params.task_id,
      });
      if (queued) goBack();
    } finally {
      setSubmitting(false);
    }
  };

  const filled = values.filter((v) => v.trim() !== '').length;

  return (
    <FormScreen
      title="Log environment"
      hint="Five readings from inside the house. Out-of-range values are flagged, never blocked."
      dirty={filled > 0}
      submit={{
        label: filled === 5 || filled === 0 ? 'Record readings' : `${5 - filled} more reading${5 - filled === 1 ? '' : 's'} needed`,
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <FormCard>
        <HousePicker value={house} onChange={setHouse} />
        <BatchResolver houseId={house?.id} />
      </FormCard>

      <FormCard title="When">
        <View style={styles.periodBlock}>
          <AppText variant="eyebrow" color="muted">
            Time of day
          </AppText>
          <PillSelect options={TIME_PERIODS} value={timePeriod} onChange={setTimePeriod} />
        </View>
      </FormCard>

      <FormCard title="Readings" hint={`${filled} of 5`}>
      <NumberField
        label="Temperature"
        value={temperature}
        onChangeText={setTemperature}
        unit="°C"
        autoFocus
        warn={outOfRange('temperature', temperature)}
        helper={outOfRange('temperature', temperature) ? 'Outside 18–34 °C' : undefined}
        helperColor="warning"
      />
      <NumberField
        label="Humidity"
        value={humidity}
        onChangeText={setHumidity}
        unit="%"
        warn={outOfRange('humidity', humidity)}
        helper={outOfRange('humidity', humidity) ? 'Outside 40–70 %' : undefined}
        helperColor="warning"
      />
      {/* Ammonia is the reading that matters most and the one workers skip —
          third in the column rather than last, for exactly that reason. */}
      <NumberField
        label="Ammonia"
        value={ammonia}
        onChangeText={setAmmonia}
        unit="ppm"
        warn={outOfRange('ammonia', ammonia)}
        helper={outOfRange('ammonia', ammonia) ? 'Above 20 ppm' : undefined}
        helperColor="warning"
      />
      <NumberField
        label="CO₂"
        value={co2}
        onChangeText={setCo2}
        unit="ppm"
        warn={outOfRange('co2', co2)}
        helper={outOfRange('co2', co2) ? 'Above 3,000 ppm' : undefined}
        helperColor="warning"
      />
      <NumberField
        label="Air pressure"
        value={pressure}
        onChangeText={setPressure}
        unit="hPa"
        warn={outOfRange('pressure', pressure)}
        helper={outOfRange('pressure', pressure) ? 'Outside 950–1,050 hPa' : undefined}
        helperColor="warning"
      />
      </FormCard>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  periodBlock: { gap: Spacing.sm },
});
