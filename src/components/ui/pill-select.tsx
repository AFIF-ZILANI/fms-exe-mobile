import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PillOption<T extends string> = {
  value: T;
  label: string;
  tone?: 'success' | 'critical';
  /** Shown but not selectable (greyed). */
  disabled?: boolean;
};

type PillSelectProps<T extends string> = {
  options: PillOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

/** A wrapping row of single-select pills -- used for small fixed enums
 *  (time_period, feed_type) and for the performance criteria grid, where
 *  each option's label already carries its point value. */
export function PillSelect<T extends string>({ options, value, onChange }: PillSelectProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        const textColor = active ? 'onPrimary' : (opt.tone ?? 'inkSoft');
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            disabled={opt.disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !!opt.disabled }}
            style={[
              styles.pill,
              {
                borderColor: active ? theme.primary : theme.line,
                backgroundColor: active ? theme.primary : theme.surface,
                opacity: opt.disabled ? 0.45 : 1,
              },
            ]}
          >
            <AppText variant="label" color={textColor}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    minHeight: MinTouchTarget - 8,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
});
