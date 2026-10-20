import { prepareScratch, type ScratchResources } from './scratch-resources';
import {
  BlurStyle,
  FilterMode,
  MipmapMode,
  PaintStyle,
  TileMode,
  type Skia,
  type SkColor,
  type SkImage,
  type SkPaint,
  type SkPath,
  type SkRect,
  type SkRSXform,
  type SkRuntimeEffect,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { random, TRAIL_POINTS, type Point, type Settings } from '../domain/model';
import { planEmbroidery } from './embroidery';
import { condensation, runningDrops, RUNNING_MAX, wipeEdges, type Drop } from './rain';
import { FOG, LINEN, LINEN_TILE, MOTTLE } from './shaders';
import { buildSheet, placeSprite, type Sheet } from './sprites';
import { extractStrokes, type Stroke } from './strokes';
import { layoutText } from './text-layout';

export type SkiaApi = typeof Skia;
export type EmbroideryResources = {
  scene: 'embroidery';
  sheet: SkImage;
  body: SkRect[];
  shadow: SkRect[];
  gloss: SkRect[];
  xforms: SkRSXform[];
  colors: SkColor[];
  revealPath: SkPath;
  revealWidth: number;
  weave: SkImage;
  mottle: SkImage;
  fontSize: number;
};
export type RainResources = {
  scene: 'rain';
  sheet: SkImage;
  clear: SkImage;
  glass: SkImage;
  rim: SkImage;
  wipePath: SkPath;
  wipeWidth: number;
  dripPath: SkPath;
  running: number[];
  dropBody: SkRect[];
  dropShadow: SkRect[];
  dropGloss: SkRect[];
  soft: SkRect[];
  fontSize: number;
};
export type Resources = EmbroideryResources | RainResources | ScratchResources;

const OUT = 3;
const W = 360,
  H = 640;
type Effects = { linen: SkRuntimeEffect; mottle: SkRuntimeEffect; fog: SkRuntimeEffect };

const BACKDROP_SCALE = 1.5;

/** Small LRU: settings changes reuse whatever did not change (layout, backdrop, glass). */
function lru<T>(size: number) {
  'worklet';
  const map = new Map<string, T>();
  return (key: string, make: () => T): T => {
    const hit = map.get(key);
    if (hit !== undefined) {
      map.delete(key);
      map.set(key, hit);
      return hit;
    }
    const value = make();
    map.set(key, value);
    if (map.size > size) map.delete(map.keys().next().value!);
    return value;
  };
}

function makeCaches() {
  'worklet';
  return {
    strokesCache: lru<{ strokes: Stroke[]; inkWidth: number; fontSize: number; glyphs: number }>(6),
    backdropCache: lru<SkImage>(2),
    glassCache: lru<SkImage>(2),
    clothCache: lru<{ weave: SkImage; mottle: SkImage }>(2),
    resourceCache: lru<Resources>(4),
    shared: undefined as ({ api: SkiaApi; sheet: Sheet } & Effects) | undefined,
  };
}

/** Each JS runtime owns its caches; never serialize mutable caches across runtimes. */
function getCaches() {
  'worklet';
  const runtime = globalThis as typeof globalThis & {
    __littleScenesRenderCacheV2?: ReturnType<typeof makeCaches>;
  };
  return (
    runtime.__littleScenesRenderCacheV2 ?? (runtime.__littleScenesRenderCacheV2 = makeCaches())
  );
}

function stage<T>(name: string, operation: () => T): T {
  'worklet';
  try {
    return operation();
  } catch (error) {
    const detail =
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    throw new Error(`[${name}] ${detail}`);
  }
}

function common(api: SkiaApi) {
  'worklet';
  const state = getCaches();
  const shared = state.shared;
  if (shared?.api === api) return shared;
  const linen = api.RuntimeEffect.Make(LINEN),
    mottle = api.RuntimeEffect.Make(MOTTLE),
    fog = api.RuntimeEffect.Make(FOG);
  if (!linen || !mottle || !fog) throw new Error('재질 셰이더를 준비하지 못했어요.');
  state.shared = { api, sheet: stage('sprite-sheet', () => buildSheet(api)), linen, mottle, fog };
  return state.shared;
}

/** Shader output baked into an image: `scale` pixels per logical unit over a logical area. */
function bake(
  api: SkiaApi,
  effect: SkRuntimeEffect,
  uniforms: number[],
  width: number,
  height: number,
  scale: number,
) {
  'worklet';
  const surface = api.Surface.Make(Math.round(width * scale), Math.round(height * scale));
  if (!surface) throw new Error('이미지를 만들 공간이 부족해요.');
  const canvas = surface.getCanvas();
  canvas.clear(api.Color('transparent'));
  canvas.scale(scale, scale);
  const paint = api.Paint();
  paint.setShader(effect.makeShader(uniforms));
  canvas.drawRect(api.XYWHRect(0, 0, width, height), paint);
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}

export const resourceKey = (s: Settings) => {
  'worklet';
  if (s.scene === 'scratch') return JSON.stringify([s.scene, s.text, s.seed, s.scratchFont]);
  return s.scene === 'embroidery'
    ? JSON.stringify([s.scene, s.text, s.seed, s.thread, s.density, s.writing])
    : JSON.stringify([s.scene, s.text, s.seed, s.mood, s.intensity]);
};

function polylines(api: SkiaApi, lines: Point[][]): SkPath {
  'worklet';
  const b = api.PathBuilder.Make();
  for (const line of lines) {
    if (!line.length) continue;
    b.moveTo(line[0].x, line[0].y);
    if (line.length === 1) b.lineTo(line[0].x + 0.01, line[0].y);
    for (let i = 1; i < line.length; i++) b.lineTo(line[i].x, line[i].y);
  }
  const path = b.detach();
  b.dispose();
  return path;
}

function drawLayer(
  api: SkiaApi,
  scale: number,
  draw: (
    canvas: ReturnType<NonNullable<ReturnType<SkiaApi['Surface']['Make']>>['getCanvas']>,
  ) => void,
): SkImage {
  'worklet';
  const surface = api.Surface.Make(Math.round(W * scale), Math.round(H * scale));
  if (!surface) throw new Error('이미지를 만들 공간이 부족해요.');
  const canvas = surface.getCanvas();
  canvas.clear(api.Color('transparent'));
  canvas.save();
  canvas.scale(scale, scale);
  draw(canvas);
  canvas.restore();
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}

/** Out-of-focus street at night (or an overcast day) behind the glass. */
function backdrop(api: SkiaApi, mood: 'day' | 'night', seed: number): SkImage {
  'worklet';
  const rng = random(seed ^ 0xbac0);
  const night = mood === 'night';
  const c = (v: string) => api.Color(v);
  return drawLayer(api, BACKDROP_SCALE, (canvas) => {
    const sky = api.Paint();
    sky.setShader(
      api.Shader.MakeLinearGradient(
        { x: 0, y: 0 },
        { x: 0, y: H },
        (night ? ['#2a3a42', '#1d2a31', '#121a20'] : ['#6c7f86', '#56676c', '#3e4a4e']).map(c),
        null,
        TileMode.Clamp,
      ),
    );
    canvas.drawPaint(sky);
    const blur = (p: SkPaint, sigma: number) =>
      p.setMaskFilter(api.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
    const glow = (x: number, y: number, r: number, color: string) => {
      const p = api.Paint();
      p.setShader(
        api.Shader.MakeRadialGradient(
          { x, y },
          r,
          [c(color), c(color.slice(0, 7) + '00')],
          null,
          TileMode.Clamp,
        ),
      );
      canvas.drawCircle(x, y, r, p);
    };
    const lights = night
      ? ['#ff5a4a', '#ff8f6b', '#58d0dc', '#eaf4ff', '#ffd27a', '#87e09c', '#ff5fa4']
      : ['#d9e2e4', '#c9b9a6', '#9fb7bd', '#e8e0cf', '#b9c9a8', '#d6a89c'];
    // Large washes of colour, like neon spill and headlights.
    glow(330, 430, 220, night ? '#ff6f7a70' : '#e6d3c270');
    glow(20, 300, 200, night ? '#3fc8d455' : '#c7d6d955');
    glow(180, 120, 160, night ? '#d8e6ee30' : '#f4f7f760');
    // Building masses and lit windows.
    for (let i = 0; i < 7; i++) {
      const p = api.Paint();
      p.setColor(c(night ? '#0e161b' : '#5e6e72'));
      p.setAlphaf(0.35 + rng() * 0.4);
      blur(p, 6);
      const x = rng() * 360,
        w = 30 + rng() * 80;
      canvas.drawRect(api.XYWHRect(x - w / 2, 120 + rng() * 140, w, 700), p);
    }
    for (let i = 0; i < 14; i++) {
      const p = api.Paint();
      p.setColor(c(lights[Math.floor(rng() * lights.length)]));
      p.setAlphaf(0.25 + rng() * 0.45);
      blur(p, 2.5 + rng() * 3);
      const x = rng() * 360,
        y = 60 + rng() * 420;
      canvas.drawRRect(api.RRectXY(api.XYWHRect(x, y, 3 + rng() * 9, 25 + rng() * 140), 3, 3), p);
    }
    for (let i = 0; i < 70; i++) {
      const p = api.Paint();
      const r = 3 + rng() ** 2 * 26;
      p.setColor(c(lights[Math.floor(rng() * lights.length)]));
      p.setAlphaf((night ? 0.3 : 0.2) + rng() * 0.55);
      blur(p, r * 0.25 + 1.5);
      canvas.drawCircle(rng() * 360, 140 + rng() ** 0.8 * 500, r, p);
    }
    const street = api.Paint();
    street.setShader(
      api.Shader.MakeLinearGradient(
        { x: 0, y: 470 },
        { x: 0, y: 640 },
        [c('#00000000'), c(night ? '#05090c90' : '#3b464960')],
        null,
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(api.XYWHRect(0, 470, W, 170), street);
  });
}

/** Each droplet is a small inverted lens of the scene behind it, with a dark rim and a highlight. */
function dropPainter(api: SkiaApi, clear: SkImage) {
  'worklet';
  const shadow = api.Paint();
  shadow.setAntiAlias(true);
  shadow.setColor(api.Color('#04090d'));
  const lens = api.Paint();
  lens.setAntiAlias(true);
  const rim = api.Paint();
  rim.setAntiAlias(true);
  rim.setStyle(PaintStyle.Stroke);
  const spark = api.Paint();
  spark.setAntiAlias(true);
  spark.setColor(api.Color('white'));
  const tiny = api.Paint();
  tiny.setAntiAlias(true);
  const k = 0.4;
  return (
    canvas: {
      drawOval: (r: SkRect, p: SkPaint) => void;
      drawCircle: (x: number, y: number, r: number, p: SkPaint) => void;
    },
    d: Drop,
  ) => {
    const rx = d.r,
      ry = d.r * d.stretch;
    const oval = api.XYWHRect(d.x - rx, d.y - ry * 0.9, rx * 2, ry * 2);
    if (d.r < 0.9) {
      tiny.setColor(api.Color('#0b151c'));
      tiny.setAlphaf(0.2);
      canvas.drawOval(oval, tiny);
      spark.setAlphaf(0.5);
      spark.setMaskFilter(null);
      canvas.drawCircle(d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.38, spark);
      return;
    }
    shadow.setAlphaf(0.22);
    shadow.setMaskFilter(api.MaskFilter.MakeBlur(BlurStyle.Normal, d.r * 0.35, true));
    canvas.drawOval(api.XYWHRect(oval.x, oval.y + d.r * 0.35, oval.width, oval.height), shadow);
    const m = api.Matrix();
    const a = -1 / (BACKDROP_SCALE * k);
    m.translate(d.x * (1 + 1 / k), d.y * (1 + 1 / k));
    m.scale(a, a);
    lens.setShader(
      clear.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.None,
        m,
      ),
    );
    canvas.drawOval(oval, lens);
    rim.setStrokeWidth(Math.max(0.25, d.r * 0.26));
    rim.setShader(
      api.Shader.MakeLinearGradient(
        { x: 0, y: oval.y },
        { x: 0, y: oval.y + oval.height },
        [api.Color('#ffffff30'), api.Color('#0a141a20'), api.Color('#05090d90')],
        [0, 0.5, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawOval(oval, rim);
    spark.setAlphaf(0.18);
    spark.setMaskFilter(api.MaskFilter.MakeBlur(BlurStyle.Normal, d.r * 0.15, true));
    canvas.drawOval(api.XYWHRect(d.x - rx * 0.5, d.y + ry * 0.35, rx, ry * 0.4), spark);
    spark.setAlphaf(0.85);
    spark.setMaskFilter(api.MaskFilter.MakeBlur(BlurStyle.Normal, Math.max(0.1, d.r * 0.07), true));
    canvas.drawOval(api.XYWHRect(d.x - rx * 0.55, d.y - ry * 0.62, rx * 0.5, ry * 0.36), spark);
  };
}

/** Fogged glass: heavily blurred backdrop + haze + lens droplets, at output resolution. */
function glassLayer(
  api: SkiaApi,
  fog: SkRuntimeEffect,
  clear: SkImage,
  mood: 'day' | 'night',
  seed: number,
  drops: Drop[],
): SkImage {
  'worklet';
  // Blur and haze are low-frequency: build them at a small size, then upsample with a smooth cubic.
  const sw = 120,
    sh = 214;
  const small = api.Surface.Make(sw, sh);
  if (!small) throw new Error('이미지를 만들 공간이 부족해요.');
  const sc = small.getCanvas();
  const p = api.Paint();
  p.setImageFilter(api.ImageFilter.MakeBlur(3.4, 3.4, TileMode.Clamp, null));
  sc.drawImageRectOptions(
    clear,
    api.XYWHRect(0, 0, clear.width(), clear.height()),
    api.XYWHRect(0, 0, sw, sh),
    FilterMode.Linear,
    MipmapMode.Linear,
    p,
  );
  const night = mood === 'night';
  const haze = api.Paint();
  const tint = night ? [0.62, 0.7, 0.72] : [0.9, 0.93, 0.93];
  haze.setShader(fog.makeShader([seed % 997, night ? 0.34 : 0.62, ...tint]));
  sc.save();
  sc.scale(sw / W, sh / H);
  sc.drawRect(api.XYWHRect(0, 0, W, H), haze);
  sc.restore();
  small.flush();
  const fogged = small.makeImageSnapshot();
  small.dispose();
  return drawLayer(api, OUT, (canvas) => {
    canvas.drawImageRectCubic(
      fogged,
      api.XYWHRect(0, 0, sw, sh),
      api.XYWHRect(0, 0, W, H),
      1 / 3,
      1 / 3,
      null,
    );
    const draw = dropPainter(api, clear);
    for (const d of drops) draw(canvas, d);
  });
}

function build(api: SkiaApi, fonts: SkTypefaceFontProvider, s: Settings): Resources {
  'worklet';
  if (s.scene === 'scratch') return prepareScratch(api, fonts, s);
  const { strokesCache, backdropCache, glassCache, clothCache } = getCaches();
  const { sheet, linen, mottle, fog } = stage('materials', () => common(api));
  const writing = s.scene === 'embroidery' ? s.writing : 'horizontal';
  const weight = s.scene === 'embroidery' ? 400 : 700;
  const maxSize = s.scene === 'rain' ? 96 : 84;
  const text = strokesCache(JSON.stringify([s.text, writing, weight, maxSize]), () => {
    const layout = stage('text-layout', () =>
      layoutText(api, fonts, s.text, writing, weight, maxSize),
    );
    const { strokes, inkWidth } = extractStrokes(
      layout.alpha,
      layout.width,
      layout.height,
      layout.scale,
    );
    const glyphs = [...s.text.replace(/\s/g, '')].length;
    return { strokes, inkWidth, fontSize: layout.fontSize, glyphs };
  });
  if (s.scene === 'embroidery') {
    const plan = planEmbroidery({
      strokes: text.strokes,
      fontSize: text.fontSize,
      writing,
      palette: s.thread,
      fine: s.density === 'fine',
      seed: s.seed,
      glyphs: text.glyphs,
    });
    const cloth = clothCache(String(s.seed), () => ({
      weave: bake(api, linen, [s.seed % 997], LINEN_TILE, LINEN_TILE, OUT),
      mottle: bake(api, mottle, [s.seed % 997], W, H, 0.25),
    }));
    const xforms = plan.items.map((p) => placeSprite(api, p.kind, p.x, p.y, p.angle, p.size));
    return {
      scene: 'embroidery',
      sheet: sheet.image,
      body: plan.items.map((p) => sheet.rect(p.kind, 'body')),
      shadow: plan.items.map((p) => sheet.rect(p.kind, 'shadow')),
      gloss: plan.items.map((p) => sheet.rect(p.kind, 'gloss')),
      xforms,
      colors: plan.items.map((p) => api.Color(p.color)),
      revealPath: polylines(api, plan.reveal),
      revealWidth: plan.revealWidth,
      ...cloth,
      fontSize: text.fontSize,
    };
  }
  const clear = backdropCache(`${s.mood}:${s.seed}`, () => backdrop(api, s.mood, s.seed));
  const glass = glassCache(`${s.mood}:${s.seed}:${s.intensity}`, () =>
    glassLayer(api, fog, clear, s.mood, s.seed, condensation(s.seed, s.intensity)),
  );
  const wipeWidth = Math.min(11, Math.max(3.5, text.fontSize * 0.13));
  const edges = wipeEdges(text.strokes, wipeWidth, s.seed);
  const rim = drawLayer(api, OUT, (canvas) => {
    const draw = dropPainter(api, clear);
    for (const b of edges.beads) draw(canvas, b);
    for (const d of edges.drips) draw(canvas, d.bead);
  });
  const running = runningDrops(s.seed, s.intensity);
  const count = RUNNING_MAX;
  return {
    scene: 'rain',
    sheet: sheet.image,
    clear,
    glass,
    rim,
    wipePath: polylines(
      api,
      text.strokes.map((t) => (t.closed ? [...t.points, t.points[0]] : t.points)),
    ),
    wipeWidth,
    dripPath: polylines(
      api,
      edges.drips.map((d) => d.points),
    ),
    running,
    dropBody: Array.from({ length: count }, () => sheet.rect('drop', 'body')),
    dropShadow: Array.from({ length: count }, () => sheet.rect('drop', 'shadow')),
    dropGloss: Array.from({ length: count }, () => sheet.rect('drop', 'gloss')),
    soft: Array.from({ length: TRAIL_POINTS }, () => sheet.rect('soft', 'body')),
    fontSize: text.fontSize,
  };
}

export function prepareResources(
  api: SkiaApi,
  fonts: SkTypefaceFontProvider,
  settings: Settings,
): Resources {
  'worklet';
  return getCaches().resourceCache(resourceKey(settings), () => build(api, fonts, settings));
}
