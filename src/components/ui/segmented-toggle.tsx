import { Pressable, View, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, elevation, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type Option<T extends string> = {
  value: T;
  label: string;
  /** Fill for the active segment. Only for controls whose value *is* a status
   *  (the alert level on flag-stock); everything else stays neutral. */
  activeTint?: Extract<ThemeColor, 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue'>;
  activeColor?: ThemeColor;
};

type SegmentedToggleProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 48 for a consequential switch (treatment type, transfer reason); 44 for
   *  a filter. docs/layout/11-log-treatment.md. */
  height?: 44 | 48;
};

/**
 * Mutually-exclusive options as one control — used everywhere the server
 * enforces an either/or (House xor location note, Warehouse xor House,
 * TRANSFER xor ADJUSTMENT). Making it a toggle means the invalid combination
 * can't be expressed, rather than caught at submit. docs/PRD.md §6.15/§6.19.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  height = 44,
}: SegmentedToggleProps<T>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceAlt, height }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              styles.segment,
              active && {
                backgroundColor: opt.activeTint ? theme[opt.activeTint] : theme.surface,
                ...elevation(scheme, 'card'),
              },
            ]}
          >
            <AppText variant="label" color={active ? (opt.activeColor ?? 'ink') : 'muted'}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.pill, padding: 3 },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
});
