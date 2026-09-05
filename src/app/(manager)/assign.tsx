import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Screen } from '@/components/ui/screen';
import { EmployeePicker, usePrefillEmployee } from '@/components/ui/employee-picker';
import { HousePicker } from '@/components/ui/house-picker';
import { PickerField } from '@/components/ui/picker-field';
import { TextField } from '@/components/ui/text-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { SubmitBar } from '@/components/ui/submit-bar';
import { Section } from '@/components/ui/section';
import { AppText } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import type { House, Task } from '@/lib/types';

type Location = 'house' | 'other';

/** docs/PRD.md §6.15. The segmented toggle is the UI expression of the
 *  server's rule that house_id/location_note are mutually exclusive -- it
 *  makes the invalid combination unrepresentable rather than caught at POST. */
export default function AssignScreen() {
  const params = useLocalSearchParams<{ employee_id?: string }>();
  const theme = useTheme();
  const { employee: actor } = useSession();
  const submit = useQueuedSubmit();

  const [employee, setEmployee] = usePrefillEmployee(params.employee_id);
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location>('house');
  const [house, setHouse] = useState<House | null>(null);
  const [locationNote, setLocationNote] = useState('');
  const [dueAt, setDueAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [submitting, setSubmitting] = useState(false);

  const { data: tasks, isLoading: tasksLoading } = useGetData<Paginated<Task>>(
    '/tasks?active=true&limit=100',
    ['tasks', 'active'],
  );

  const isValid =
    !!employee &&
    !!task &&
    title.trim() !== '' &&
    (location === 'house' ? !!house : locationNote.trim() !== '');

  const handleSubmit = async () => {
    if (!employee || !task || !actor) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/task-assignments',
        body: {
          employee_id: employee.id,
          assigned_by_id: actor.profile.id,
          task_id: task.id,
          title: title.trim(),
          due_at: dueAt.toISOString(),
          ...(description.trim() && { description: description.trim() }),
          ...(location === 'house' ? { house_id: house!.id } : { location_note: locationNote.trim() }),
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll bottomInset={96}>
      <Stack.Screen options={{ title: 'Assign task' }} />
      {!params.employee_id && (
        <>
          <Section label="Who" />
          <EmployeePicker value={employee} onChange={setEmployee} role="WORKER" />
        </>
      )}

      <Section label="What" />
      <PickerField
        label="Task"
        value={task}
        options={tasks?.results ?? []}
        getKey={(t) => t.id}
        getLabel={(t) => t.label}
        getSubLabel={(t) => t.task_type?.label}
        onChange={(t) => {
          setTask(t);
          // Prefilled here rather than in an effect -- it's a response to the
          // user picking, and only fills a title they haven't written yet.
          if (!title.trim()) setTitle(t.label);
        }}
        loading={tasksLoading}
        emptyLabel="No tasks defined yet."
      />
      <TextField label="Title" value={title} onChangeText={setTitle}  />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />

      <Section label="Where" />
      <SegmentedToggle
        options={[
          { value: 'house', label: 'House' },
          { value: 'other', label: 'Other' },
        ]}
        value={location}
        onChange={setLocation}
      />
      {location === 'house' ? (
        <HousePicker value={house} onChange={setHouse} />
      ) : (
        <TextField
          label="Location"
          value={locationNote}
          onChangeText={setLocationNote}
          placeholder="e.g. front gate"
          
        />
      )}

      <Section label="When" />
      <View style={{ gap: Spacing.one }}>
        <AppText variant="label" color="muted">
          Due
        </AppText>
        <DateTimePicker
          value={dueAt}
          mode="datetime"
          onValueChange={(_, date) => setDueAt(date)}
          accentColor={theme.ink}
        />
      </View>

      <SubmitBar label="Assign task" onPress={handleSubmit} disabled={!isValid} loading={submitting} />
    </Screen>
  );
}
