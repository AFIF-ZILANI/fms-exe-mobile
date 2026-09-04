import { Pressable, View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

type SectionProps = {
  label: string;
  trailing?: string;
  onTrailingPress?: () => void;
};

/** The eyebrow row that opens every grouped block ("TODAY · 3 SEP",
 *  "HOUSES", "PAYROLL HISTORY"). Structure comes from this + hairlines, not
 *  elevated cards -- docs/design.md §4.3. */
export function Section({ label, trailing, onTrailingPress }: SectionProps) {
  return (
    <View style={styles.row}>
      <AppText variant="eyebrow" color="muted">
        {label}
      </AppText>
      {trailing !== undefined && (
        <Pressable onPress={onTrailingPress} disabled={!onTrailingPress}>
          <AppText variant="eyebrow" color="muted">
            {trailing}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
});
