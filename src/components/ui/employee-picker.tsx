import { useState } from 'react';
import { PickerField } from '@/components/ui/picker-field';
import { useGetData, type Paginated } from '@/lib/api';
import type { Employee, EmployeeRole } from '@/lib/types';

/** Resolves a `?employee_id=` deep-link param (e.g. from the team detail
 *  screen into Rate/Assign) to the full Employee object. Derived during
 *  render, same reasoning as usePrefillHouse. */
export function usePrefillEmployee(employeeIdParam: string | undefined) {
  const { data } = useGetData<Paginated<Employee>>('/employees?limit=100', ['employees', 'all']);
  const [chosen, setChosen] = useState<Employee | null>(null);
  const [hasChosen, setHasChosen] = useState(false);

  const prefilled = data?.results.find((e) => e.id === employeeIdParam) ?? null;
  const employee = hasChosen ? chosen : prefilled;

  const setEmployee = (next: Employee | null) => {
    setHasChosen(true);
    setChosen(next);
  };

  return [employee, setEmployee] as const;
}

type EmployeePickerProps = {
  value: Employee | null;
  onChange: (employee: Employee) => void;
  role?: EmployeeRole;
  label?: string;
  error?: string;
};

export function EmployeePicker({
  value,
  onChange,
  role,
  label = 'Employee',
  error,
}: EmployeePickerProps) {
  const qs = role ? `role=${role}&limit=100` : 'limit=100';
  const { data, isLoading } = useGetData<Paginated<Employee>>(`/employees?${qs}`, [
    'employees',
    role ?? 'all',
  ]);

  return (
    <PickerField
      label={label}
      value={value}
      options={data?.results ?? []}
      getKey={(e) => e.id}
      getLabel={(e) => e.profile.name}
      getSubLabel={(e) => e.role}
      onChange={onChange}
      loading={isLoading}
      error={error}
      emptyLabel="No employees yet."
    />
  );
}
