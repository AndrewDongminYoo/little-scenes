import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitsDecoration } from '../src/render/decorations.ts';
import { planEmbroidery } from '../src/render/embroidery.ts';
import type { Stroke } from '../src/render/strokes.ts';
const line: Stroke = {
  closed: false,
  points: [
    { x: 50, y: 100 },
    { x: 300, y: 100 },
  ],
};
test('flowers avoid segments between samples, other flowers, and artwork edges', () => {
  assert.equal(fitsDecoration({ x: 175, y: 104, radius: 8 }, [line], [], 2), false);
  assert.equal(fitsDecoration({ x: 175, y: 120, radius: 8 }, [line], [], 2), true);
  assert.equal(
    fitsDecoration({ x: 175, y: 120, radius: 8 }, [], [{ x: 190, y: 120, radius: 8 }], 2),
    false,
  );
  assert.equal(fitsDecoration({ x: 30, y: 120, radius: 8 }, [], [], 2), false);
});
test('a loop replacement can ignore its own stroke, but not its neighbour', () => {
  const c = { x: 175, y: 104, radius: 8 };
  assert.equal(fitsDecoration(c, [line], [], 2, 0), true);
  assert.equal(fitsDecoration(c, [line, { ...line }], [], 2, 0), false);
});
test('planned floral sites remain separated and do not cover neighbouring strokes', () => {
  const strokes: Stroke[] = Array.from({ length: 10 }, (_, i) => ({
    closed: false,
    points: [
      { x: 70 + i * 20, y: 200 },
      { x: 70 + i * 20, y: 260 },
    ],
  }));
  for (let seed = 0; seed < 15; seed++) {
    const plan = planEmbroidery({
      strokes,
      fontSize: 50,
      writing: 'horizontal',
      palette: 'meadow',
      fine: true,
      seed,
      glyphs: 10,
    });
    plan.decorations.forEach((c, i) =>
      assert.ok(fitsDecoration(c, strokes, plan.decorations.slice(0, i), 0, c.ignoreStroke)),
    );
  }
});
