import { Pressable, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SubmitBarProps = {
  /** Carries the value it will write, e.g. "Record 12 deaths" -- the button
   *  names the record, not a generic "Submit". docs/design.md §7. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/** Sticky bottom, at the thumb. Content scrolls behind it -- never a button
 *  at the end of a scroll. docs/design.md §5. */
export function SubmitBar({ label, onPress, disabled, loading }: SubmitBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDisabled = disabled || loading;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.paper, borderTopColor: theme.line, paddingBottom: insets.bottom + Spacing.two },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: isDisabled ? theme.field : theme.ink }]}
      >
        {loading ? (
          <ActivityIndicator color={theme.muted} />
        ) : (
          <AppText variant="label" color={isDisabled ? 'muted' : 'paper'}>
            {label}
          </AppText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  button: {
    minHeight: MinTouchTarget,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
