import { random, type Palette, type Point, type Writing } from '../domain/model.ts';
import { length, resample, type Stroke } from './strokes.ts';
import { COLUMN_PITCH, VERTICAL_PITCH } from './text-layout.ts';

export type SpriteKind = 'stem' | 'back' | 'chain' | 'knot' | 'petal' | 'leaf';
/** `size` is the logical length of the sprite's long axis (diameter for knots). */
export type Placement = {
  kind: SpriteKind;
  x: number;
  y: number;
  angle: number;
  size: number;
  color: string;
};
export type EmbroideryPlan = {
  items: Placement[];
  /** Polylines in stitching order; the reveal mask strokes along them. */
  reveal: Point[][];
  revealWidth: number;
  thickness: number;
};

export const MAX_STITCHES = 6000;

type Spec = {
  strokes: string[];
  accents: string[];
  accentShare: number;
  flowers: string[];
  centres: string[];
  leaves: string[];
};
const GREENS = ['#5f8a45', '#4f7a43', '#6d9450'];
export const PALETTES: Record<Palette, Spec> = {
  meadow: {
    strokes: ['#5d7d43', '#6f8f4e', '#4e7048'],
    accents: ['#c4473d', '#2f9488', '#dcae35', '#d8762e', '#875aa6', '#d0607d', '#3d74b0'],
    accentShare: 0.4,
    flowers: ['#c4473d', '#2f9488', '#dcae35', '#875aa6', '#d0607d', '#f1ece0', '#3d74b0'],
    centres: ['#e3b23c', '#d9822f'],
    leaves: GREENS,
  },
  red: {
    strokes: ['#9b2d2f', '#b03a37', '#8a2a2c'],
    accents: [],
    accentShare: 0,
    flowers: ['#c9434a', '#e48a98', '#f1ece0', '#b8323a'],
    centres: ['#e3b23c'],
    leaves: GREENS,
  },
  navy: {
    strokes: ['#2c4670', '#38578a', '#25395c'],
    accents: [],
    accentShare: 0,
    flowers: ['#3d74b0', '#9fb9da', '#f1ece0', '#5a4f9a'],
    centres: ['#e3b23c'],
    leaves: GREENS,
  },
};

const pickFrom = <T>(rng: () => number, list: T[]) =>
  list[Math.floor(rng() * list.length) % list.length];

/** Orders strokes as a reader would sew them and orients each from its top/left end. */
export function orderStrokes(strokes: Stroke[], writing: Writing, fontSize: number): Stroke[] {
  const keyed = strokes.map((s) => {
    let pts = s.points;
    if (!s.closed && pts.length > 1) {
      const a = pts[0],
        b = pts[pts.length - 1];
      const horizontalish = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
      if (horizontalish ? b.x < a.x : b.y < a.y) pts = [...pts].reverse();
    }
    let minX = Infinity,
      minY = Infinity,
      sx = 0,
      sy = 0;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      sx += p.x;
      sy += p.y;
    }
    const cx = sx / pts.length,
      cy = sy / pts.length;
    const band =
      writing === 'vertical'
        ? Math.round(-cx / (fontSize * COLUMN_PITCH))
        : Math.round(cy / (fontSize * 1.22));
    return {
      stroke: { ...s, points: pts },
      band,
      a: writing === 'vertical' ? minY : minX,
      b: writing === 'vertical' ? minX : minY,
    };
  });
  keyed.sort((p, q) => p.band - q.band || p.a - q.a || p.b - q.b);
  return keyed.map((k) => k.stroke);
}

