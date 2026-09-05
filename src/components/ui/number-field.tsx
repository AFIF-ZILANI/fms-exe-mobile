import { useState } from 'react';
import { Pressable, TextInput, View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Size, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NumberFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Static suffix inside the field ("birds", "g", "kg"). */
  unit?: string;
  error?: string;
  helper?: string;
  helperColor?: ThemeColor;
  autoFocus?: boolean;
  allowDecimal?: boolean;
  /** ±1 buttons beside the input. Whole-number fields only — a stepper on a
   *  decimal field is a mis-tap generator. docs/layout/07-log-mortality.md. */
  steppers?: boolean;
  /** Warns without blocking: amber border, amber helper. A real event must
   *  always be recordable. */
  warn?: boolean;
};

/** Numeric keypad + Plex Mono — every count, weight and reading in the app
 *  goes through this. docs/design.md §7. */
export function NumberField({
  label,
  value,
  onChangeText,
  unit,
  error,
  helper,
  helperColor,
  autoFocus,
  allowDecimal = true,
  steppers,
  warn,
}: NumberFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.critical
    : warn
      ? theme.warning
      : focused
        ? theme.primary
        : theme.line;

  const step = (delta: number) => {
    const next = Math.max(0, (Number(value) || 0) + delta);
    onChangeText(String(next));
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="eyebrow" color="muted">
        {label}
      </AppText>

      <View style={styles.row}>
        <View
          style={[
            styles.field,
            {
              backgroundColor: theme.surfaceAlt,
              borderColor,
              borderWidth: error || warn || focused ? 2 : 1,
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
            autoFocus={autoFocus}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="0"
            placeholderTextColor={theme.muted}
            style={[styles.input, { color: theme.ink }]}
          />
          {unit ? (
            <AppText variant="body" color="muted">
              {unit}
            </AppText>
          ) : null}
        </View>

        {steppers ? (
          <>
            <Stepper icon="minus" onPress={() => step(-1)} disabled={(Number(value) || 0) <= 0} />
            <Stepper icon="plus" onPress={() => step(1)} />
          </>
        ) : null}
      </View>

      {error ? (
        <AppText variant="caption" color="critical">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color={helperColor ?? 'muted'}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

function Stepper({
  icon,
  onPress,
  disabled,
}: {
  icon: 'minus' | 'plus';
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={icon === 'plus' ? 'Increase' : 'Decrease'}
      style={({ pressed }) => [
        styles.stepper,
        {
          backgroundColor: pressed ? theme.surfaceAlt : theme.surface,
          borderColor: theme.line,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Icon name={icon} size={24} color={disabled ? 'muted' : 'ink'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Size.inputNumber,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.monoSemiBold,
    fontSize: 20,
    paddingVertical: Spacing.md,
  },
  stepper: {
    width: 56,
    minHeight: Size.inputNumber,
    borderWidth: 1,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
