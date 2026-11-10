import { useState } from 'react';
import { Pressable, TextInput, View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Size, Spacing, Type, type ThemeColor } from '@/constants/theme';
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
  /** One-tap values shown under the field (e.g. 1, 2, 5, 10). Tapping sets the field to that value. */
  quick?: number[];
  /** The screen's one number: big centred figure between − and +. Needs `steppers`. */
  hero?: boolean;
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
  quick,
  hero,
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
        {steppers && hero ? (
          <Stepper icon="minus" hero onPress={() => step(-1)} disabled={(Number(value) || 0) <= 0} />
        ) : null}
        <View
          style={[
            styles.field,
            {
              backgroundColor: theme.surfaceAlt,
              borderColor,
              borderWidth: error || warn || focused ? 2 : 1,
            },
            hero && styles.heroField,
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
            style={[styles.input, hero && styles.heroInput, { color: theme.ink }]}
          />
          {unit ? (
            <AppText variant="body" color="muted">
              {unit}
            </AppText>
          ) : null}
        </View>

        {steppers && hero ? <Stepper icon="plus" hero onPress={() => step(1)} /> : null}
        {steppers && !hero ? (
          <>
            <Stepper icon="minus" onPress={() => step(-1)} disabled={(Number(value) || 0) <= 0} />
            <Stepper icon="plus" onPress={() => step(1)} />
          </>
        ) : null}
      </View>

      {quick && quick.length > 0 ? (
        <View style={styles.quick}>
          {quick.map((q) => {
            const on = value === String(q);
            return (
              <Pressable
                key={q}
                onPress={() => onChangeText(String(q))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Set to ${q}`}
                style={[
                  styles.chip,
                  { backgroundColor: on ? theme.primary : theme.surface, borderColor: on ? theme.primary : theme.line },
                ]}
              >
                <AppText variant="data" color={on ? 'onPrimary' : 'inkSoft'}>
                  {q}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

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
  hero,
}: {
  icon: 'minus' | 'plus';
  onPress: () => void;
  disabled?: boolean;
  hero?: boolean;
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
        hero && styles.heroStepper,
        {
          backgroundColor: pressed ? theme.surfaceAlt : theme.surface,
          borderColor: theme.line,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Icon name={icon} size={hero ? 28 : 24} color={disabled ? 'muted' : 'ink'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
  // Equal widths across the row: a half-filled row of pills reads as unfinished.
  quick: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  chip: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
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
  heroField: { minHeight: 88, justifyContent: 'center' },
  heroInput: { ...Type.hero, textAlign: 'center', paddingVertical: Spacing.lg },
  heroStepper: { width: 64, minHeight: 88 },
  stepper: {
    width: 56,
    minHeight: Size.inputNumber,
    borderWidth: 1,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
