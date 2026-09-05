import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { ItemPicker } from '@/components/ui/item-picker';
import { TextField } from '@/components/ui/text-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import type { Item } from '@/lib/types';

type AlertType = 'FEED' | 'MEDICINE';
type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

/** The one segmented control whose active segment is coloured: the level *is*
 *  a status, and status colours mean something. docs/layout/20-flag-low-stock.md. */
const LEVELS = [
  { value: 'INFO' as const, label: 'Info', activeTint: 'tintBlue' as const, activeColor: 'info' as const },
  { value: 'WARNING' as const, label: 'Warning', activeTint: 'tintAmber' as const, activeColor: 'warning' as const },
  { value: 'CRITICAL' as const, label: 'Critical', activeTint: 'tintRed' as const, activeColor: 'critical' as const },
];

const VERB: Record<AlertLevel, string> = {
  INFO: 'Raise notice',
  WARNING: 'Raise warning',
  CRITICAL: 'Raise critical alert',
};

/**
 * docs/layout/20-flag-low-stock.md. Raises a reorder signal without touching
 * Purchases — finance stays Admin's, because raising a signal and committing
 * farm money are different authority levels.
 *
 * Alerts has no actor column anywhere in the schema (no raised_by_id), so the
 * manager's name is prefixed into the description. It's a compromise and it
 * should read like one — worth a real field later, not worth a migration now.
 *
 * No confirm dialog and no threshold guard: this is the cheapest write in the
 * app, and every gram of friction means a farm runs out of feed on a Sunday.
 */
export default function FlagStockScreen() {
  const { employee } = useSession();
  const submit = useQueuedSubmit();

  const [item, setItem] = useState<Item | null>(null);
  const [type, setType] = useState<AlertType>('FEED');
  const [level, setLevel] = useState<AlertLevel>('WARNING');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
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
          // What makes the alert actionable on the Admin side — without it
          // they get a sentence and have to go find the item.
          ...(item && { related_id: item.id }),
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
      title="Flag low stock"
      dirty={!!item || !!title || !!description}
      submit={{
        label: VERB[level],
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      <ItemPicker
        value={item}
        onChange={(next) => {
          setItem(next);
          if (!titleTouched) setTitle(`Low stock: ${next.name}`);
          // Default the type from the item's category, still overridable.
          if (next.category === 'MEDICINE') setType('MEDICINE');
          else if (next.category === 'FEED') setType('FEED');
        }}
      />

      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          Type
        </AppText>
        <SegmentedToggle
          options={[
            { value: 'FEED', label: 'Feed' },
            { value: 'MEDICINE', label: 'Medicine' },
          ]}
          value={type}
          onChange={setType}
        />
      </View>

      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          Urgency
        </AppText>
        <SegmentedToggle options={LEVELS} value={level} onChange={setLevel} />
      </View>

      <TextField
        label="Title"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          setTitleTouched(true);
        }}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="How much is left, and how long it lasts"
        multiline
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
});
