import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGeneration,
  createSerialWriter,
  createShareGate,
} from '../src/domain/transactions.ts';
test('late results cannot replace newer edits', () => {
  const g = createGeneration();
  const a = g.next(),
    b = g.next();
  assert.equal(g.current(a), false);
  assert.equal(g.current(b), true);
  g.next();
  assert.equal(g.current(b), false);
});
test('writes serialize even after a failed write', async () => {
  const events: string[] = [];
  const writer = createSerialWriter(async (s: string) => {
    if (s === 'bad') {
      await new Promise((r) => setTimeout(r, 10));
      events.push(s);
      throw Error('write');
    }
    events.push(s);
  });
  await Promise.all([writer('bad').catch(() => {}), writer('last')]);
  assert.deepEqual(events, ['bad', 'last']);
});
test('share gate blocks duplicates and releases after errors/cancel', async () => {
  const gate = createShareGate();
  let release!: () => void;
  const first = gate.run(
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
  );
  assert.equal(await gate.run(async () => {}), 'busy');
  release();
  assert.equal(await first, 'dismissed');
  await assert.rejects(
    gate.run(async () => {
      throw Error('disk');
    }),
  );
  assert.equal(await gate.run(async () => {}), 'dismissed');
});
