import { useState } from 'react';
import { TextInput, View, StyleSheet, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/text';
import { FontFamily, Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Required fields carry no asterisk — the disabled submit bar and the
   *  inline error carry that information. docs/layout/README.md. */
  error?: string;
  helper?: string;
};

/** Free text is reserved for reason/note/cause/description — every other
 *  field is a picker. docs/design.md §7. */
export function TextField({ label, error, helper, multiline, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.critical : focused ? theme.primary : theme.line;

  return (
    <View style={styles.wrap}>
      <AppText variant="eyebrow" color="muted">
        {label}
      </AppText>

      <TextInput
        multiline={multiline}
        placeholderTextColor={theme.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            color: theme.ink,
            backgroundColor: theme.surfaceAlt,
            borderColor,
            borderWidth: error || focused ? 2 : 1,
            minHeight: multiline ? 88 : Size.input,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />

      {error ? (
        <AppText variant="caption" color="critical">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="muted">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  input: {
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.sans,
    fontSize: 16,
  },
});
