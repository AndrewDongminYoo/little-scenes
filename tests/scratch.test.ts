import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createScratch,
  scrape,
  FOIL,
  CELL_COUNT,
  MAX_FLAKES,
  revealScratch,
} from '../src/render/scratch.ts';
const area = (s: ReturnType<typeof createScratch>) => s.wear.reduce((a, b) => a + b, 0);
test('coin edge is directional, not a circular eraser', () => {
  const a = scrape(createScratch(), { x: 100, y: 350 }, { x: 240, y: 350 }, 0, 0, 7);
  const b = scrape(createScratch(), { x: 170, y: 300 }, { x: 170, y: 440 }, 0, 0, 7);
  assert.ok(area(b) > area(a) * 3, `${area(a)} vs ${area(b)}`);
});
test('wear is deterministic, cumulative and bounded; no scratch outside foil', () => {
  const blank = createScratch();
  assert.equal(scrape(blank, { x: 0, y: 0 }, { x: 30, y: 30 }, 0, 0, 7), blank);
  const p = { x: 100, y: 350 },
    q = { x: 250, y: 390 };
  const a = scrape(blank, p, q, 45, 10, 7);
  assert.deepEqual(a, scrape(blank, p, q, 45, 10, 7));
  const b = scrape(a, q, p, 45, 20, 7);
  assert.ok(area(b) > area(a));
  assert.equal(area(blank), 0);
  assert.equal(b.wear.length, CELL_COUNT);
  assert.ok(b.wear.every((v) => v >= 0 && v <= 1));
  assert.ok(
    b.wear.some((v) => v > 0 && v < 0.75),
    'ragged partially worn foil survives',
  );
  for (const f of b.flakes) assert.ok(f.x >= FOIL.x && f.x <= FOIL.x + FOIL.width);
});
test('long sessions cap debris and fully exposed cells do not emit more material', () => {
  let s = createScratch();
  for (let i = 0; i < 300; i++)
    s = scrape(s, { x: 45, y: 294 + (i % 144) }, { x: 315, y: 294 + (i % 144) }, 45, i * 20, 8);
  assert.ok(s.flakes.length > 0 && s.flakes.length <= MAX_FLAKES);
  const full = revealScratch();
  assert.equal(area(full), CELL_COUNT);
  assert.equal(scrape(full, { x: 50, y: 350 }, { x: 300, y: 350 }, 45, 100, 8).flakes.length, 0);
});

test('stationary, non-finite and far-away input never changes foil', () => {
  const s = createScratch();
  assert.equal(scrape(s, { x: 100, y: 330 }, { x: 100, y: 330 }, 45, 0, 1), s);
  assert.equal(scrape(s, { x: NaN, y: 330 }, { x: 200, y: 330 }, 45, 0, 1), s);
});

test('scratch exports detach nested wear and debris from live gesture state', async () => {
  const { defaults, freezeFrame } = await import('../src/domain/model.ts');
  const scratch = scrape(createScratch(), { x: 90, y: 320 }, { x: 260, y: 400 }, 45, 0, 4);
  const frozen = freezeFrame({
    ...defaults('scratch'),
    scratch,
    time: 0,
    reveal: 1,
    touch: { x: 0, y: 0, strength: 0 },
    trail: [],
  });
  const before = frozen.scratch!.wear[0];
  scratch.wear[0] = 0.5;
  assert.equal(frozen.scratch!.wear[0], before);
  if (scratch.flakes.length) {
    const x = frozen.scratch!.flakes[0].x;
    scratch.flakes[0].x = 0;
    assert.equal(frozen.scratch!.flakes[0].x, x);
  }
});
test('scratch settings preserve phrase and reject unsupported angles', async () => {
  const { decodeSettings } = await import('../src/domain/model.ts');
  assert.equal(
    decodeSettings('scratch', JSON.stringify({ scene: 'scratch', text: '내 문장', coinAngle: 90 }))
      .coinAngle,
    90,
  );
  const restored = decodeSettings(
    'scratch',
    JSON.stringify({ scene: 'scratch', text: '내 문장', coinAngle: NaN }),
  );
  assert.equal(restored.coinAngle, 45);
  assert.equal(restored.text, '내 문장');
});
