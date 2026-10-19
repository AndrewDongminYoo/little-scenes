import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStrokes, resample, thin, trace } from '../src/render/strokes.ts';
import { wrapColumns } from '../src/render/text-layout.ts';

const canvas = (w: number, h: number, ink: (x: number, y: number) => boolean) => {
  const a = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (ink(x, y)) a[y * w + x] = 255;
  return a;
};

test('a thick bar thins to one open centreline stroke', () => {
  const w = 80,
    h = 30;
  const alpha = canvas(w, h, (x, y) => x >= 10 && x < 70 && y >= 10 && y < 20);
  const { strokes, inkWidth } = extractStrokes(alpha, w, h, 2);
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].closed, false);
  for (const p of strokes[0].points) assert.ok(Math.abs(p.y - 7.25) < 1.5, `centre y ${p.y}`);
  assert.ok(inkWidth > 3 && inkWidth < 7, `ink width ${inkWidth}`);
});

test('a ring traces as one closed loop and the skeleton is one pixel wide', () => {
  const w = 60,
    h = 60;
  const alpha = canvas(w, h, (x, y) => {
    const d = Math.hypot(x - 30, y - 30);
    return d > 14 && d < 20;
  });
  const bin = alpha.map((v) => (v ? 1 : 0));
  const sk = thin(bin, w, h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (sk[y * w + x])
        assert.ok(
          !(sk[y * w + x + 1] && sk[(y + 1) * w + x] && sk[(y + 1) * w + x + 1]),
          'no 2×2 blocks',
        );
  const strokes = trace(sk, w, h);
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].closed, true);
});

test('a cross keeps four arms through its junction', () => {
  const w = 70,
    h = 70;
  const alpha = canvas(
    w,
    h,
    (x, y) =>
      (Math.abs(x - 35) < 4 && y > 8 && y < 62) || (Math.abs(y - 35) < 4 && x > 8 && x < 62),
  );
  const { strokes } = extractStrokes(alpha, w, h, 1);
  assert.ok(strokes.length >= 4 && strokes.length <= 6, `strokes ${strokes.length}`);
  const total = strokes.reduce((n, s) => n + s.points.length, 0);
  assert.ok(total > 80, `coverage ${total}`);
});

test('resampling is evenly spaced and follows the tangent', () => {
  const pts = resample(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
    2,
  );
  assert.equal(pts.length, 11);
  assert.equal(pts[0].angle, 0);
  assert.ok(Math.abs(pts[10].angle - Math.PI / 2) < 1e-9);
});

test('vertical columns break between words, splitting only overlong words', () => {
  const words = (s: string) => s.split(' ').map((w) => [...w]);
  assert.deepEqual(wrapColumns(words('오늘도, 천천히'), 6), [[...'오늘도,'], [...'천천히']]);
  assert.deepEqual(wrapColumns(words('가 나'), 6), [['가', ' ', '나']]);
  assert.deepEqual(wrapColumns(words('가나다라마바사'), 3), [[...'가나다'], [...'라마바'], ['사']]);
});
