import { useState } from 'react';
import { PickerField } from '@/components/ui/picker-field';
import { useGetData, type Paginated } from '@/lib/api';
import type { House } from '@/lib/types';

const HOUSES_KEY = ['houses', 'active'];

export function useHouseOptions() {
  return useGetData<Paginated<House>>('/houses?active=true&limit=100', HOUSES_KEY);
}

/**
 * Resolves a `?house_id=` deep-link param (docs/PRD.md's "context carries
 * through") to the full House object every picker needs, once the shared
 * houses query has loaded.
 *
 * Derived during render rather than synced in an effect: the prefill is a
 * pure function of (param, loaded data), and an effect would fire a second
 * render pass every time the query resolves. Once the user picks for
 * themselves their choice wins, including clearing it back to nothing.
 */
export function usePrefillHouse(houseIdParam: string | undefined) {
  const { data } = useHouseOptions();
  const [chosen, setChosen] = useState<House | null>(null);
  const [hasChosen, setHasChosen] = useState(false);

  const prefilled = data?.results.find((h) => h.id === houseIdParam) ?? null;
  const house = hasChosen ? chosen : prefilled;

  const setHouse = (next: House | null) => {
    setHasChosen(true);
    setChosen(next);
  };

  return [house, setHouse] as const;
}

type HousePickerProps = {
  value: House | null;
  onChange: (house: House) => void;
  error?: string;
  /** Overrides the "House" eyebrow — the transfer form needs "To". */
  label?: string;
};

export function HousePicker({ value, onChange, error, label = 'House' }: HousePickerProps) {
  const { data, isLoading } = useHouseOptions();

  return (
    <PickerField
      label={label}
      value={value}
      options={data?.results ?? []}
      getKey={(h) => h.id}
      getLabel={(h) => h.name}
      getSubLabel={(h) => h.type}
      onChange={onChange}
      loading={isLoading}
      error={error}
      emptyLabel="No active houses."
    />
  );
}
