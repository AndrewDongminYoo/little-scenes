import {
  BlurStyle,
  PaintStyle,
  StrokeCap,
  TileMode,
  ClipOp,
  type SkImage,
  type SkPaint,
  type SkPath,
  type SkRect,
} from '@shopify/react-native-skia';
import type { SpriteKind } from './embroidery';
import type { SkiaApi } from './resources';

export type SheetKind = SpriteKind | 'soft' | 'drop';
export const CELL = 64;
/** Pixel length of each sprite's long axis inside its cell; RSXform scale = logical size / axis. */
export const AXIS: Record<SheetKind, number> = {
  stem: 48,
  back: 40,
  chain: 46,
  knot: 38,
  petal: 48,
  leaf: 50,
  soft: 56,
  drop: 44,
};
const KINDS: SheetKind[] = ['stem', 'back', 'chain', 'knot', 'petal', 'leaf', 'soft', 'drop'];
export const ROW = { body: 0, shadow: 1, gloss: 2 } as const;

export type Sheet = { image: SkImage; rect: (kind: SheetKind, row: keyof typeof ROW) => SkRect };

/**
 * Grey bodies (tinted per stitch with Atlas colours), soft shadows and gloss,
 * one 64px cell per sprite, every shape centred on (32, 32) along +x.
 */
