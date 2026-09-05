import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Size, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  /** Full width inside the screen padding. Default for primary. */
  block?: boolean;
};

/** The four button variants in docs/design.md §4.4. Sizes are fixed there, so
 *  a screen never picks its own height. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  block,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const height =
    variant === 'primary' || variant === 'destructive'
      ? Size.buttonPrimary
      : variant === 'secondary'
        ? Size.buttonSecondary
        : Size.buttonGhost;

  const fill: string =
    isDisabled && variant !== 'ghost'
      ? theme.surfaceAlt
      : variant === 'primary'
        ? theme.primary
        : variant === 'destructive'
          ? theme.critical
          : variant === 'secondary'
            ? theme.surface
            : 'transparent';

  const labelColor: ThemeColor = isDisabled
    ? 'muted'
    : variant === 'primary' || variant === 'destructive'
      ? 'onPrimary'
      : variant === 'ghost'
        ? 'primary'
        : 'ink';

  const isBlock = block ?? (variant === 'primary' || variant === 'destructive');

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          backgroundColor:
            pressed && !isDisabled && variant === 'primary' ? theme.primaryPressed : fill,
          alignSelf: isBlock ? 'stretch' : 'flex-start',
          paddingHorizontal: isBlock ? Spacing.lg : Spacing.xl,
          transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
        },
        variant === 'secondary' && { borderWidth: 1, borderColor: theme.line },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.muted} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={20} color={labelColor} /> : null}
          <AppText variant="label" color={labelColor}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
