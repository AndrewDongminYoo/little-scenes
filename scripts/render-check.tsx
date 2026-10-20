import { createScratch, scrape, revealScratch, type ScratchState } from '../src/render/scratch';
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

type Variant = {
  name: string;
  settings: Settings;
  time?: number;
  reveal?: number;
  scratch?: ScratchState;
};

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
  const medium = Skia.Typeface.MakeFreeTypeFaceFromData(
    Skia.Data.fromBytes(fs.readFileSync('assets/fonts/NotoSansKR-Medium.ttf')),
  );
  assert.ok(medium);
  provider.registerFont(medium, 'ScratchSans');
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
    { name: 'scratch', settings: defaults('scratch'), scratch: createScratch() },
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
      {
        name: 'embroidery-crowded',
        settings: {
          ...defaults('embroidery'),
          writing: 'horizontal',
          text: '안녕하세요. 적당히 바람이 시원해 기분이 너무 좋아요.',
        },
      },
      { name: 'embroidery-half', settings: defaults('embroidery'), reveal: 0.45 },
      {
        name: 'rain-day',
        settings: { ...defaults('rain'), mood: 'day', intensity: 3, text: '사랑해' },
        time: 9000,
      },
    );
  let scratched = createScratch();
  for (let i = 0; i < 6; i++)
    scratched = scrape(
      scratched,
      { x: 80, y: 310 + i * 19 },
      { x: 280, y: 340 + i * 16 },
      45,
      i * 80,
      2731,
    );
  variants.push(
    { name: 'scratch-partial', settings: defaults('scratch'), scratch: scratched, time: 520 },
    { name: 'scratch-revealed', settings: defaults('scratch'), scratch: revealScratch() },
  );
  let resident = createScratch();
  for (let i = 0; i < 6; i++)
    resident = scrape(
      resident,
      { x: 80, y: 310 + i * 19 },
      { x: 280, y: 340 + i * 16 },
      45,
      i * 80,
      2731,
      'stay',
    );
  variants.push(
    {
      name: 'scratch-resident',
      settings: { ...defaults('scratch'), debrisMode: 'stay' },
      scratch: resident,
      time: 9000,
    },
    {
      name: 'scratch-sans',
      settings: { ...defaults('scratch'), scratchFont: 'sans' },
      scratch: revealScratch(),
    },
  );
  for (const v of variants) {
    const started = Date.now();
    const r = prepareResources(Skia, provider, v.settings);
    const prepared = Date.now() - started;
    assert.ok(r.fontSize >= (r.scene === 'scratch' ? 16 : 20));
    const frame = {
      ...v.settings,
      scratch: v.scratch,
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
    } else if (r.scene === 'embroidery') {
      assert.ok(r.xforms.length > 50, 'Letters must be made of stitches');
      console.log(`${v.name}: ${r.xforms.length} stitches`);
    }
    if (v.name === 'scratch' && r.scene === 'scratch') {
      const revealed = await drawOffscreen(
        surface,
        <Group transform={[{ scale: 3 }]}>
          {artwork(v.settings, r, frameMotion(Skia, { ...frame, scratch: revealScratch() }, []))}
        </Group>,
      );
      const a = image.readPixels() as Uint8Array,
        b = revealed.readPixels() as Uint8Array;
      let changed = 0,
        outside = 0;
      for (let y = 0; y < 1920; y++)
        for (let x = 0; x < 1080; x++) {
          const i = (y * 1080 + x) * 4;
          const difference =
            Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
          if (difference > 25) {
            if (x >= 135 && x < 945 && y >= 882 && y < 1314) changed++;
            else outside++;
          }
        }
      assert.ok(changed > 250000, 'Untouched foil must obscure the phrase, not render transparent');
      assert.equal(outside, 0, 'Removing foil must not change the rest of the card');
      revealed.dispose();
    }
    if (v.name === 'rain' && r.scene === 'rain') {
      for (const time of [0, 1600, 5200, 9000]) {
        const f = { ...frame, time };
        const padded = makeOffscreenSurface(360, 800);
        const proof = await drawOffscreen(
          padded,
          <Group transform={[{ translateY: 80 }]}>
            {artwork(v.settings, r, frameMotion(Skia, f, r.running))}
          </Group>,
        );
        const rgba = proof.readPixels() as Uint8Array;
        for (let y = 0; y < 800; y++)
          if (y < 80 || y >= 720)
            for (let x = 0; x < 360; x++)
              assert.equal(rgba[(y * 360 + x) * 4 + 3], 0, `Rain escaped letterbox at ${time}ms`);
        proof.dispose();
        padded.dispose();
      }
    }
    if (v.name === 'rain' || v.name === 'embroidery' || v.name === 'scratch') {
      fs.mkdirSync('assets/previews', { recursive: true });
      const previewSurface = makeOffscreenSurface(360, 640);
      const preview = await drawOffscreen(previewSurface, artwork(v.settings, r, motion));
      fs.writeFileSync(`assets/previews/${v.name}.png`, preview.encodeToBytes()!);
      preview.dispose();
      previewSurface.dispose();
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
