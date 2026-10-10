import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Radius, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** A white card that groups the fields of one idea ("Where", "How many") so a long form reads as a few
 *  steps, not one endless column. Fields inside keep their own labels; the title names the group. */
export function FormCard({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View style={styles.wrap}>
      {title ? (
        <View style={styles.head}>
          <AppText variant="eyebrow" color="muted">
            {title}
          </AppText>
          {hint ? (
            <AppText variant="caption" color="muted">
              {hint}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.surface }, elevation(scheme, 'card')]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  card: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.lg },
});
