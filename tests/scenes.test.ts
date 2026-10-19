import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_STITCHES, orderStrokes, planEmbroidery } from '../src/render/embroidery.ts';
import {
  condensation,
  RAIN_DIRECTION,
  runningDrops,
  runningHead,
  wipeEdges,
} from '../src/render/rain.ts';
import type { Stroke } from '../src/render/strokes.ts';

const line = (x0: number, y0: number, x1: number, y1: number, n = 20): Stroke => ({
  closed: false,
  points: Array.from({ length: n + 1 }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / n,
    y: y0 + ((y1 - y0) * i) / n,
  })),
});
const ring = (cx: number, cy: number, r: number): Stroke => ({
  closed: true,
  points: Array.from({ length: 32 }, (_, i) => ({
    x: cx + Math.cos((i / 32) * 6.283) * r,
    y: cy + Math.sin((i / 32) * 6.283) * r,
  })),
});
const input = (strokes: Stroke[], seed = 3) => ({
  strokes,
  fontSize: 60,
  writing: 'vertical' as const,
  palette: 'meadow' as const,
  fine: true,
  seed,
  glyphs: 4,
});

test('letters are built from stitches laid along their strokes, reproducibly', () => {
  const strokes = [line(100, 100, 160, 100), line(130, 80, 130, 150)];
  const a = planEmbroidery(input(strokes));
  assert.deepEqual(a, planEmbroidery(input(strokes)));
  assert.notDeepEqual(a.items, planEmbroidery(input(strokes, 4)).items);
  const threads = a.items.filter((p) => p.kind !== 'leaf' && p.kind !== 'petal' && p.size < 12);
  assert.ok(threads.length > 30, `stitches ${threads.length}`);
  const onStroke = threads.filter(
    (p) =>
      (Math.abs(p.y - 100) < 1 && p.x >= 99 && p.x <= 161) ||
      (Math.abs(p.x - 130) < 1 && p.y >= 79 && p.y <= 151),
  );
  assert.ok(onStroke.length >= 30);
  assert.ok(a.reveal.length >= 2);
});

test('stitch count is capped for long phrases', () => {
  const many = Array.from({ length: 400 }, (_, i) => line(10, i, 350, i, 200));
  assert.ok(planEmbroidery({ ...input(many), fontSize: 80 }).items.length <= MAX_STITCHES);
});

test('a small loop may bloom into a flower in its place', () => {
  let bloomed = 0;
  for (let seed = 0; seed < 20; seed++) {
    const plan = planEmbroidery(input([ring(180, 300, 10)], seed));
    const onRing = plan.items.filter(
      (p) => p.kind !== 'leaf' && Math.abs(Math.hypot(p.x - 180, p.y - 300) - 10) < 0.5,
    );
    if (onRing.length < 5) {
      bloomed++;
      assert.ok(plan.items.length > 5, 'a bloom replaces the loop with a flower');
    }
  }
  assert.ok(bloomed > 5 && bloomed < 20, `bloomed ${bloomed}`);
});

test('vertical writing is sewn right column first, top to bottom', () => {
  const ordered = orderStrokes(
    [line(100, 200, 100, 260), line(200, 300, 200, 360), line(200, 100, 200, 160)],
    'vertical',
    60,
  );
  assert.deepEqual(
    ordered.map((s) => [s.points[0].x, s.points[0].y]),
    [
      [200, 100],
      [200, 300],
      [100, 200],
    ],
  );
  const flipped = orderStrokes([line(160, 100, 100, 100)], 'horizontal', 60);
  assert.equal(flipped[0].points[0].x, 100);
});

test('condensation is seeded and grows with rain intensity', () => {
  assert.deepEqual(condensation(5, 2), condensation(5, 2));
  assert.ok(condensation(5, 3).length > condensation(5, 1).length);
});

test('running drops flow downward by default and stay deterministic', () => {
  assert.equal(RAIN_DIRECTION, 1);
  const params = runningDrops(7, 2);
  assert.equal(params.length, 8 * 6);
  const a = runningHead(params, 0, 1000),
    b = runningHead(params, 0, 1100);
  if (b.travel > a.travel) assert.ok(b.y > a.y);
  assert.deepEqual(runningHead(params, 3, 4321), runningHead(params, 3, 4321));
});

test('beads sit outside the wiped stroke and drips run down from it', () => {
  const { beads, drips } = wipeEdges([line(100, 300, 200, 300, 50)], 8, 2);
  assert.ok(beads.length > 10);
  for (const b of beads) assert.ok(Math.abs(b.y - 300) >= 4 - 1e-6 || b.x < 100 || b.x > 200);
  for (const d of drips) {
    assert.ok(d.points[0].y > 300);
    assert.ok(d.points[d.points.length - 1].y > d.points[0].y);
  }
});
