import fs from 'node:fs';
import assert from 'node:assert/strict';
import React from 'react';
import CanvasKitInit from 'canvaskit-wasm/bin/full/canvaskit.js';
import {
  getSkiaExports,
  makeOffscreenSurface,
  drawOffscreen,
  Group,
} from '@shopify/react-native-skia';
import { prepareResources } from '../src/render/resources';
import { frameMotion } from '../src/render/motion';
import { artwork } from '../src/scenes/artwork';
import { defaults, type Settings } from '../src/domain/model';

type Variant = { name: string; settings: Settings; time?: number; reveal?: number };

async function main() {
  (globalThis as any).CanvasKit = await CanvasKitInit({
    locateFile: () => require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm'),
  });
  const { Skia } = getSkiaExports();
  const provider = Skia.TypefaceFontProvider.Make();
  const face = Skia.Typeface.MakeFreeTypeFaceFromData(
    Skia.Data.fromBytes(fs.readFileSync('assets/fonts/NotoSansKR.ttf')),
  );
  assert.ok(face);
  provider.registerFont(face, 'LittleScenes');
  for (const weight of ['Regular', 'Bold']) {
    const hand = Skia.Typeface.MakeFreeTypeFaceFromData(
      Skia.Data.fromBytes(fs.readFileSync(`assets/fonts/Gaegu-${weight}.ttf`)),
    );
    assert.ok(hand);
    provider.registerFont(hand, 'Handwritten');
  }
  const out = process.env.RENDER_OUT ?? 'examples';
  fs.mkdirSync(out, { recursive: true });
  const variants: Variant[] = [
    { name: 'embroidery', settings: defaults('embroidery') },
    { name: 'rain', settings: defaults('rain'), time: 5200 },
  ];
  if (process.env.RENDER_ALL)
    variants.push(
      {
        name: 'embroidery-horizontal-red',
        settings: {
          ...defaults('embroidery'),
          writing: 'horizontal',
          thread: 'red',
          text: '오늘도,\n천천히 걸어요',
        },
      },
      {
        name: 'embroidery-long-navy',
        settings: {
          ...defaults('embroidery'),
          thread: 'navy',
          density: 'normal',
          text: '안녕하세요\n이거 너무 예쁘네요\n후후',
        },
      },
      { name: 'embroidery-half', settings: defaults('embroidery'), reveal: 0.45 },
      {
        name: 'rain-day',
        settings: { ...defaults('rain'), mood: 'day', intensity: 3, text: '사랑해' },
        time: 9000,
      },
    );
  for (const v of variants) {
    const started = Date.now();
    const r = prepareResources(Skia, provider, v.settings);
    const prepared = Date.now() - started;
    assert.ok(r.fontSize >= 20);
    const frame = {
      ...v.settings,
      time: v.time ?? 1600,
      reveal: v.reveal ?? 1,
      touch: { x: -100, y: -100, strength: 0 },
      trail: [],
    };
    const motion = { ...frameMotion(Skia, frame, r.scene === 'rain' ? r.running : []) };
    const surface = makeOffscreenSurface(1080, 1920);
    const drawStarted = Date.now();
    const image = await drawOffscreen(
      surface,
      <Group transform={[{ scale: 3 }]}>{artwork(v.settings, r, motion)}</Group>,
    );
    const drawn = Date.now() - drawStarted;
    assert.equal(image.width(), 1080);
    assert.equal(image.height(), 1920);
    const bytes = image.encodeToBytes();
    assert.ok(bytes && bytes.length > 10000);
    if (r.scene === 'rain') {
      const hidden = await drawOffscreen(
        surface,
        <Group transform={[{ scale: 3 }]}>
          {artwork(v.settings, r, { ...motion, reveal: 0 })}
        </Group>,
      );
      const a = image.readPixels(),
        b = hidden.readPixels();
      assert.ok(a instanceof Uint8Array && b instanceof Uint8Array);
      let changed = 0;
      for (let i = 0; i < a.length; i += 4)
        if (
          Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >
          24
        )
          changed++;
      console.log(`${v.name}: wiped pixels ${changed}`);
      assert.ok(changed > 20000, 'Wiped letters must reveal the scene behind the glass');
      hidden.dispose();
    } else {
      assert.ok(r.xforms.length > 50, 'Letters must be made of stitches');
      console.log(`${v.name}: ${r.xforms.length} stitches`);
    }
    fs.writeFileSync(`${out}/${v.name}.png`, bytes!);
    image.dispose();
    surface.dispose();
    console.log(`${v.name}: real Skia PNG PASS (prepare ${prepared}ms, 1080x1920 draw ${drawn}ms)`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
