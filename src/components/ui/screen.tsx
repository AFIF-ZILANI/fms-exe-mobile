import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = ViewProps & {
  /** false for a screen that manages its own scrolling (e.g. one with a
   *  sticky <SubmitBar/> that needs the list to scroll behind it). */
  scroll?: boolean;
  /** Reserve space at the bottom for a sticky <SubmitBar/>. The tab bar sits
   *  in the navigator's layout, so a tabbed screen needs nothing here. */
  bottomInset?: number;
  /** Screens that render their own <Header> opt out of the top safe-area
   *  inset, since the header takes it instead. */
  edges?: ('top' | 'bottom')[];
};

/** Ground fill, 20dp horizontal padding — the shell every screen is built on.
 *  docs/design.md §4.3. */
export function Screen({
  children,
  style,
  scroll = true,
  bottomInset = 0,
  edges = ['top'],
  ...rest
}: ScreenProps) {
  const theme = useTheme();
  const Container = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.ground }]} edges={edges}>
      <Container
        style={scroll ? undefined : [styles.body, style]}
        contentContainerStyle={
          scroll ? [styles.bodyScroll, { paddingBottom: bottomInset + Spacing.xxl }, style] : undefined
        }
        showsVerticalScrollIndicator={false}
        {...rest}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.xl },
  bodyScroll: { paddingHorizontal: Spacing.xl },
});
