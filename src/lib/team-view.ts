import type { Employee, ScoreEntry, TaskAssignment } from './types';

export type MemberStat = {
  member: Employee;
  done: number;
  pending: number;
  total: number;
  /** Pending and already past their due time. */
  overdue: number;
  points: number;
};

export type TeamSummary = {
  /** Who needs a supervisor's eye first: most overdue, then most pending, then by name. */
  members: MemberStat[];
  /** People with at least one task today. */
  onShift: number;
  done: number;
  total: number;
  /** Overdue tasks across the whole team. */
  overdue: number;
};

/**
 * What a manager reads off the team: per person, today's tasks (done, still open, overdue) and this
 * month's points. `tasks` is everything due by the end of today (overdue included), `scores` is the
 * month so far. `exceptId` leaves the viewer out of their own team.
 */
export function summarizeTeam(
  employees: Employee[],
  tasks: TaskAssignment[],
  scores: Pick<ScoreEntry, 'employee_id' | 'points'>[],
  now: Date,
  exceptId?: string,
): TeamSummary {
  const nowMs = now.getTime();
  const members = employees
    .filter((e) => e.id !== exceptId)
    .map((member): MemberStat => {
      const theirs = tasks.filter((t) => t.employee_id === member.id && t.status !== 'CANCELLED');
      const done = theirs.filter((t) => t.status === 'DONE').length;
      const open = theirs.filter((t) => t.status === 'PENDING');
      return {
        member,
        done,
        pending: open.length,
        total: theirs.length,
        overdue: open.filter((t) => new Date(t.due_at).getTime() < nowMs).length,
        points: scores.filter((s) => s.employee_id === member.id).reduce((sum, s) => sum + s.points, 0),
      };
    })
    .sort(
      (a, b) =>
        b.overdue - a.overdue || b.pending - a.pending || a.member.profile.name.localeCompare(b.member.profile.name),
    );

  return {
    members,
    onShift: members.filter((m) => m.total > 0).length,
    done: members.reduce((sum, m) => sum + m.done, 0),
    total: members.reduce((sum, m) => sum + m.total, 0),
    overdue: members.reduce((sum, m) => sum + m.overdue, 0),
  };
}

/** The one line under a name: what is left for them today. */
export function taskStatusLine(s: Pick<MemberStat, 'pending' | 'overdue' | 'total'>): {
  text: string;
  tone: 'critical' | 'ink' | 'success' | 'muted';
} {
  if (s.overdue > 0) return { text: `${s.overdue} overdue`, tone: 'critical' };
  if (s.pending > 0) return { text: `${s.pending} left today`, tone: 'ink' };
  if (s.total > 0) return { text: 'All done', tone: 'success' };
  return { text: 'No tasks today', tone: 'muted' };
}

export type TeamFilter = 'ALL' | 'OVERDUE' | 'OPEN' | 'DONE';

const MATCH: Record<TeamFilter, (m: MemberStat) => boolean> = {
  ALL: () => true,
  OVERDUE: (m) => m.overdue > 0,
  OPEN: (m) => m.pending > 0,
  // Had tasks today and finished every one; someone with no tasks is neither open nor done.
  DONE: (m) => m.total > 0 && m.pending === 0,
};

export const filterTeam = (members: MemberStat[], filter: TeamFilter): MemberStat[] =>
  members.filter(MATCH[filter]);

/** How many people each filter chip would show. */
export const countByFilter = (members: MemberStat[]): Record<TeamFilter, number> => ({
  ALL: members.length,
  OVERDUE: filterTeam(members, 'OVERDUE').length,
  OPEN: filterTeam(members, 'OPEN').length,
  DONE: filterTeam(members, 'DONE').length,
});
