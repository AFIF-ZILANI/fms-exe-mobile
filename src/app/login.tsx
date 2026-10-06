import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { ApiError, BASE_URL } from '@/lib/api';
import { useSession } from '@/lib/session';

/** The gate in _layout.tsx sends anyone without a session here, and away again once there is one. */
export default function LoginScreen() {
  const { login, expired } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unreachable, setUnreachable] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError('');
    setUnreachable(false);
    try {
      await login(email.trim(), password);
      // The gate navigates on its own once the session lands.
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setUnreachable(true);
      else setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Sign in" />

        {expired ? (
          <AppText variant="body" color="muted" style={styles.notice}>
            Your session ended. Sign in again — anything you recorded and haven&apos;t synced is still
            on this phone and will upload afterwards.
          </AppText>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.fields}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              error={error || undefined}
              onSubmitEditing={() => canSubmit && void submit()}
            />
            {unreachable ? (
              <View>
                <AppText variant="caption" color="critical">
                  Can&apos;t reach the server. You need a connection to sign in.
                </AppText>
                <AppText variant="data" color="muted" selectable>
                  {BASE_URL}
                </AppText>
              </View>
            ) : null}
            <Button label="Sign in" onPress={() => void submit()} disabled={!canSubmit} loading={busy} />
          </View>
        </Card>

        <AppText variant="caption" color="muted" style={styles.notice}>
          Your manager gives you an email and a temporary password. Forgot yours? Ask them to reset it.
        </AppText>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  fields: { gap: Spacing.lg, padding: Spacing.lg },
  notice: { marginTop: Spacing.md },
});
