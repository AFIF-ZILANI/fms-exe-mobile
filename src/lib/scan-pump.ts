/**
 * Runs scanned codes against the server several at a time instead of one by one.
 *
 * Each code is a lookup plus a write -- two round trips. Done strictly one after another, a fast
 * operator outruns the network and every code read meanwhile is thrown away, so the scanner feels
 * like it is lagging. Here codes queue up and up to `limit` run at once.
 *
 * `remaining` (how many more the target takes) comes from the server and lags behind our own writes
 * until a refetch lands, so the pump counts what it has claimed itself: a code takes a slot when it
 * starts, gives it back if it doesn't count (a failure, a rejection), and slots are released as the
 * server's figure catches up. That keeps the last code of a lot from being followed by extras the
 * server would refuse. Pure -- no React, no camera -- so it runs in tests and the scan simulator.
 */

export type PumpOptions = {
  /** How many codes may be with the server at once (read as each code starts). 1 = one at a time. */
  limit: number | (() => number);
  /** Handles one code end to end. Resolves true when it used up a slot of `remaining` (a success). */
  run: (id: string) => Promise<boolean>;
};

export type ScanPump = {
  /** Queues a code. False if it is already queued or running. */
  push: (id: string) => boolean;
  /** The server's latest "how many more" figure; null = no limit. */
  setRemaining: (next: number | null) => void;
  /** Codes queued or running. */
  busy: () => number;
  /** What's left once queued and running codes are counted; null = no limit. */
  room: () => number | null;
  /** Drops queued codes that haven't started (the session was reset or closed). */
  clear: () => void;
  /** Resolves once nothing is queued or running. */
  idle: () => Promise<void>;
};

export function createScanPump({ limit, run }: PumpOptions): ScanPump {
  let active = 0;
  const queue: string[] = [];
  const known = new Set<string>();
  // Slots taken by codes running or succeeded that `remaining` doesn't reflect yet.
  let claimed = 0;
  let remaining: number | null = null;
  let waiters: (() => void)[] = [];
  const max = () => (typeof limit === 'function' ? limit() : limit);

  const free = () => (remaining === null ? Infinity : remaining - claimed);

  const settleIdle = () => {
    if (active > 0 || queue.length > 0) return;
    const w = waiters;
    waiters = [];
    w.forEach((resolve) => resolve());
  };

  const drain = () => {
    while (active < max() && queue.length > 0 && free() > 0) {
      const id = queue.shift()!;
      active++;
      claimed++;
      run(id)
        .then(
          (counted) => {
            if (!counted) claimed--;
          },
          () => {
            claimed--;
          },
        )
        .finally(() => {
          active--;
          known.delete(id);
          drain();
          settleIdle();
        });
    }
    // Full: whatever is still queued will never fit, so it's dropped rather than left hanging.
    if (remaining !== null && free() <= 0 && active === 0 && queue.length > 0) {
      queue.splice(0).forEach((id) => known.delete(id));
    }
    settleIdle();
  };

  return {
    push: (id) => {
      if (known.has(id)) return false;
      known.add(id);
      queue.push(id);
      drain();
      return true;
    },
    setRemaining: (next) => {
      // The server's figure fell: that many of our writes have landed and are now counted there.
      if (remaining !== null && next !== null && next < remaining) {
        claimed = Math.max(0, claimed - (remaining - next));
      }
      remaining = next;
      drain();
    },
    busy: () => active + queue.length,
    room: () => (remaining === null ? null : Math.max(0, remaining - claimed)),
    clear: () => {
      queue.splice(0).forEach((id) => known.delete(id));
      settleIdle();
    },
    idle: () => (active === 0 && queue.length === 0 ? Promise.resolve() : new Promise((r) => waiters.push(r))),
  };
}
