import { TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
import { AppText } from '@/components/ui/text';
import { FontFamily, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  error?: string;
};

/** Free text is reserved for reason/note/cause/description -- every other
 *  field is a picker. docs/design.md §5. */
export function TextField({
  label,
  required,
  error,
  multiline,
  style,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="muted">
        {label}
        {required ? ' *' : ''}
      </AppText>
      <TextInput
        multiline={multiline}
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          {
            color: theme.ink,
            backgroundColor: theme.field,
            borderColor: error ? theme.critical : theme.line,
            minHeight: multiline ? 96 : MinTouchTarget,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
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
  input: {
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontFamily: FontFamily.sans,
    fontSize: 16,
  },
});
