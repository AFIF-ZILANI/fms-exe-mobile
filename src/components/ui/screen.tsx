import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = ViewProps & {
  /** false for a screen that manages its own scrolling (e.g. one with a
   *  sticky <SubmitBar/> that needs the list to scroll behind it). */
  scroll?: boolean;
  /** Reserve space at the bottom for a sticky <SubmitBar/> or the FAB. */
  bottomInset?: number;
};

/** Paper ground, 16dp horizontal padding -- the one screen shell every
 *  screen in docs/PRD.md is built on. */
export function Screen({ children, style, scroll = true, bottomInset = 0, ...rest }: ScreenProps) {
  const theme = useTheme();
  const Container = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.paper }]} edges={['top']}>
      <Container
        style={scroll ? undefined : [styles.body, style]}
        contentContainerStyle={
          scroll ? [styles.body, { paddingBottom: bottomInset }, style] : undefined
        }
        {...rest}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.three },
});
