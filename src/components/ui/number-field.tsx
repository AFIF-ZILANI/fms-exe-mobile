import { TextInput, View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { FontFamily, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NumberFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit?: string;
  required?: boolean;
  error?: string;
  autoFocus?: boolean;
  allowDecimal?: boolean;
};

/** Numeric keypad + Plex Mono -- every count, weight, and reading in the app
 *  goes through this. docs/design.md §5, §3.2. */
export function NumberField({
  label,
  value,
  onChangeText,
  unit,
  required,
  error,
  autoFocus,
  allowDecimal = true,
}: NumberFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="muted">
        {label}
        {required ? ' *' : ''}
      </AppText>
      <View
        style={[
          styles.row,
          { backgroundColor: theme.field, borderColor: error ? theme.critical : theme.line },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.ink }]}
        />
        {unit !== undefined && (
          <AppText variant="data" color="muted">
            {unit}
          </AppText>
        )}
      </View>
      {error !== undefined && (
        <AppText variant="data" color="critical">
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.two,
  },
  input: { flex: 1, fontFamily: FontFamily.monoSemiBold, fontSize: 24, paddingVertical: Spacing.two },
});
