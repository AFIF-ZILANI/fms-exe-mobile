import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type SubmitBarProps = {
  /** Carries the value it will write, e.g. "Record 12 deaths" — the button
   *  names the record, not a generic "Submit". docs/design.md §8. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** A ghost action *above* the primary, never beside it — a mis-tap on a
   *  2-up bar is exactly the error being guarded against. */
  secondary?: { label: string; onPress: () => void; destructive?: boolean };
};

/** Sticky bottom, at the thumb. Content scrolls behind it — never a button at
 *  the end of a scroll. docs/design.md §4.3. */
export function SubmitBar({ label, onPress, disabled, loading, secondary }: SubmitBarProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        elevation(scheme, 'sheet'),
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
          paddingBottom: insets.bottom + Spacing.md,
        },
      ]}
    >
      {secondary ? (
        <Button
          variant="ghost"
          label={secondary.label}
          onPress={secondary.onPress}
          block
        />
      ) : null}

      <Button label={label} onPress={onPress} disabled={disabled} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.xs,
  },
});
