import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateText,
  defaults,
  random,
  freezeFrame,
  decodeSettings,
  nextClock,
  fitRect,
  toLogicalPoint,
  pushTrail,
  trailAlpha,
  TRAIL_POINTS,
  TRAIL_FADE_MS,
} from '../src/domain/model.ts';
test('text validates on apply, with graphemes and explicit rejection', () => {
  assert.equal(validateText('한'.repeat(40)).ok, true);
  assert.equal(validateText('한'.repeat(41)).ok, false);
  assert.equal(validateText('가\n나\n다').ok, true);
  assert.equal(validateText('가\n나\n다\n라').ok, false);
  assert.equal(validateText('   ').ok, false);
  assert.equal(validateText('안녕🌈').ok, false);
  assert.equal(validateText('한 Hello, 123!').ok, true);
});
test('seed and frozen nested state are reproducible and isolated', () => {
  const a = random(12),
    b = random(12),
    c = random(13);
  assert.deepEqual(Array.from({ length: 10 }, a), Array.from({ length: 10 }, b));
  assert.notEqual(random(12)(), c());
  const source = {
    ...defaults('rain'),
    time: 2,
    reveal: 1,
    touch: { x: 10, y: 20, strength: 1 },
    trail: [1, 2, 3],
  };
  const copy = freezeFrame(source);
  source.touch.x = 40;
  source.trail.push(4);
  assert.equal(copy.touch.x, 10);
  assert.equal(copy.trail.length, 3);
});
test('stored empty text stays empty, corrupt config safely defaults', () => {
  assert.equal(decodeSettings('rain', JSON.stringify({ ...defaults('rain'), text: '' })).text, '');
  assert.deepEqual(decodeSettings('rain', 'broken'), defaults('rain'));
  assert.deepEqual(
    decodeSettings('rain', JSON.stringify({ scene: 'rain', intensity: 999 })),
    defaults('rain'),
  );
  assert.deepEqual(
    decodeSettings('embroidery', JSON.stringify({ ...defaults('rain'), text: '남의 설정' })),
    defaults('embroidery'),
  );
});
test('an outdated field falls back alone and keeps the saved phrase', () => {
  const old = decodeSettings(
    'embroidery',
    JSON.stringify({
      scene: 'embroidery',
      text: '내 문구',
      seed: 9,
      thread: 'olive',
      density: 'normal',
    }),
  );
  assert.equal(old.text, '내 문구');
  assert.equal(old.seed, 9);
  assert.equal(old.density, 'normal');
  assert.equal(old.thread, 'meadow');
  assert.equal(old.writing, 'vertical');
});
test('finger trail is bounded, skips jitter, and fades with the scene clock', () => {
  let trail: number[] = [];
  for (let i = 0; i < 100; i++) trail = pushTrail(trail, i * 10, 0, i * 16);
  assert.equal(trail.length, TRAIL_POINTS * 3);
  assert.equal(trail[trail.length - 3], 990);
  assert.equal(pushTrail(trail, 991, 0, 1585).length, trail.length);
  assert.equal(pushTrail(trail, 991, 0, 1585), trail);
  assert.equal(trailAlpha(1000, 1000), 1);
  assert.ok(trailAlpha(2600, 1000) > 0 && trailAlpha(2600, 1000) < 1);
  assert.equal(trailAlpha(1000 + TRAIL_FADE_MS, 1000), 0);
  // After a clock reset, old points are in the future and must not show.
  assert.equal(trailAlpha(0, 1000), 0);
});
test('supported punctuation includes common Korean phrase marks', () => {
  assert.equal(validateText('고마워~ 50% 좋아/싫어').ok, true);
});
test('clock freezes offscreen and clamps embroidery, rain keeps running', () => {
  assert.equal(nextClock(500, 100, false, 'rain'), 500);
  assert.equal(nextClock(1590, 20, true, 'embroidery'), 1600);
  assert.equal(nextClock(500, 16, true, 'rain'), 516);
});
test('letterbox never crops, touch rejects margins', () => {
  const r = fitRect(400, 400);
  assert.equal(r.height, 400);
  assert.equal(r.width, 225);
  assert.equal(toLogicalPoint({ x: 0, y: 0 }, r), null);
  assert.deepEqual(toLogicalPoint({ x: r.x + r.width / 2, y: 200 }, r), {
    x: 180,
    y: 320,
  });
});
