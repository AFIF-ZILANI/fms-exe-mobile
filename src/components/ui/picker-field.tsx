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
import { Divider } from '@/components/ui/divider';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PickerFieldProps<T> = {
  label: string;
  value: T | null;
  options: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | undefined;
  onChange: (item: T) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  loading?: boolean;
  searchable?: boolean;
  emptyLabel?: string;
};

/**
 * Every field that can be a choice is a choice -- docs/design.md §5. The one
 * selection primitive HousePicker/EmployeePicker/ItemPicker and the rest
 * build on, so the "pick house or fragment-search a lot" interaction only
 * gets written once.
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
  required,
  error,
  loading,
  searchable = true,
  emptyLabel = 'Nothing to choose from.',
}: PickerFieldProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      const label = getLabel(opt).toLowerCase();
      const sub = getSubLabel?.(opt)?.toLowerCase() ?? '';
      return label.includes(q) || sub.includes(q);
    });
  }, [options, query, getLabel, getSubLabel]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="muted">
        {label}
        {required ? ' *' : ''}
      </AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[
          styles.field,
          { backgroundColor: theme.field, borderColor: error ? theme.critical : theme.line },
        ]}
      >
        <AppText variant="body" color={value ? 'ink' : 'muted'}>
          {value ? getLabel(value) : placeholder}
        </AppText>
      </Pressable>
      {error !== undefined && (
        <AppText variant="data" color="critical">
          {error}
        </AppText>
      )}

      <Modal visible={open} animationType="slide" onRequestClose={close} transparent>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.paper }]}>
          <View style={styles.sheetHeader}>
            <AppText variant="title">{label}</AppText>
            <Pressable onPress={close} accessibilityRole="button" hitSlop={12}>
              <AppText variant="label" color="muted">
                Close
              </AppText>
            </Pressable>
          </View>
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search…"
              placeholderTextColor={theme.muted}
              style={[
                styles.search,
                { color: theme.ink, backgroundColor: theme.field, borderColor: theme.line },
              ]}
              autoFocus
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
              ItemSeparatorComponent={Divider}
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
                    style={styles.row}
                  >
                    <View>
                      <AppText variant="body">{getLabel(item)}</AppText>
                      {sub !== undefined && (
                        <AppText variant="data" color="muted">
                          {sub}
                        </AppText>
                      )}
                    </View>
                    {selected && (
                      <AppText variant="label" color="ink">
                        ✓
                      </AppText>
                    )}
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
  wrap: { gap: Spacing.one },
  field: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.two,
  },
  sheet: { flex: 1, paddingHorizontal: Spacing.three },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  search: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.two,
    fontSize: 16,
  },
  row: {
    minHeight: MinTouchTarget,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  loading: { marginTop: Spacing.five },
  empty: { marginTop: Spacing.five, textAlign: 'center' },
});
