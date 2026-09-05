import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { MinTouchTarget, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SegmentedToggleProps<T extends string> = {
  options: readonly [{ value: T; label: string }, { value: T; label: string }];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Two mutually-exclusive options as one control -- used everywhere the server
 * enforces an either/or (House xor location note, Warehouse xor House,
 * TRANSFER xor ADJUSTMENT). Making it a toggle means the invalid combination
 * can't be entered, rather than caught at submit. docs/PRD.md §6.15/§6.19.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  const theme = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: theme.field, borderColor: theme.line }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: theme.ink }]}
          >
            <AppText variant="label" color={active ? 'paper' : 'muted'}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.pill, padding: 2 },
  segment: {
    flex: 1,
    minHeight: MinTouchTarget - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
});
