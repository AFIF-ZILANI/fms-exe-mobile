import { View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/card';
import { IconTile, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type KpiTileProps = {
  icon: IconName;
  /** The icon tile's fill and the glyph colour on it — same family, e.g. tintAmber + warning. */
  tint: 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue';
  tone: Extract<ThemeColor, 'success' | 'warning' | 'critical' | 'info'>;
  label: string;
  /** The figure. Always mono — pass it formatted. */
  value: string;
  /** One quiet line under the figure. */
  note?: string;
  /** 0–1: draws a thin bar under the note, filled in the tile's tone. */
  progress?: number;
};

/**
 * A figure with its label and context, on a white card: icon tile and label on
 * the first line, the number large beneath it, then a muted footer. Quieter than
 * StatCard's tinted block, so a row of them reads as a dashboard rather than
 * four coloured buttons. Colour lives only in the icon (and the bar).
 */
export function KpiTile({ icon, tint, tone, label, value, note, progress }: KpiTileProps) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <IconTile name={icon} tint={tint} color={tone} size={32} />
        <AppText variant="label" color="muted" style={styles.label} numberOfLines={2}>
          {label}
        </AppText>
      </View>

      <AppText variant="stat" numberOfLines={1} adjustsFontSizeToFit style={styles.value}>
        {value}
      </AppText>

      <View style={styles.foot}>
        {progress !== undefined && (
          <View style={[styles.track, { backgroundColor: theme.line }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`, backgroundColor: theme[tone] },
              ]}
            />
          </View>
        )}
        {note ? (
          <AppText variant="caption" color="muted">
            {note}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { flex: 1 },
  value: { marginTop: Spacing.xs },
  foot: { gap: Spacing.sm, marginTop: 'auto' },
  track: { height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: Radius.pill },
});
