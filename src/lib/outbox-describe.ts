import type { OutboxRow } from './outbox';

export type DescribedRow = { title: string; detail: string | null };

type Body = Record<string, unknown>;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

type Rule = { match: RegExp; title: string; detail?: (b: Body) => string | null };

/** Every write the app queues, in the words a worker uses. Order does not matter: patterns are anchored. */
const RULES: Rule[] = [
  { match: /^\/mortality-logs$/, title: 'Mortality', detail: (b) => (count(b.count_died) !== null ? `${b.count_died} died` : null) },
  {
    match: /^\/consumptions$/,
    title: 'Feed or item use',
    detail: (b) => {
      const q = count(b.quantity);
      if (q === null) return null;
      const unit = text(b.unit);
      return unit ? `${q} ${unit.toLowerCase()}` : String(q);
    },
  },
  { match: /^\/weight-records$/, title: 'Weight sample' },
  { match: /^\/environment-records$/, title: 'Environment readings' },
  { match: /^\/medications$/, title: 'Medication', detail: (b) => text(b.medicine_name) },
  { match: /^\/vaccinations$/, title: 'Vaccination', detail: (b) => text(b.vaccine_name) },
  { match: /^\/task-assignments\/[^/]+\/complete$/, title: 'Task marked done' },
  { match: /^\/task-assignments\/[^/]+\/cancel$/, title: 'Task cancelled' },
  { match: /^\/task-assignments$/, title: 'Task assigned', detail: (b) => text(b.title) },
  { match: /^\/batch-house-allocations$/, title: 'Birds moved', detail: (b) => (count(b.quantity) !== null ? `${b.quantity} birds` : null) },
  { match: /^\/performance-score-entries$/, title: 'Points given' },
  { match: /^\/inventory-adjustments$/, title: 'Stock discrepancy' },
  { match: /^\/alerts$/, title: 'Low-stock flag' },
  { match: /^\/batch-feeding-programs$/, title: 'Feeding plan phase' },
  { match: /^\/stock-units\/[^/]+\/bind$/, title: 'Item linked' },
];

function parseBody(raw: string): Body {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Body) : {};
  } catch {
    return {};
  }
}

/** A queued write in plain words. Never throws: an unknown endpoint is "A record", a bad body just has no detail. */
export function describeOutboxRow(row: Pick<OutboxRow, 'endpoint' | 'body'>): DescribedRow {
  const rule = RULES.find((r) => r.match.test(row.endpoint));
  if (!rule) return { title: 'A record', detail: null };
  return { title: rule.title, detail: rule.detail ? rule.detail(parseBody(row.body)) : null };
}

/** Why the server refused a record, said plainly. The server's own sentence is kept when it is already readable. */
export function plainReason(lastError: string | null | undefined): string {
  const e = lastError?.trim();
  if (!e) return 'The server refused this record.';
  if (/not a valid unit for using this item/i.test(e)) {
    return "This item can't be used by that unit yet. Ask a manager to set it up.";
  }
  if (/idempotency/i.test(e)) return 'Already recorded.';
  const clean = e.replace(/^error:\s*/i, '');
  return clean.length > 160 ? `${clean.slice(0, 159)}…` : clean;
}
