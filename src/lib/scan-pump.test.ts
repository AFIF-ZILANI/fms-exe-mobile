/**
 * The scan pump: concurrency, de-duplication and the capacity guard. Run: `bun src/lib/scan-pump.test.ts`.
 */
import assert from 'node:assert/strict';

import { createScanPump } from './scan-pump';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- runs up to `limit` at once, never more -----------------------------------
{
  let running = 0;
  let peak = 0;
  const pump = createScanPump({
    limit: 4,
    run: async () => {
      running++;
      peak = Math.max(peak, running);
      await sleep(20);
      running--;
      return true;
    },
  });
  for (let i = 0; i < 10; i++) pump.push(`code-${i}`);
  assert.equal(pump.busy(), 10, 'nothing read meanwhile is dropped');
  await pump.idle();
  assert.equal(peak, 4, 'never more than the limit in flight');
  assert.equal(pump.busy(), 0);
}

// --- limit 1 is the old strict one-at-a-time --------------------------------------
{
  let running = 0;
  let peak = 0;
  const pump = createScanPump({
    limit: 1,
    run: async () => {
      running++;
      peak = Math.max(peak, running);
      await sleep(5);
      running--;
      return true;
    },
  });
  ['a', 'b', 'c'].forEach((id) => pump.push(id));
  await pump.idle();
  assert.equal(peak, 1);
}

// --- a code already queued or running isn't queued twice -----------------------------
{
  const seen: string[] = [];
  const pump = createScanPump({
    limit: 2,
    run: async (id) => {
      seen.push(id);
      await sleep(10);
      return true;
    },
  });
  assert.equal(pump.push('a'), true);
  assert.equal(pump.push('a'), false, 'running');
  assert.equal(pump.push('b'), true);
  assert.equal(pump.push('c'), true);
  assert.equal(pump.push('c'), false, 'queued');
  await pump.idle();
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.equal(pump.push('a'), true, 'once finished it can be pushed again (the scanner decides duplicates)');
  await pump.idle();
}

// --- capacity: never starts more than `remaining`, even while the server figure lags -------
{
  const started: string[] = [];
  const pump = createScanPump({
    limit: 4,
    run: async (id) => {
      started.push(id);
      await sleep(10);
      return true;
    },
  });
  pump.setRemaining(3);
  for (let i = 0; i < 8; i++) pump.push(`code-${i}`);
  await pump.idle();
  assert.equal(started.length, 3, 'exactly the 3 that fit, though the server figure never refreshed');
  assert.equal(pump.room(), 0);
  assert.equal(pump.busy(), 0, 'the extras are dropped, not left hanging');
}

// --- a failure gives its slot back, so the next code takes it --------------------------
{
  const started: string[] = [];
  const pump = createScanPump({
    limit: 4,
    run: async (id) => {
      started.push(id);
      await sleep(10);
      return id !== 'bad';
    },
  });
  pump.setRemaining(2);
  ['bad', 'ok-1', 'ok-2', 'ok-3'].forEach((id) => pump.push(id));
  await pump.idle();
  assert.deepEqual(started, ['bad', 'ok-1', 'ok-2'], 'the failed one freed a slot for ok-2; ok-3 never fit');
}

// --- a thrown error also gives its slot back --------------------------------------------
{
  const pump = createScanPump({
    limit: 1,
    run: async (id) => {
      if (id === 'boom') throw new Error('network');
      return true;
    },
  });
  pump.setRemaining(1);
  pump.push('boom');
  pump.push('next');
  await pump.idle();
  assert.equal(pump.room(), 0, 'next took the slot boom gave back');
}

// --- the server catching up releases claimed slots, without double counting --------------
{
  const pump = createScanPump({ limit: 4, run: async () => true });
  pump.setRemaining(5);
  ['a', 'b'].forEach((id) => pump.push(id));
  await pump.idle();
  assert.equal(pump.room(), 3, '5 - 2 claimed');
  pump.setRemaining(3); // the refetch now counts a and b
  assert.equal(pump.room(), 3, 'still 3: the two moved from claimed into the server figure');
  pump.setRemaining(3);
  assert.equal(pump.room(), 3, 'an unchanged figure changes nothing');
}

// --- clear drops what hasn't started; idle resolves -----------------------------------------
{
  const started: string[] = [];
  const pump = createScanPump({
    limit: 1,
    run: async (id) => {
      started.push(id);
      await sleep(10);
      return true;
    },
  });
  ['a', 'b', 'c'].forEach((id) => pump.push(id));
  pump.clear();
  await pump.idle();
  assert.deepEqual(started, ['a'], 'only the running one finished');
}

console.log('scan-pump.ts checks passed');
