import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { HousePicker, usePrefillHouse } from '@/components/ui/house-picker';
import { BatchResolver, useResolvedBatch } from '@/components/ui/batch-resolver';
import { NumberField } from '@/components/ui/number-field';
import { TextField } from '@/components/ui/text-field';
import { PickerField } from '@/components/ui/picker-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { Doctor } from '@/lib/types';

type TreatmentType = 'medication' | 'vaccination';

/**
 * docs/layout/11-log-treatment.md. One screen, two endpoints —
 * Medications.dosage is a free-text string ("2ml/L"), Vaccinations.dosage is
 * an integer dose count, so the field itself swaps type with the toggle.
 * Doctor is optional and stays optional: treatments happen without one, and a
 * required field here produces "N/A" in every row within a week.
 *
 * The toggle sits above everything else because it changes what every field
 * below is called and which endpoint receives the write.
 */
export default function TreatmentScreen() {
  const params = useLocalSearchParams<{
    house_id?: string;
    task_id?: string;
    type?: TreatmentType;
  }>();
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [type, setType] = useState<TreatmentType>(
    params.type === 'vaccination' ? 'vaccination' : 'medication',
  );
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

  const isVaccination = type === 'vaccination';
  const dosageValid = isVaccination
    ? Number(dosage) > 0 && Number.isInteger(Number(dosage))
    : dosage.trim() !== '';
  const isValid = !!house && !!balance && name.trim() !== '' && dosageValid;

  const handleSubmit = async () => {
    if (!house || !balance || !employee) return;
    setSubmitting(true);
    try {
      const endpoint = isVaccination ? '/vaccinations' : '/medications';
      const nameField = isVaccination ? 'vaccine_name' : 'medicine_name';
      const queued = await submit({
        endpoint,
        body: {
          batch_id: balance.batch_id,
          [nameField]: name.trim(),
          dosage: isVaccination ? Number(dosage) : dosage.trim(),
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
    <FormScreen
      title="Log treatment"
      dirty={!!name || !!dosage || !!cause || !!remarks}
      submit={{
        label: isVaccination ? 'Record vaccination' : 'Record medication',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      {/* Switching preserves house and the shared fields — a worker who picked
          the wrong type shouldn't retype the house. */}
      <SegmentedToggle
        height={48}
        options={[
          { value: 'medication', label: 'Medication' },
          { value: 'vaccination', label: 'Vaccination' },
        ]}
        value={type}
        onChange={setType}
      />

      <HousePicker value={house} onChange={setHouse} />
      <BatchResolver houseId={house?.id} />

      <TextField
        label={isVaccination ? 'Vaccine name' : 'Medication name'}
        value={name}
        onChangeText={setName}
      />

      {isVaccination ? (
        <NumberField
          label="Dose"
          value={dosage}
          onChangeText={setDosage}
          unit="doses"
          allowDecimal={false}
        />
      ) : (
        // Free text on purpose: "1 g per litre, 5 days" is how it's written on
        // the bottle and how a vet says it.
        <TextField
          label="Dosage"
          value={dosage}
          onChangeText={setDosage}
          placeholder="e.g. 2ml/L for 5 days"
        />
      )}

      <TextField
        label={isVaccination ? 'Reason (optional)' : 'Cause (optional)'}
        value={cause}
        onChangeText={setCause}
        multiline
      />

      <PickerField
        label="Doctor (optional)"
        value={doctor}
        options={doctors?.results ?? []}
        getKey={(d) => d.id}
        getLabel={(d) => d.profile.name}
        getSubLabel={(d) => d.specialty ?? undefined}
        onChange={setDoctor}
        loading={doctorsLoading}
        placeholder="None"
        emptyLabel="No doctors on file."
      />

      <TextField label="Remarks (optional)" value={remarks} onChangeText={setRemarks} multiline />
    </FormScreen>
  );
}
