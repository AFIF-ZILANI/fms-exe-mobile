import { useState } from 'react';
import { Pressable, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
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
export function TextField({ label, error, helper, multiline, style, secureTextEntry, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  // A password field gets a show/hide eye; it starts hidden.
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? theme.critical : focused ? theme.primary : theme.line;

  return (
    <View style={styles.wrap}>
      <AppText variant="eyebrow" color="muted">
        {label}
      </AppText>

      <View>
        <TextInput
          multiline={multiline}
          placeholderTextColor={theme.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !revealed}
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
            secureTextEntry && styles.withToggle,
            style,
          ]}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            style={styles.toggle}
          >
            <Icon name={revealed ? 'eye-off' : 'eye'} size={20} color="muted" />
          </Pressable>
        ) : null}
      </View>

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
  withToggle: { paddingRight: Size.input },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: Size.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.sans,
    fontSize: 16,
  },
});
