import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { PillSelect } from '@/components/ui/pill-select';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';

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

/** docs/PRD.md §6.10. Unlike consumption/weight, batch_id is REQUIRED by the
 *  server here -- submit stays blocked until a batch resolves. */
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
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(() => defaultTimePeriod(new Date().getHours()));
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  const values = [temperature, humidity, ammonia, co2, pressure];
  const isValid = !!house && !!balance && values.every((v) => v.trim() !== '' && Number.isFinite(Number(v)));

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
          recorded_by_id: employee.profile.id,
        },
        taskId: params.task_id,
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Environment' }} />
      <Section label="House" />
      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      <Section label="Readings" />
      <NumberField label="Temperature" value={temperature} onChangeText={setTemperature} unit="°C" required autoFocus />
      <NumberField label="Humidity" value={humidity} onChangeText={setHumidity} unit="%" required />
      <NumberField label="Ammonia" value={ammonia} onChangeText={setAmmonia} unit="ppm" required />
      <NumberField label="CO₂" value={co2} onChangeText={setCo2} unit="ppm" required />
      <NumberField label="Air pressure" value={pressure} onChangeText={setPressure} unit="hPa" required />

      <Section label="Time of day" />
      <PillSelect options={TIME_PERIODS} value={timePeriod} onChange={setTimePeriod} />

      <SubmitBar label="Record reading" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
