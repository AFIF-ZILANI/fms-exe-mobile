import type { ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goBack } from '@/lib/nav';

type FormScreenProps = {
  title: string;
  children: ReactNode;
  submit: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    secondary?: { label: string; onPress: () => void };
  };
  /** Set when any field has been touched — closing then confirms the discard.
   *  No dialog on an untouched form. docs/layout/07-log-mortality.md. */
  dirty?: boolean;
};

/**
 * The shared spine every log and manager form is built on: close header,
 * scrolling body, sticky submit bar. The tab bar is hidden on these routes,
 * so the submit bar owns the bottom. docs/layout/07-log-mortality.md.
 */
export function FormScreen({ title, children, submit, dirty }: FormScreenProps) {
  const theme = useTheme();

  const close = () => {
    if (!dirty) {
      goBack();
      return;
    }
    Alert.alert('Discard this entry?', 'Nothing has been recorded yet.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => goBack() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.ground }]} edges={['top']}>
      {/* A form is a modal task: ✕ says the work is discarded, where a back
          chevron would say it's saved. */}
      <View style={styles.header}>
        <Header title={title} leading="close" onLeadingPress={close} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen edges={[]} bottomInset={Spacing.xl}>
          <View style={styles.body}>{children}</View>
        </Screen>

        <SubmitBar {...submit} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.xl },
  body: { gap: Spacing.lg, paddingTop: Spacing.xs },
});
