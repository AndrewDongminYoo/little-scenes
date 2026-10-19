import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceClocks,
  decodeSettings,
  defaults,
  trailAlpha,
  TRAIL_FADE_MS,
} from '../src/domain/model.ts';
import { verticalGlyphs } from '../src/render/text-layout.ts';
import { PALETTES } from '../src/render/embroidery.ts';

test('touch restoration advances while rain is paused, without advancing rain', () => {
  const next = advanceClocks(1600, 100, TRAIL_FADE_MS, false, true, 'rain');
  assert.equal(next.time, 1600);
  assert.equal(trailAlpha(next.interactionTime, 100), 0);
  assert.deepEqual(advanceClocks(1600, 100, 50, false, false, 'rain'), {
    time: 1600,
    interactionTime: 100,
  });
});
test('vertical punctuation shares the preceding cell instead of consuming a row', () => {
  assert.deepEqual(verticalGlyphs('오늘도,'), ['오', '늘', '도,']);
  assert.deepEqual(verticalGlyphs('좋아!?'), ['좋', '아!?']);
  assert.deepEqual(verticalGlyphs(',안녕'), [',', '안', '녕']);
});
test('dancheong is available without breaking existing red palette records', () => {
  assert.ok(PALETTES.dancheong.accents.length >= 3);
  assert.equal(
    decodeSettings('embroidery', JSON.stringify({ ...defaults('embroidery'), thread: 'dancheong' }))
      .thread,
    'dancheong',
  );
  assert.equal(
    decodeSettings('embroidery', JSON.stringify({ ...defaults('embroidery'), thread: 'red' }))
      .thread,
    'red',
  );
});
