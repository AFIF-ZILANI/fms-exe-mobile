import { Text as RNText, type TextProps } from 'react-native';
import { Type, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppTextProps = TextProps & {
  variant?: keyof typeof Type;
  color?: ThemeColor;
};

/**
 * The whole type scale in one component -- docs/design.md §3. Every numeral
 * in the app should be `variant="data"|"figure"|"reading"`, never a `body`/
 * `label` variant on a digit string.
 */
export function AppText({ style, variant = 'body', color, ...rest }: AppTextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[Type[variant], { color: theme[color ?? 'ink'] }, style]}
      {...rest}
    />
  );
}
