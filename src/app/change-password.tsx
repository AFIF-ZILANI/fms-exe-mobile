import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Header } from '@/components/ui/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

const MIN_LENGTH = 8;

/** Forced after a temporary password (the gate in _layout.tsx), voluntary from Settings. */
export default function ChangePasswordScreen() {
  const { changePassword, mustChangePassword, logout } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current.length > 0 && next.length >= MIN_LENGTH && confirm === next && !busy;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await changePassword(current, next);
      router.replace('/');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.status === 0
            ? "Can't reach the server. You need a connection to change your password."
            : (e.fieldError('new_password') ?? e.message)
          : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header
          title={mustChangePassword ? 'Set a new password' : 'Change password'}
          leading={mustChangePassword ? undefined : 'back'}
        />
        {mustChangePassword ? (
          <AppText variant="body" color="muted" style={styles.notice}>
            You signed in with a temporary password. Choose your own to continue.
          </AppText>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.fields}>
            <TextField
              label={mustChangePassword ? 'Temporary password' : 'Current password'}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
            />
            <TextField
              label="New password"
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              helper={`At least ${MIN_LENGTH} characters`}
              error={tooShort ? `At least ${MIN_LENGTH} characters` : undefined}
            />
            <TextField
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              error={mismatch ? "Passwords don't match" : error || undefined}
            />
            <Button label="Save password" onPress={() => void submit()} disabled={!canSubmit} loading={busy} />
            {mustChangePassword ? (
              <Button label="Log out" variant="ghost" onPress={() => void logout()} />
            ) : null}
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.md },
  fields: { gap: Spacing.lg, padding: Spacing.lg },
  notice: { marginTop: Spacing.sm },
});
