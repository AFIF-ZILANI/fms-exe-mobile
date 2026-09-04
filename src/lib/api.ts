import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

/**
 * Set EXPO_PUBLIC_API_BASE_URL in .env for a physical device — localhost
 * doesn't resolve from a phone. See README.md.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5085/api';

export type ListMeta = { page: number; limit: number; total: number; totalPages: number };
export type Paginated<T> = { results: T[] } & ListMeta;

type Envelope<T> = { success: true; message: string; data: T; meta?: ListMeta };

type Problem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  extensions?: { fields?: Record<string, string> };
};

/**
 * A non-2xx response, carrying the RFC 7807 problem the server sent
 * (server/docs/api.md §1.2). `extensions.fields` only appears on 400s from
 * Zod validation — a flat field→message map. Ported from web/src/lib/api.ts
 * (separate repo, so a re-write, not a shared module).
 */
export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, body: unknown) {
    const problem = toProblem(status, body);
    super(problem.detail);
    this.name = 'ApiError';
    this.status = status;
    this.fields = problem.extensions?.fields;
  }

  /** True when this 409 is the offline-replay case — the write already landed
   *  on an earlier attempt. See docs/offline-sync.md §4.1. */
  isReplayConflict(): boolean {
    return this.status === 409 && this.message.toLowerCase().includes('idempotency_key');
  }

  fieldError(field: string): string | undefined {
    return this.fields?.[field];
  }
}

function toProblem(status: number, body: unknown): Problem {
  if (body && typeof body === 'object' && 'detail' in body) {
    return body as Problem;
  }
  return {
    type: 'about:blank',
    title: `Request failed with ${status}`,
    status,
    detail: typeof body === 'string' && body ? body : `Request failed with status ${status}`,
  };
}

/** Strip the success envelope so callers never see it. A paginated list
 *  (`data` is an array with `meta` present) folds meta onto it as one object. */
function unwrap<T>(raw: Envelope<unknown>): T {
  const { data, meta } = raw;
  if (meta && Array.isArray(data)) {
    return { results: data, ...meta } as T;
  }
  return data as T;
}

export async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    // Network failure (no signal, server down) -- every caller relies on the
    // ApiError shape, so this has to look like one rather than a bare throw.
    throw new ApiError(0, 'Could not reach the server.');
  }

  if (res.status === 429) {
    throw new ApiError(429, await res.text().catch(() => 'Too many requests'));
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return unwrap<T>(body as Envelope<unknown>);
}

type QueryOpts<T> = Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>;

/**
 * GET only. There is no usePostData/usePatchData here, unlike web's api.ts --
 * every mobile write goes through useQueuedSubmit() (lib/use-queued-submit.ts)
 * so it queues offline-first instead of hitting the network directly. See
 * docs/offline-sync.md.
 */
export function useGetData<T>(endpoint: string, key: unknown[], options?: QueryOpts<T>) {
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: () => apiFetch<T>(endpoint),
    ...options,
  });
}
