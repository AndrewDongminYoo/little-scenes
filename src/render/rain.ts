import { random, type Point } from '../domain/model.ts';
import { resample, type Stroke } from './strokes.ts';

export type Drop = { x: number; y: number; r: number; stretch: number };
export type Drip = { points: Point[]; bead: Drop };

/** 1: drops run downward (gravity), -1: upward. One switch for the whole scene. */
export const RAIN_DIRECTION: 1 | -1 = 1;
export const RUNNING_FIELDS = 6;
/** Atlas arrays keep this fixed length so sprites and per-frame transforms never disagree. */
export const RUNNING_MAX = 12;

/** Static condensation on the glass, from many fine beads to a few large lenses. */
export function condensation(seed: number, intensity: 1 | 2 | 3): Drop[] {
  const rng = random(seed ^ 0xd209);
  const fine = [900, 1300, 1800][intensity - 1];
  const medium = [160, 260, 380][intensity - 1];
  const large = [18, 34, 55][intensity - 1];
  const drops: Drop[] = [];
  for (let i = 0; i < fine; i++)
    drops.push({
      x: rng() * 360,
      y: rng() * 640,
      r: 0.3 + rng() ** 2 * 0.6,
      stretch: 1 + rng() * 0.15,
    });
  for (let i = 0; i < medium; i++)
    drops.push({
      x: rng() * 360,
      y: rng() * 640,
      r: 0.95 + rng() ** 1.5 * 1.6,
      stretch: 1.02 + rng() * 0.2,
    });
  for (let i = 0; i < large; i++)
    drops.push({
      x: rng() * 360,
      y: rng() * 640,
      r: 2.6 + rng() ** 1.6 * 2.6,
      stretch: 1.08 + rng() * 0.3,
    });
  return drops;
}

/** Beads left along the edges of the finger stroke, and drips that ran down from it. */
export function wipeEdges(
  strokes: Stroke[],
  width: number,
  seed: number,
): { beads: Drop[]; drips: Drip[] } {
  const rng = random(seed ^ 0xb3ad);
  const beads: Drop[] = [];
  const drips: Drip[] = [];
  for (const s of strokes) {
    if (s.points.length < 2) continue;
    for (const p of resample(s.points, 2.2, s.closed)) {
      for (const side of [-1, 1]) {
        if (rng() > 0.35) continue;
        const r = 0.35 + rng() ** 2 * width * 0.16;
        const off = width / 2 + r * (0.4 + rng() * 0.8);
        const n = p.angle + (side * Math.PI) / 2;
        beads.push({
          x: p.x + Math.cos(n) * off,
          y: p.y + Math.sin(n) * off,
          r,
          stretch: 1 + rng() * 0.2,
        });
      }
    }
    // Water gathers at the lowest points of a stroke and runs down.
    const pts = s.points;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 4)],
        next = pts[Math.min(pts.length - 1, i + 4)];
      const lowest = pts[i].y >= prev.y && pts[i].y >= next.y;
      const end = !s.closed && (i === 0 || i === pts.length - 1);
      if (!(lowest || end) || rng() > (end ? 0.45 : 0.08)) continue;
      const start = { x: pts[i].x + (rng() - 0.5) * width * 0.4, y: pts[i].y + width * 0.38 };
      const len = width * (1.2 + rng() ** 1.5 * 6);
      const wobble = rng() * 6.28;
      const path: Point[] = [];
      for (let d = 0; d <= len; d += 2)
        path.push({ x: start.x + Math.sin(d * 0.12 + wobble) * 0.7, y: start.y + d });
      const end2 = path[path.length - 1];
      drips.push({
        points: path,
        bead: { x: end2.x, y: end2.y + 0.8, r: width * (0.2 + rng() * 0.12), stretch: 1.25 },
      });
    }
  }
  return { beads, drips };
}

/** Flat [x, phase, speed, trail, radius, wobble] per running drop. */
export function runningDrops(seed: number, intensity: 1 | 2 | 3): number[] {
  const rng = random(seed ^ 0x7a1f);
  const out: number[] = [];
  for (let i = 0; i < intensity * 4; i++)
    out.push(
      10 + rng() * 340,
      rng() * 2000,
      28 + rng() * 85,
      50 + rng() * 170,
      1.8 + rng() * 1.6,
      rng() * 6.28,
    );
  return out;
}

/** Head position of running drop `i` at clock `ms`; `travel` is the distance along its run. */
export function runningHead(
  params: number[],
  i: number,
  ms: number,
): { x: number; y: number; travel: number } {
  'worklet';
  const o = i * RUNNING_FIELDS;
  const span = 640 + params[o + 3] + 80;
  const travel = (params[o + 1] + (params[o + 2] * ms) / 1000) % span;
  const along = travel - 40;
  const y = RAIN_DIRECTION === 1 ? along : 640 - along;
  return { x: params[o] + Math.sin(y * 0.045 + params[o + 5]) * 1.6, y, travel };
}
