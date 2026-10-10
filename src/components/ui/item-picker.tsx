import { PickerField } from '@/components/ui/picker-field';
import { useGetData, type Paginated } from '@/lib/api';
import { humanise } from '@/lib/profile-format';
import type { Item } from '@/lib/types';

type ItemPickerProps = {
  value: Item | null;
  onChange: (item: Item) => void;
  /** Filters to Item.is_unit_tracked -- see server/src/services/stock-unit.service.ts's
   *  bind() gate. Consumption (docs/PRD.md §6.8) wants false (no QR in v1);
   *  Receive stock (§6.18) wants true. Omit for an unfiltered list. */
  unitTracked?: boolean;
  /** ItemCategory.code, e.g. "FEED" -- used by the feeding program screen. */
  category?: string;
  error?: string;
  placeholder?: string;
  /** For an optional use: shows a × that puts it back to nothing. */
  onClear?: () => void;
};

export function ItemPicker({
  value,
  onChange,
  unitTracked,
  category,
  error,
  placeholder,
  onClear,
}: ItemPickerProps) {
  // The server caps limit at 100 and 400s above it.
  const params = new URLSearchParams({ is_active: 'true', limit: '100' });
  if (unitTracked !== undefined) params.set('is_unit_tracked', String(unitTracked));
  if (category !== undefined) params.set('category', category);

  const { data, isLoading } = useGetData<Paginated<Item>>(`/items?${params.toString()}`, [
    'items',
    unitTracked ?? 'all',
    category ?? 'all',
  ]);

  return (
    <PickerField
      label="Item"
      value={value}
      options={data?.results ?? []}
      getKey={(i) => i.id}
      getLabel={(i) => i.name}
      getSubLabel={(i) => humanise(i.category)}
      onChange={onChange}
      loading={isLoading}
      error={error}
      onClear={onClear}
      placeholder={placeholder}
      emptyLabel="No items found."
    />
  );
}
