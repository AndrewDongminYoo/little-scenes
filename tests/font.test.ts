import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('scratch Gothic has a static Medium face, not the variable Thin default', () => {
  const b = fs.readFileSync('assets/fonts/NotoSansKR-Medium.ttf');
  const tables = new Map<string, number>();
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const p = 12 + i * 16;
    tables.set(b.toString('ascii', p, p + 4), b.readUInt32BE(p + 8));
  }
  assert.equal(tables.has('fvar'), false);
  assert.equal(b.readUInt16BE(tables.get('OS/2')! + 4), 500);
  assert.match(
    fs.readFileSync('src/render/useResources.ts', 'utf8'),
    /ScratchSans:.*NotoSansKR-Medium/,
  );
  assert.match(fs.readFileSync('src/render/scratch-resources.ts', 'utf8'), /'ScratchSans'/);
});
