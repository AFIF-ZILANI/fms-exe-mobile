import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/lib/outbox';
import { triggerFlush } from '@/lib/use-outbox';

export type QueuedSubmitInput = {
  endpoint: string;
  body: Record<string, unknown>;
  /** Set when the form was opened from a task (docs/PRD.md §6.6) -- queues the
   *  completion alongside the write itself so a task launched offline still
   *  marks itself done once it syncs. */
  taskId?: string;
};

/**
 * The one write path every form in the app calls -- see docs/offline-sync.md
 * §5. Enqueues (durable, instant) and kicks off a flush in the background;
 * never awaits the network, so a form never blocks on connectivity.
 *
 * Returns true when the write is safely queued. A false return means it is
 * NOT saved anywhere and the caller must keep the form open -- the one
 * outcome this app can't afford to swallow is a worker believing a record
 * landed when it didn't.
 *
 * Client-side validation (a blank required reason, etc.) is the caller's job,
 * before calling submit() -- this hook trusts the body it's given.
 */
export function useQueuedSubmit() {
  const queryClient = useQueryClient();

  return async function submit({ endpoint, body, taskId }: QueuedSubmitInput): Promise<boolean> {
    try {
      await enqueue({ endpoint, body });
      if (taskId) {
        await enqueue({ endpoint: `/task-assignments/${taskId}/complete`, body: {} });
      }
    } catch (err) {
      Alert.alert(
        'Not saved',
        `This couldn't be stored on your phone, so it hasn't been recorded. ${
          err instanceof Error ? err.message : ''
        }`.trim(),
      );
      return false;
    }

    void triggerFlush(queryClient);
    return true;
  };
}