export function planEmbroidery(input: {
  strokes: Stroke[];
  fontSize: number;
  writing: Writing;
  palette: Palette;
  fine: boolean;
  seed: number;
  glyphs: number;
}): EmbroideryPlan {
  const { fontSize: fs, fine } = input;
  const spec = PALETTES[input.palette];
  const rng = random(input.seed ^ 0x5eed);
  const t = Math.min(5.5, Math.max(1.6, fs * 0.075));
  const items: Placement[] = [];
  const leafItems: Placement[] = [];
  const flowerItems: Placement[] = [];
  const reveal: Point[][] = [];
  const push = (list: Placement[], p: Placement) => {
    if (items.length + leafItems.length + flowerItems.length < MAX_STITCHES) list.push(p);
  };
  const disc = (c: Point, radius: number) => {
    reveal.push([c, { x: c.x + 0.01, y: c.y }]);
    for (let r = t * 1.2; r <= radius; r += t * 1.8) {
      const n = Math.max(6, Math.round((r * Math.PI * 2) / (t * 1.4)));
      reveal.push(
        Array.from({ length: n + 1 }, (_, k) => ({
          x: c.x + Math.cos((k / n) * Math.PI * 2) * r,
          y: c.y + Math.sin((k / n) * Math.PI * 2) * r,
        })),
      );
    }
  };
  const flower = (
    type: 'daisy' | 'pompom' | 'rose' | 'star' | 'bud',
    c: Point,
    R: number,
    dir = 0,
  ) => {
    const colour = pickFrom(rng, spec.flowers);
    const centre = pickFrom(rng, spec.centres);
    const a0 = rng() * Math.PI;
    const knot = (x: number, y: number, size: number, color: string) =>
      push(flowerItems, { kind: 'knot', x, y, angle: rng() * 6.28, size, color });
    const petal = (ang: number, r: number, size: number, color: string) =>
      push(flowerItems, {
        kind: 'petal',
        x: c.x + Math.cos(ang) * r,
        y: c.y + Math.sin(ang) * r,
        angle: ang,
        size,
        color,
      });
    if (type === 'daisy') {
      const n = 8 + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) petal(a0 + (k / n) * Math.PI * 2, R * 0.52, R * 0.95, colour);
      knot(c.x, c.y, R * 0.26, centre);
      for (let k = 0; k < 6; k++) {
        const ang = a0 + (k / 6) * Math.PI * 2;
        knot(
          c.x + Math.cos(ang) * R * 0.18,
          c.y + Math.sin(ang) * R * 0.18,
          R * 0.2,
          shade(centre, -0.08),
        );
      }
    } else if (type === 'pompom') {
      for (const [r, n] of [
        [0, 1],
        [0.3, 6],
        [0.58, 11],
        [0.84, 16],
      ])
        for (let k = 0; k < n; k++) {
          const ang = a0 + (k / n) * Math.PI * 2 + r;
          knot(
            c.x + Math.cos(ang) * R * r + (rng() - 0.5) * R * 0.05,
            c.y + Math.sin(ang) * R * r + (rng() - 0.5) * R * 0.05,
            R * 0.31,
            rng() < 0.3 ? shade(colour, 0.14) : colour,
          );
        }
    } else if (type === 'rose') {
      for (let r = R * 0.85; r >= R * 0.2; r -= R * 0.17) {
        const n = Math.max(5, Math.round((r * Math.PI * 2) / (t * 0.8)));
        for (let k = 0; k < n; k++) {
          const ang = a0 + (k / n) * Math.PI * 2;
          push(flowerItems, {
            kind: 'stem',
            x: c.x + Math.cos(ang) * r,
            y: c.y + Math.sin(ang) * r,
            angle: ang + Math.PI / 2 + 0.4,
            size: Math.min(R * 0.4, t * 1.9),
            color: shade(colour, (r / R - 0.5) * 0.25),
          });
        }
      }
      knot(c.x, c.y, R * 0.3, shade(colour, -0.15));
    } else if (type === 'star') {
      for (let k = 0; k < 5; k++) petal(a0 + (k / 5) * Math.PI * 2, R * 0.48, R * 0.9, colour);
      knot(c.x, c.y, R * 0.36, centre);
    } else {
      for (const off of [-0.5, 0, 0.5]) petal(dir + off, R * 0.45, R * 0.9, colour);
      knot(c.x, c.y, R * 0.3, shade(colour, -0.1));
    }
  };
  const leaf = (c: Point, ang: number, size: number) =>
    push(leafItems, {
      kind: 'leaf',
      x: c.x + Math.cos(ang) * size * 0.5,
      y: c.y + Math.sin(ang) * size * 0.5,
      angle: ang,
      size,
      color: pickFrom(rng, spec.leaves),
    });

  const meadow = input.palette === 'meadow';
  const wanted = Math.min(14, Math.max(1, Math.round(input.glyphs * (meadow ? 0.8 : 0.5))));
  let flowers = 0;
  const loopChance = meadow ? 0.75 : 0.4;
  const tips: { p: Point; dir: number }[] = [];
  const glyphColor = new Map<number, string>();
  const groupOf = (p: Point) =>
    input.writing === 'vertical'
      ? Math.round(p.x / (fs * COLUMN_PITCH)) * 1000 + Math.round(p.y / (fs * VERTICAL_PITCH))
      : Math.round(p.y / (fs * 1.22)) * 1000 + Math.round(p.x / fs);

  for (const s of orderStrokes(input.strokes, input.writing, fs)) {
    const total = length(s.points, s.closed);
    if (s.closed) {
      // A small closed loop (ㅇ, o) may bloom into a flower of the same size, as hand embroiderers do.
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const p of s.points) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
      const radius = Math.max(x1 - x0, y1 - y0) / 2;
      if (flowers < wanted && radius > t * 1.2 && radius < fs * 0.32 && rng() < loopChance) {
        const c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
        const roll = rng();
        flower(roll < 0.4 ? 'daisy' : roll < 0.75 ? 'pompom' : 'rose', c, radius * 1.3);
        if (rng() < 0.6) leaf(c, Math.PI * (0.15 + rng() * 0.7), radius * 1.4);
        disc(c, radius * 1.3 + t);
        flowers++;
        continue;
      }
    }
    const group = groupOf(s.points[Math.floor(s.points.length / 2)]);
    if (!glyphColor.has(group) && spec.accents.length)
      glyphColor.set(group, pickFrom(rng, spec.accents));
    const accent = spec.accentShare > 0 && rng() < spec.accentShare;
    const color = accent ? glyphColor.get(group)! : pickFrom(rng, spec.strokes);
    const roll = rng();
    let kind: 'stem' | 'back' | 'chain' | 'knots';
    if (accent) kind = roll < 0.5 ? 'stem' : roll < 0.8 ? 'chain' : 'knots';
    else if (input.palette === 'meadow') kind = roll < 0.75 ? 'stem' : 'back';
    else kind = roll < 0.65 ? 'stem' : roll < 0.8 ? 'back' : 'chain';
    if (total < t * 1.4) kind = 'knots';
    const step = {
      stem: t * (fine ? 0.42 : 0.58),
      back: t * (fine ? 1.15 : 1.4),
      chain: t * (fine ? 0.9 : 1.1),
      knots: t * (fine ? 0.9 : 1.05),
    }[kind];
    const samples =
      total < t * 1.4 ? [{ ...s.points[0], angle: 0 }] : resample(s.points, step, s.closed);
    samples.forEach((p, i) => {
      if (kind === 'stem')
        push(items, {
          kind: 'stem',
          x: p.x,
          y: p.y,
          angle: p.angle + 0.45,
          size: t * 1.75,
          color: i % 3 === 2 ? shade(color, -0.1) : color,
        });
      else if (kind === 'back')
        push(items, { kind: 'back', x: p.x, y: p.y, angle: p.angle, size: step * 0.9, color });
      else if (kind === 'chain')
        push(items, { kind: 'chain', x: p.x, y: p.y, angle: p.angle, size: step * 1.3, color });
      else
        push(items, {
          kind: 'knot',
          x: p.x,
          y: p.y,
          angle: rng() * Math.PI * 2,
          size: t * 1.1,
          color,
        });
    });
    reveal.push(samples.map(({ x, y }) => ({ x, y })));
    if (!s.closed && total > t * 4 && s.points.length > 3) {
      const a = s.points[0],
        a2 = s.points[3];
      const b = s.points[s.points.length - 1],
        b2 = s.points[s.points.length - 4];
      tips.push(
        { p: a, dir: Math.atan2(a.y - a2.y, a.x - a2.x) },
        { p: b, dir: Math.atan2(b.y - b2.y, b.x - b2.x) },
      );
    }
  }

  // Small blossoms sprout just beyond stroke tips, outside the letter body.
  const r = Math.min(8, Math.max(3.5, fs * 0.12));
  const used: Point[] = [];
  for (const tip of tips
    .map((x) => ({ x, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.x)) {
    if (flowers >= wanted) break;
    const c = {
      x: tip.p.x + Math.cos(tip.dir) * (r + t * 0.4),
      y: tip.p.y + Math.sin(tip.dir) * (r + t * 0.4),
    };
    if (c.x < 30 || c.x > 330 || c.y < 40 || c.y > 600) continue;
    if (used.some((u) => Math.hypot(u.x - c.x, u.y - c.y) < r * 4)) continue;
    used.push(c);
    const roll = rng();
    if (roll < 0.3) {
      flower('bud', c, r * 1.3, tip.dir);
      leaf(tip.p, tip.dir + 1.1, r * 1.5);
    } else if (roll < 0.65) {
      flower('star', c, r);
      if (rng() < 0.5) leaf(c, tip.dir - 1.2, r * 1.5);
    } else if (roll < 0.85) {
      flower('pompom', c, r * 0.9);
    } else {
      push(flowerItems, {
        kind: 'knot',
        x: c.x,
        y: c.y,
        angle: 0,
        size: t * 1.3,
        color: pickFrom(rng, spec.flowers),
      });
    }
    disc(c, r * 2.2);
    flowers++;
  }
  return {
    items: [...items, ...leafItems, ...flowerItems],
    reveal,
    revealWidth: Math.max(t * 2.8, 6),
    thickness: t,
  };
}

/** Lightens (amount > 0) or darkens a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const out = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(out)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
