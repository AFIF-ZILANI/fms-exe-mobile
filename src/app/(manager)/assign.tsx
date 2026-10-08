import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { FormScreen } from '@/components/ui/form-screen';
import { EmployeePicker, usePrefillEmployee } from '@/components/ui/employee-picker';
import { DueField } from '@/components/ui/due-field';
import { HousePicker } from '@/components/ui/house-picker';
import { PickerField } from '@/components/ui/picker-field';
import { TextField } from '@/components/ui/text-field';
import { SegmentedToggle } from '@/components/ui/segmented-toggle';
import { AppText } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';
import { useQueuedSubmit } from '@/lib/use-queued-submit';
import { useGetData, type Paginated } from '@/lib/api';
import { routeForTaskType } from '@/lib/task-forms';
import type { House, Task } from '@/lib/types';

type Location = 'house' | 'other';

/** The next quarter-hour at least 30 minutes out, so the common case needs no
 *  time picker at all. docs/layout/15-assign-task.md. */
function defaultDue(): Date {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

/** docs/layout/15-assign-task.md. The segmented toggle is the UI expression of
 *  the server's rule that house_id/location_note are mutually exclusive — it
 *  makes the invalid combination unrepresentable rather than caught at POST. */
export default function AssignScreen() {
  const params = useLocalSearchParams<{ employee_id?: string }>();
  const { employee: actor } = useSession();
  const submit = useQueuedSubmit();

  const [employee, setEmployee] = usePrefillEmployee(params.employee_id);
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location>('house');
  const [house, setHouse] = useState<House | null>(null);
  const [locationNote, setLocationNote] = useState('');
  const [dueAt, setDueAt] = useState(defaultDue);
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

  // Tells the manager what the worker will actually see. Assigning "Clean
  // waterers" and expecting a form is the misunderstanding this prevents.
  const formRoute = task ? routeForTaskType(task.task_type?.code) : null;
  const formHint = task
    ? formRoute
      ? `Opens the ${task.task_type?.label?.toLowerCase() ?? 'linked'} form`
      : 'Marked done by hand — no form.'
    : undefined;

  const handleSubmit = async () => {
    if (!employee || !task || !actor) return;
    setSubmitting(true);
    try {
      const queued = await submit({
        endpoint: '/task-assignments',
        body: {
          employee_id: employee.id,
          task_id: task.id,
          title: title.trim(),
          due_at: dueAt.toISOString(),
          ...(description.trim() && { description: description.trim() }),
          ...(location === 'house'
            ? { house_id: house!.id }
            : { location_note: locationNote.trim() }),
        },
      });
      if (queued) router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const switchLocation = (next: Location) => {
    setLocation(next);
    // Clearing the other side is the point of the toggle — carrying a stale
    // location_note behind a House selection is exactly the state it prevents.
    if (next === 'house') setLocationNote('');
    else setHouse(null);
  };

  return (
    <FormScreen
      title="Assign a task"
      dirty={!!task || !!title || !!description || !!locationNote}
      submit={{
        label: employee ? `Assign to ${employee.profile.name.split(' ')[0]}` : 'Assign task',
        onPress: handleSubmit,
        disabled: !isValid,
        loading: submitting,
      }}
    >
      {!params.employee_id && (
        <EmployeePicker value={employee} onChange={setEmployee} role="WORKER" />
      )}

      <View style={styles.taskBlock}>
        <PickerField
          label="Task"
          value={task}
          options={tasks?.results ?? []}
          getKey={(t) => t.id}
          getLabel={(t) => t.label}
          getSubLabel={(t) => t.task_type?.code ?? 'No form'}
          onChange={(t) => {
            setTask(t);
            // Only fills a title the manager hasn't edited. Once touched, it's
            // theirs.
            if (!titleTouched) setTitle(t.label);
          }}
          loading={tasksLoading}
          emptyLabel="No tasks defined. Tasks are set up in the admin dashboard."
        />
        {formHint ? (
          <View style={styles.hint}>
            <Icon name={formRoute ? 'info' : 'edit-3'} size={16} color={formRoute ? 'info' : 'muted'} />
            <AppText variant="caption" color={formRoute ? 'info' : 'muted'}>
              {formHint}
            </AppText>
          </View>
        ) : null}
      </View>

      <TextField
        label="Title"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          setTitleTouched(true);
        }}
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          Where
        </AppText>
        <SegmentedToggle
          options={[
            { value: 'house', label: 'House' },
            { value: 'other', label: 'Other' },
          ]}
          value={location}
          onChange={switchLocation}
        />
      </View>

      {location === 'house' ? (
        <HousePicker value={house} onChange={setHouse} />
      ) : (
        <TextField
          label="Location"
          value={locationNote}
          onChangeText={setLocationNote}
          placeholder="Front gate, feed store…"
        />
      )}

      <View style={styles.group}>
        <AppText variant="eyebrow" color="muted">
          Due
        </AppText>
        <DueField value={dueAt} onChange={setDueAt} />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  taskBlock: { gap: Spacing.xs },
  hint: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  group: { gap: Spacing.sm },
});
