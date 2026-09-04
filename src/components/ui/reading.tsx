import { View } from 'react-native';
import { AppText } from '@/components/ui/text';
import { Spacing, type ThemeColor } from '@/constants/theme';

type ReadingProps = {
  value: string;
  label: string;
  color?: ThemeColor;
  align?: 'left' | 'center';
};

/** The hero Plex Mono figure + eyebrow caption -- docs/design.md §6. At most
 *  one per screen; if everything is the hero, nothing is. */
export function Reading({ value, label, color = 'ink', align = 'left' }: ReadingProps) {
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start', gap: Spacing.half }}>
      <AppText variant="reading" color={color}>
        {value}
      </AppText>
      <AppText variant="eyebrow" color="muted">
        {label}
      </AppText>
    </View>
  );
}
