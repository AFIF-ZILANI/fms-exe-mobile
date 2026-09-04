import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { Screen } from '@/components/ui/screen';
import { ItemPicker } from '@/components/ui/item-picker';
import { TextField } from '@/components/ui/text-field';
import { PillSelect } from '@/components/ui/pill-select';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import type { Item } from '@/lib/types';

type AlertType = 'FEED' | 'MEDICINE';
type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

const TYPES: { value: AlertType; label: string }[] = [
  { value: 'FEED', label: 'Feed' },
  { value: 'MEDICINE', label: 'Medicine' },
];

const LEVELS: { value: AlertLevel; label: string }[] = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
];

/**
 * docs/PRD.md §6.20. Raises a reorder signal without touching Purchases --
 * finance stays Admin's.
 *
 * Alerts has no actor column anywhere in the schema (no raised_by_id), so
 * the manager's name is prefixed into the description. Worth a real field
 * later; not worth a migration in this pass.
 */
export default function FlagStockScreen() {
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [item, setItem] = useState<Item | null>(null);
  const [type, setType] = useState<AlertType>('FEED');
  const [level, setLevel] = useState<AlertLevel>('WARNING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = title.trim() !== '';

  const handleSubmit = async () => {
    if (!employee) return;
    setSubmitting(true);
    try {
      const raisedBy = `Raised by ${employee.profile.name}`;
      const body = description.trim() ? `${raisedBy}. ${description.trim()}` : raisedBy;
      const queued = await submit({
        endpoint: '/alerts',
        body: {
          title: title.trim(),
          type,
          level,
          description: body,
          ...(item && { related_id: item.id }),
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Flag low stock' }} />
      <Section label="Item" />
      <ItemPicker
        value={item}
        onChange={(next) => {
          setItem(next);
          setTitle(`Low stock: ${next.name}`);
        }}
        required={false}
      />

      <Section label="Type" />
      <PillSelect options={TYPES} value={type} onChange={setType} />

      <Section label="Level" />
      <PillSelect options={LEVELS} value={level} onChange={setLevel} />

      <Section label="Detail" />
      <TextField label="Title" value={title} onChangeText={setTitle} required />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />

      <SubmitBar label="Raise alert" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
