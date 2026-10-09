import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { quickDueOptions, sameMinute, toPickerDay, withPickedDay, withPickedTime } from '@/lib/due-date';
import { formatTime } from '@/lib/format';
import { dueLabel } from '@/lib/tasks-view';

type DueFieldProps = { value: Date; onChange: (next: Date) => void; error?: string };

/**
 * Pick a due date and time. iOS draws the picker inline. Android has no inline date-time picker, and
 * the library's Android picker is a dialog that stays open for as long as it is mounted -- shown straight
 * away and re-opening after Cancel -- so here it is mounted only while the person is picking: a field
 * that shows the choice, then the date dialog, then the time dialog.
 *
 * Above it, the three times a manager usually means as one-tap chips, so most tasks need no dialog at all.
 */
export function DueField({ value, onChange, error }: DueFieldProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'date' | 'time' | null>(null);
  // Fixed when the form opens: the chips are relative to the moment the manager started.
  const [openedAt] = useState(() => new Date());
  const picks = quickDueOptions(openedAt);

  const chips = (
    <View style={styles.chips}>
      {picks.map((p) => {
        const on = sameMinute(value, p.date);
        return (
          <Pressable
            key={p.label}
            onPress={() => onChange(p.date)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[
              styles.chip,
              { backgroundColor: on ? theme.primary : theme.surface, borderColor: on ? theme.primary : theme.line },
            ]}
          >
            <AppText variant="label" color={on ? 'onPrimary' : 'inkSoft'}>
              {p.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  if (Platform.OS !== 'android') {
    return (
      <View style={styles.stack}>
        {chips}
        <DateTimePicker
          value={value}
          mode="datetime"
          onValueChange={(_, date) => onChange(date)}
          accentColor={theme.primary}
        />
        {error ? <AppText variant="caption" color="critical">{error}</AppText> : null}
      </View>
    );
  }

  const iso = value.toISOString();
  return (
    <View style={styles.stack}>
      {chips}
      <Pressable
        onPress={() => setStep('date')}
        accessibilityRole="button"
        accessibilityLabel={`Due ${dueLabel(iso, new Date())} at ${formatTime(iso)}. Change`}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: pressed ? theme.surface : theme.surfaceAlt, borderColor: error ? theme.critical : theme.line },
        ]}
      >
        <AppText variant="body" style={styles.flex}>
          {dueLabel(iso, new Date())} · {formatTime(iso)}
        </AppText>
        <Icon name="calendar" size={20} color="muted" />
      </Pressable>

      {error ? (
        <AppText variant="caption" color="critical">
          {error}
        </AppText>
      ) : null}

      {step === 'date' ? (
        <DateTimePicker
          value={toPickerDay(value)}
          mode="date"
          accentColor={theme.primary}
          onValueChange={(_, picked) => {
            onChange(withPickedDay(picked, value));
            setStep('time');
          }}
          onDismiss={() => setStep(null)}
        />
      ) : null}
      {step === 'time' ? (
        <DateTimePicker
          value={value}
          mode="time"
          accentColor={theme.primary}
          onValueChange={(_, picked) => {
            onChange(withPickedTime(picked, value));
            setStep(null);
          }}
          onDismiss={() => setStep(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Size.input,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
});
