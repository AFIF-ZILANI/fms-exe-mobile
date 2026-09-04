/**
 * Maps a TaskType.code to the screen it opens -- the app's half of the
 * soft-coded contract described in docs/PRD.md §8. A code that isn't a key
 * here (older app build, newer server) falls back to the plain mark-done
 * sheet on the task detail screen -- never a crash, never a blank screen.
 *
 * Adding a screen later is one screen file + one line here + one
 * admin-created TaskType row. No migration, no server deploy.
 */
export const TASK_FORMS = {
  MORTALITY: '/log/mortality',
  CONSUMPTION: '/log/consumption',
  WEIGHT: '/log/weight',
  ENVIRONMENT: '/log/environment',
  MEDICATION: '/log/treatment?type=medication',
  VACCINATION: '/log/treatment?type=vaccination',
} as const;

export function routeForTaskType(code: string | null | undefined): string | null {
  if (!code) return null;
  return (TASK_FORMS as Record<string, string>)[code] ?? null;
}
