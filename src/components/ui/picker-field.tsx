import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Radius, Size, Spacing, elevation } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** Below this a search field is furniture. docs/layout/08-log-consumption.md. */
const SEARCH_THRESHOLD = 12;

type PickerFieldProps<T> = {
  label: string;
  value: T | null;
  options: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | undefined;
  onChange: (item: T) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  loading?: boolean;
  /** Forces the search field on or off; defaults to "only past 12 options". */
  searchable?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
};

/**
 * Every field that can be a choice is a choice — docs/design.md §7. The one
 * selection primitive HousePicker/EmployeePicker/ItemPicker build on, so the
 * interaction only gets written once.
 */
export function PickerField<T>({
  label,
  value,
  options,
  getKey,
  getLabel,
  getSubLabel,
  onChange,
  placeholder = 'Select…',
  error,
  helper,
  loading,
  searchable,
  emptyLabel = 'Nothing to choose from.',
  disabled,
}: PickerFieldProps<T>) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      const l = getLabel(opt).toLowerCase();
      const sub = getSubLabel?.(opt)?.toLowerCase() ?? '';
      return l.includes(q) || sub.includes(q);
    });
  }, [options, query, getLabel, getSubLabel]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="eyebrow" color="muted">
        {label}
      </AppText>

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? getLabel(value) : placeholder}`}
        style={[
          styles.field,
          {
            backgroundColor: theme.surfaceAlt,
            borderColor: error ? theme.critical : theme.line,
            borderWidth: error ? 2 : 1,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <AppText variant="body" color={value ? 'ink' : 'muted'} numberOfLines={1} style={styles.flex}>
          {value ? getLabel(value) : placeholder}
        </AppText>
        <Icon name="chevron-down" size={20} color="muted" />
      </Pressable>

      {error ? (
        <AppText variant="caption" color="critical">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="muted">
          {helper}
        </AppText>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={close} transparent>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Dismiss" />
        <SafeAreaView
          style={[styles.sheet, { backgroundColor: theme.surface }, elevation(scheme, 'sheet')]}
          edges={['bottom']}
        >
          <View style={[styles.handle, { backgroundColor: theme.line }]} />
          <View style={styles.sheetHeader}>
            <AppText variant="h2">{label}</AppText>
          </View>

          {showSearch && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search…"
              placeholderTextColor={theme.muted}
              autoCorrect={false}
              style={[
                styles.search,
                { color: theme.ink, backgroundColor: theme.surfaceAlt, borderColor: theme.line },
              ]}
            />
          )}

          {loading ? (
            <ActivityIndicator style={styles.loading} color={theme.muted} />
          ) : filtered.length === 0 ? (
            <AppText variant="body" color="muted" style={styles.empty}>
              {emptyLabel}
            </AppText>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={getKey}
              ItemSeparatorComponent={() => (
                <View style={[styles.rule, { backgroundColor: theme.line }]} />
              )}
              renderItem={({ item }) => {
                const selected = value !== null && getKey(item) === getKey(value);
                const sub = getSubLabel?.(item);
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      close();
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { backgroundColor: theme.surfaceAlt },
                    ]}
                  >
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{getLabel(item)}</AppText>
                      {sub ? (
                        <AppText variant="caption" color="muted">
                          {sub}
                        </AppText>
                      ) : null}
                    </View>
                    {selected ? <Icon name="check" size={20} color="primary" /> : null}
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  flex: { flex: 1 },
  field: {
    minHeight: Size.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  sheetHeader: { padding: Spacing.xl, paddingBottom: Spacing.md },
  search: {
    minHeight: Size.input,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  row: {
    minHeight: Size.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rule: { height: 1, marginLeft: Spacing.xl },
  loading: { padding: Spacing.xxl },
  empty: { padding: Spacing.xl },
});
