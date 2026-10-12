/** Run: `bun src/lib/scan-area.test.ts`. */

import assert from 'node:assert/strict';

import { codeCentre, inFrame } from './scan-area';

const view = { width: 400, height: 600 }; // square spans x 90..310, y 190..410

const square = (cx: number, cy: number, half = 30) => ({
  cornerPoints: [
    { x: cx - half, y: cy - half },
    { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half },
    { x: cx - half, y: cy + half },
  ],
});

assert.deepEqual(codeCentre(square(200, 300)), { x: 200, y: 300 });
assert.equal(inFrame(square(200, 300), view), true); // dead centre
assert.equal(inFrame(square(300, 400), view), true); // inside, near the corner
assert.equal(inFrame(square(50, 300), view), false); // left of the square
assert.equal(inFrame(square(200, 100), view), false); // above it
assert.equal(inFrame(square(200, 520), view), false); // below it

// no corner points: falls back to bounds
assert.equal(inFrame({ bounds: { origin: { x: 170, y: 270 }, size: { width: 60, height: 60 } } }, view), true);
assert.equal(inFrame({ bounds: { origin: { x: 0, y: 0 }, size: { width: 60, height: 60 } } }, view), false);

// nothing to judge by, or view not measured: let it through rather than go dead
assert.equal(inFrame({}, view), true);
assert.equal(inFrame({ bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } }, view), true);
assert.equal(inFrame(square(50, 50), { width: 0, height: 0 }), true);
assert.equal(inFrame({ cornerPoints: [{ x: NaN, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }, view), true);

console.log('scan-area ok');