export function buildSheet(api: SkiaApi): Sheet {
  const surface = api.Surface.Make(CELL * KINDS.length, CELL * 3);
  if (!surface) throw new Error('실 재질을 준비하지 못했어요.');
  const canvas = surface.getCanvas();
  canvas.clear(api.Color('transparent'));
  const c = (v: string) => api.Color(v);
  const paint = (color = 'white'): SkPaint => {
    const p = api.Paint();
    p.setAntiAlias(true);
    p.setColor(c(color));
    return p;
  };
  const vertical = (top: number, bottom: number, stops: string[]) =>
    api.Shader.MakeLinearGradient(
      { x: 0, y: top },
      { x: 0, y: bottom },
      stops.map(c),
      null,
      TileMode.Clamp,
    );
  const build = (fn: (b: ReturnType<SkiaApi['PathBuilder']['Make']>) => void): SkPath => {
    const b = api.PathBuilder.Make();
    fn(b);
    const path = b.detach();
    b.dispose();
    return path;
  };
  const capsule = (x0: number, x1: number, half: number) =>
    build((b) =>
      b.addRRect(api.RRectXY(api.XYWHRect(x0, 32 - half, x1 - x0, half * 2), half, half)),
    );
  const shapes: Record<SheetKind, { fill?: SkPath; stroke?: { path: SkPath; width: number } }> = {
    stem: { fill: capsule(8, 56, 10) },
    back: { fill: capsule(12, 52, 8) },
    chain: {
      stroke: {
        path: build((b) => {
          b.addOval(api.XYWHRect(16, 22, 34, 20));
          b.moveTo(9, 32);
          b.lineTo(17, 32);
        }),
        width: 6.5,
      },
    },
    knot: { fill: build((b) => b.addCircle(32, 32, 19)) },
    petal: {
      stroke: {
        path: build((b) => {
          b.addOval(api.XYWHRect(9, 25, 44, 14));
          b.moveTo(52, 32);
          b.lineTo(57, 32);
        }),
        width: 5.5,
      },
    },
    leaf: {
      fill: build((b) => {
        b.moveTo(7, 32);
        b.quadTo(30, 13, 57, 32);
        b.quadTo(30, 51, 7, 32);
        b.close();
      }),
    },
    soft: {},
    drop: { fill: build((b) => b.addCircle(32, 32, 22)) },
  };
  KINDS.forEach((kind, col) => {
    const shape = shapes[kind];
    const draw = (p: SkPaint) => {
      if (shape.fill) canvas.drawPath(shape.fill, p);
      if (shape.stroke) {
        p.setStyle(PaintStyle.Stroke);
        p.setStrokeWidth(shape.stroke.width);
        p.setStrokeCap(StrokeCap.Round);
        canvas.drawPath(shape.stroke.path, p);
      }
    };
    // Body
    canvas.save();
    canvas.translate(col * CELL, ROW.body * CELL);
    canvas.clipRect(api.XYWHRect(0, 0, CELL, CELL), ClipOp.Intersect, true);
    if (kind === 'soft') {
      const p = paint();
      p.setShader(
        api.Shader.MakeRadialGradient(
          { x: 32, y: 32 },
          28,
          [c('white'), c('#ffffffcc'), c('#ffffff00')],
          [0, 0.45, 1],
          TileMode.Clamp,
        ),
      );
      canvas.drawCircle(32, 32, 28, p);
    } else if (kind === 'drop') {
      const p = paint();
      p.setShader(
        api.Shader.MakeRadialGradient(
          { x: 31, y: 28 },
          24,
          [c('#e6f4f855'), c('#9fb8c033'), c('#0c181fa0')],
          [0, 0.62, 1],
          TileMode.Clamp,
        ),
      );
      draw(p);
      const crescent = paint('#ffffff40');
      canvas.drawOval(api.XYWHRect(22, 42, 20, 7), crescent);
    } else if (kind === 'knot') {
      const p = paint();
      p.setShader(
        api.Shader.MakeRadialGradient(
          { x: 26, y: 25 },
          26,
          [c('#ffffff'), c('#d9d9d9'), c('#7a7a7a')],
          [0, 0.55, 1],
          TileMode.Clamp,
        ),
      );
      draw(p);
      const swirl = paint('#00000040');
      swirl.setStyle(PaintStyle.Stroke);
      swirl.setStrokeWidth(2);
      for (const [x, y, s] of [
        [20, 18, 0],
        [24, 26, 120],
        [18, 24, 240],
      ])
        canvas.drawPath(
          build((b) => b.addArc(api.XYWHRect(x, y, 22, 20), s, 110)),
          swirl,
        );
    } else {
      const p = paint();
      p.setShader(vertical(16, 48, ['#ffffff', '#e4e4e4', '#c8c8c8', '#808080']));
      draw(p);
      const line = paint('#00000038');
      line.setStyle(PaintStyle.Stroke);
      line.setStrokeWidth(1.6);
      if (shape.fill) {
        canvas.save();
        canvas.clipPath(shape.fill, ClipOp.Intersect, true);
        if (kind === 'leaf') {
          canvas.drawLine(9, 32, 55, 32, line);
          for (let x = 14; x < 54; x += 5) {
            canvas.drawLine(x, 32, x + 6, 22, line);
            canvas.drawLine(x, 32, x + 6, 42, line);
          }
        } else
          // Twisted plies of floss.
          for (let x = 0; x < 64; x += 6) canvas.drawLine(x, 44, x + 10, 20, line);
        canvas.restore();
      }
    }
    canvas.restore();
    // Shadow
    canvas.save();
    canvas.translate(col * CELL, ROW.shadow * CELL);
    canvas.clipRect(api.XYWHRect(0, 0, CELL, CELL), ClipOp.Intersect, true);
    if (kind !== 'soft') {
      const p = paint(kind === 'drop' ? '#00000055' : '#2b1e10a0');
      p.setMaskFilter(api.MaskFilter.MakeBlur(BlurStyle.Normal, 2.4, true));
      draw(p);
    }
    canvas.restore();
    // Gloss
    canvas.save();
    canvas.translate(col * CELL, ROW.gloss * CELL);
    canvas.clipRect(api.XYWHRect(0, 0, CELL, CELL), ClipOp.Intersect, true);
    const g = paint('#ffffffa0');
    g.setMaskFilter(api.MaskFilter.MakeBlur(BlurStyle.Normal, 1.2, true));
    if (kind === 'knot' || kind === 'drop') canvas.drawCircle(25, 24, kind === 'drop' ? 5 : 6, g);
    else if (kind === 'stem' || kind === 'back')
      canvas.drawRRect(
        api.RRectXY(
          api.XYWHRect(kind === 'stem' ? 14 : 17, 26, kind === 'stem' ? 36 : 30, 3),
          1.5,
          1.5,
        ),
        g,
      );
    else if (kind === 'leaf') canvas.drawOval(api.XYWHRect(18, 25, 26, 4), g);
    else if (kind === 'chain' || kind === 'petal') {
      g.setStyle(PaintStyle.Stroke);
      g.setStrokeWidth(1.8);
      const r = kind === 'chain' ? api.XYWHRect(19, 24, 28, 14) : api.XYWHRect(14, 27, 36, 9);
      canvas.drawPath(
        build((b) => b.addArc(r, 200, 120)),
        g,
      );
    }
    canvas.restore();
  });
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return {
    image,
    rect: (kind, row) => api.XYWHRect(KINDS.indexOf(kind) * CELL, ROW[row] * CELL, CELL, CELL),
  };
}

/** RSXform placing a sprite centre at (x, y), long axis at `angle`, axis length `size`. */
export function placeSprite(
  api: SkiaApi,
  kind: SheetKind,
  x: number,
  y: number,
  angle: number,
  size: number,
) {
  'worklet';
  const s = size / AXIS[kind];
  const scos = s * Math.cos(angle),
    ssin = s * Math.sin(angle);
  const h = CELL / 2;
  return api.RSXform(scos, ssin, x - (scos * h - ssin * h), y - (ssin * h + scos * h));
}
