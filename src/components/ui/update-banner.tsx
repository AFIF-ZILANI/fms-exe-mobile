import { Linking, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppUpdate } from '@/lib/use-app-update';

/**
 * Shown only when a newer APK is on the latest release. Tapping hands the download to the browser,
 * which saves it and offers to install -- no install permission or file handling in the app.
 */
export function UpdateBanner() {
  const theme = useTheme();
  const update = useAppUpdate();
  if (!update) return null;

  const label = `Update available — version ${update.version}`;

  return (
    <Pressable
      onPress={() => void Linking.openURL(update.url)}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Download`}
      style={({ pressed }) => [styles.banner, { backgroundColor: theme.tintBlue, opacity: pressed ? 0.85 : 1 }]}
    >
      <Icon name="download" size={20} color="info" />
      <AppText variant="label" style={styles.flex}>
        {label}
        <AppText variant="caption" color="muted">
          {'  ·  tap to download'}
        </AppText>
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: Size.buttonSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  flex: { flex: 1 },
});
