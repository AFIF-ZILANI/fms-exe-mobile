/**
 * Mirrors server/src/lib/performance-criteria.ts's FIXED_CRITERION_POINTS --
 * display-only. The server is the source of truth and recomputes `points`
 * from `criterion` on write; this just lets the chip show its value before
 * the request round-trips. OTHER is the only criterion whose points are
 * client-supplied (±1..±5, non-zero) -- see docs/PRD.md §6.14.
 */
export const POSITIVE_CRITERIA = [
  { value: 'ATTENDANCE_PERFECT', label: 'Attendance perfect', points: 3 },
  { value: 'EARLY_PROBLEM_REPORT', label: 'Early problem report', points: 3 },
  { value: 'SUGGESTION_IMPLEMENTED', label: 'Suggestion implemented', points: 3 },
  { value: 'ZERO_NEGLIGENT_LOSS', label: 'Zero negligent loss', points: 2 },
  { value: 'ACCURATE_DATA_ENTRY', label: 'Accurate data entry', points: 2 },
  { value: 'BIOSECURITY_FOLLOWED', label: 'Biosecurity followed', points: 2 },
  { value: 'HELPED_COWORKER', label: 'Helped coworker', points: 2 },
  { value: 'EXTRA_TASK_COMPLETED', label: 'Extra task completed', points: 2 },
  { value: 'TEAM_TARGET_HIT', label: 'Team target hit', points: 3 },
  { value: 'CONFLICT_RESOLVED', label: 'Conflict resolved', points: 2 },
] as const;

export const NEGATIVE_CRITERIA = [
  { value: 'FALSIFIED_RECORD', label: 'Falsified record', points: -5 },
  { value: 'NEGLIGENT_LOSS', label: 'Negligent loss', points: -5 },
  { value: 'BIOSECURITY_VIOLATION', label: 'Biosecurity violation', points: -4 },
  { value: 'CONCEALED_PROBLEM', label: 'Concealed problem', points: -4 },
  { value: 'MISSED_CRITICAL_TASK', label: 'Missed critical task', points: -3 },
  { value: 'EQUIPMENT_DAMAGE', label: 'Equipment damage', points: -3 },
  { value: 'CONDUCT_ISSUE', label: 'Conduct issue', points: -3 },
  { value: 'TEAM_SUPERVISION_FAILURE', label: 'Team supervision failure', points: -3 },
  { value: 'UNEXCUSED_ABSENCE', label: 'Unexcused absence', points: -2 },
  { value: 'PATTERN_LATENESS', label: 'Pattern lateness', points: -2 },
] as const;

export type FixedCriterion = (typeof POSITIVE_CRITERIA)[number]['value'] | (typeof NEGATIVE_CRITERIA)[number]['value'];
export type Criterion = FixedCriterion | 'OTHER';

const ALL_FIXED = [...POSITIVE_CRITERIA, ...NEGATIVE_CRITERIA];

export function pointsFor(criterion: Criterion, otherPoints?: number): number {
  if (criterion === 'OTHER') return otherPoints ?? 0;
  return ALL_FIXED.find((c) => c.value === criterion)?.points ?? 0;
}

/** The server refuses an entry of this many points or worse unless a written-notice document comes with it
 *  (server/src/services/performance-score-entry.service.ts), and the phone has no way to attach one. */
export const NOTICE_REQUIRED_AT = -4;

/** True when giving these points needs paperwork the phone cannot supply: it would be refused and sit in the
 *  Sync center as a failed record. OTHER is likewise refused without an admin's approval. */
export const needsAdminPaperwork = (criterion: Criterion, points: number): boolean =>
  criterion === 'OTHER' || points <= NOTICE_REQUIRED_AT;
