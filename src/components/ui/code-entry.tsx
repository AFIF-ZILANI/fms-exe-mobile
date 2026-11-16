import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { AppText } from '@/components/ui/text';
import { FontFamily, Size, Spacing } from '@/constants/theme';

type CodeEntryProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** The keyboard's Done and the Count button both land here. */
  onSubmit: () => void;
  /** Enough is typed to try; until then the button waits. */
  ready: boolean;
  /** A lookup is running: the button shows it instead of letting a second tap pile on. */
  busy?: boolean;
  /** How the last try went, under the field: counted (green tick) or why not (red). */
  message?: { ok: boolean; text: string } | null;
  placeholder?: string;
  actionLabel?: string;
};

/**
 * Type the characters printed under a QR label that won't scan: one field, the action beside it at the
 * same height, and the answer under both. The surrounding card says what to type, so the field has no
 * label of its own. docs/design.md §4.4 (control sizes).
 */
export function CodeEntry({
  value,
  onChangeText,
  onSubmit,
  ready,
  busy,
  message,
  placeholder = 'e.g. 3d4e5f6',
  actionLabel = 'Count',
}: CodeEntryProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            hideLabel
            label="Code"
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            selectTextOnFocus
            // Android: a plain keyboard with no word composition. Gboard otherwise keeps its in-progress
            // "word" and types the next code onto the end of the last one.
            keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
            placeholder={placeholder}
            onSubmitEditing={onSubmit}
            returnKeyType="done"
            style={styles.code}
          />
        </View>
        <Button label={actionLabel} icon="plus" onPress={onSubmit} disabled={!ready} loading={busy} />
      </View>

      {message ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon
            name={message.ok ? 'check-circle' : 'alert-circle'}
            size={18}
            color={message.ok ? 'success' : 'critical'}
          />
          <AppText variant="caption" color={message.ok ? 'ink' : 'critical'} style={styles.flex}>
            {message.text}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  flex: { flex: 1 },
  // A code reads better a little bolder and spaced out than ordinary text. Exactly the button's height:
  // the font's own line height plus padding would otherwise leave the field a few dp taller than Count.
  code: { fontFamily: FontFamily.sansSemiBold, letterSpacing: 0.5, height: Size.input, paddingVertical: 0 },
  message: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
