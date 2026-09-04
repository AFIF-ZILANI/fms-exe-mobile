import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { PickerField } from '@/components/ui/picker-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { Doctor } from '@/lib/types';

type TreatmentType = 'medication' | 'vaccination';

/** docs/PRD.md §6.11. One screen, two endpoints -- Medications.dosage is a
 *  free-text string ("2ml/L"), Vaccinations.dosage is an integer (dose
 *  count), so the field itself swaps type/input with the toggle. Doctor is
 *  optional -- treatments happen without one. */
export default function TreatmentScreen() {
  const params = useLocalSearchParams<{ house_id?: string; task_id?: string; type?: TreatmentType }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [type, setType] = useState<TreatmentType>(params.type === 'vaccination' ? 'vaccination' : 'medication');
  const [house, setHouse] = usePrefillHouse(params.house_id);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [cause, setCause] = useState('');
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { balance } = useResolvedBatch(house?.id);
  const { data: doctors, isLoading: doctorsLoading } = useGetData<Paginated<Doctor>>(
    '/doctors?limit=100',
    ['doctors'],
  );

  const dosageValid = type === 'vaccination' ? Number(dosage) > 0 && Number.isInteger(Number(dosage)) : dosage.trim() !== '';
  const isValid = !!house && !!balance && name.trim() !== '' && dosageValid;

  const handleSubmit = async () => {
    if (!house || !balance || !employee) return;
    setSubmitting(true);
    try {
      const endpoint = type === 'medication' ? '/medications' : '/vaccinations';
      const nameField = type === 'medication' ? 'medicine_name' : 'vaccine_name';
      const queued = await submit({
        endpoint,
        body: {
          batch_id: balance.batch_id,
          [nameField]: name.trim(),
          dosage: type === 'vaccination' ? Number(dosage) : dosage.trim(),
          administered_by_id: employee.profile.id,
          ...(cause.trim() && { cause: cause.trim() }),
          ...(doctor && { doctor_id: doctor.id }),
          ...(remarks.trim() && { remarks: remarks.trim() }),
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
      <Stack.Screen options={{ title: 'Treatment' }} />
      <Section label="Type" />
      <SegmentedToggle
        options={[
          { value: 'medication', label: 'Medication' },
          { value: 'vaccination', label: 'Vaccination' },
        ]}
        value={type}
        onChange={setType}
      />

      <Section label="House" />
      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      <Section label="Treatment" />
      <TextField
        label={type === 'medication' ? 'Medicine name' : 'Vaccine name'}
        value={name}
        onChangeText={setName}
        required
      />
      {type === 'vaccination' ? (
        <NumberField label="Dosage" value={dosage} onChangeText={setDosage} unit="doses" required allowDecimal={false} />
      ) : (
        <TextField label="Dosage" value={dosage} onChangeText={setDosage} placeholder="e.g. 2ml/L" required />
      )}
      <TextField label="Cause" value={cause} onChangeText={setCause} />
      <PickerField
        label="Doctor"
        value={doctor}
        options={doctors?.results ?? []}
        getKey={(d) => d.id}
        getLabel={(d) => d.profile.name}
        getSubLabel={(d) => d.specialty ?? undefined}
        onChange={setDoctor}
        loading={doctorsLoading}
        required={false}
        placeholder="None"
        emptyLabel="No doctors on file."
      />
      <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline />

      <SubmitBar
        label={type === 'medication' ? 'Record medication' : 'Record vaccination'}
        onPress={handleSubmit}
        disabled={!isValid}
        loading={submitting}
      />
    </Screen>
  );
}
