import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toPickerDay, withPickedDay, withPickedTime } from '@/lib/due-date';
import { formatTime } from '@/lib/format';
import { dueLabel } from '@/lib/tasks-view';

type DueFieldProps = { value: Date; onChange: (next: Date) => void };

/**
 * Pick a due date and time. iOS draws the picker inline. Android has no inline date-time picker, and
 * the library's Android picker is a dialog that stays open for as long as it is mounted -- shown straight
 * away and re-opening after Cancel -- so here it is mounted only while the person is picking: a field
 * that shows the choice, then the date dialog, then the time dialog.
 */
export function DueField({ value, onChange }: DueFieldProps) {
  const theme = useTheme();
  const [step, setStep] = useState<'date' | 'time' | null>(null);

  if (Platform.OS !== 'android') {
    return (
      <DateTimePicker
        value={value}
        mode="datetime"
        onValueChange={(_, date) => onChange(date)}
        accentColor={theme.primary}
      />
    );
  }

  const iso = value.toISOString();
  return (
    <View>
      <Pressable
        onPress={() => setStep('date')}
        accessibilityRole="button"
        accessibilityLabel={`Due ${dueLabel(iso, new Date())} at ${formatTime(iso)}. Change`}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: pressed ? theme.surface : theme.surfaceAlt, borderColor: theme.line },
        ]}
      >
        <AppText variant="body" style={styles.flex}>
          {dueLabel(iso, new Date())} · {formatTime(iso)}
        </AppText>
        <Icon name="calendar" size={20} color="muted" />
      </Pressable>

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
