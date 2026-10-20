import type { Point } from '../domain/model';
import type { SkiaApi } from './resources';

export const FOIL = { x: 45, y: 294, width: 270, height: 144 };
export const CELL = 2;
export const COLS = 135;
export const ROWS = 72;
export const CELL_COUNT = COLS * ROWS;
export const MAX_FLAKES = 96;
export const FLAKE_MS = 1250;
export type Flake = Point & { at: number; vx: number; vy: number; size: number; spin: number };
export type ScratchState = { wear: number[]; flakes: Flake[]; removed: number };
export function createScratch(): ScratchState {
  'worklet';
  return { wear: Array(CELL_COUNT).fill(0), flakes: [], removed: 0 };
}
export function revealScratch(): ScratchState {
  'worklet';
  return { wear: Array(CELL_COUNT).fill(1), flakes: [], removed: CELL_COUNT };
}
function grain(x: number, y: number, seed: number): number {
  'worklet';
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Sweep an oriented, flattened coin edge, NOT a disk brush. Work is bounded by the foil grid.
 * Ellipse radii 17×2.2 give a fine cut along the edge, a broad scrape across it.
 * Partial wear and fixed material grain survive a first pass. Re-scraping removes them. */
export function scrape(
  s: ScratchState,
  from: Point,
  to: Point,
  degrees: number,
  now: number,
  seed: number,
  mode: 'fall' | 'stay' = 'fall',
): ScratchState {
  'worklet';
  if (![from.x, from.y, to.x, to.y, degrees, now].every(Number.isFinite)) return s;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return s;
  const minX = Math.max(0, Math.floor((Math.min(from.x, to.x) - 18 - FOIL.x) / CELL));
  const maxX = Math.min(COLS - 1, Math.ceil((Math.max(from.x, to.x) + 18 - FOIL.x) / CELL));
  const minY = Math.max(0, Math.floor((Math.min(from.y, to.y) - 18 - FOIL.y) / CELL));
  const maxY = Math.min(ROWS - 1, Math.ceil((Math.max(from.y, to.y) + 18 - FOIL.y) / CELL));

  const a = (degrees * Math.PI) / 180,
    c = Math.cos(a),
    sn = Math.sin(a);
  const ux = (dx * c + dy * sn) / 17,
    uy = (-dx * sn + dy * c) / 2.2;
  const len = ux * ux + uy * uy;
  const wear = s.wear.slice();
  let moved = false;
  // Sweep the coin's flattened edge expanded by chip radius, including bare paper.
  const push = (f: Flake): Flake => {
    'worklet';
    if (mode !== 'stay') return f;
    const rx = 17 + f.size,
      ry = 2.2 + f.size;
    const ex = ((f.x - from.x) * c + (f.y - from.y) * sn) / rx;
    const ey = (-(f.x - from.x) * sn + (f.y - from.y) * c) / ry;
    const vx = (dx * c + dy * sn) / rx,
      vy = (-dx * sn + dy * c) / ry;
    const length = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, (ex * vx + ey * vy) / length));
    if (Math.hypot(ex - t * vx, ey - t * vy) >= 1) return f;
    // Move only contacted material to the leading edge, without gravity or inertia.
    const projection = (ex * vx + ey * vy) / length;
    const perpendicular = Math.max(0, ex * ex + ey * ey - projection * projection * length);
    const exit = projection + Math.sqrt(Math.max(0, 1 - perpendicular) / length);
    const shift = Math.max(0, 1 - projection + exit - projection);
    moved = true;
    return { ...f, x: f.x + dx * shift, y: f.y + dy * shift, spin: f.spin + 0.3, at: now };
  };
  const flakes = s.flakes.map(push);
  let removed = s.removed,
    changed = false,
    chips = 0;
  const emitted: Flake[] = [];
  for (let row = minY; row <= maxY; row++)
    for (let col = minX; col <= maxX; col++) {
      const i = row * COLS + col;
      if (wear[i] >= 1) continue;
      const x = FOIL.x + (col + 0.5) * CELL,
        y = FOIL.y + (row + 0.5) * CELL;
      const px = x - from.x,
        py = y - from.y;
      const ex = (px * c + py * sn) / 17,
        ey = (-px * sn + py * c) / 2.2;
      const t = Math.max(0, Math.min(1, (ex * ux + ey * uy) / len));
      const d = Math.hypot(ex - t * ux, ey - t * uy);
      if (d >= 1) continue;
      const g = grain(col, row, seed);
      const amount = (0.88 + 0.48 * g) * Math.pow(1 - d, 0.25);
      const old = wear[i];
      wear[i] = Math.min(1, old + amount);
      changed = true;
      if (old < 0.75 && wear[i] >= 0.75) {
        removed++;
        // Material is emitted only on first removal, never from already bare paper.
        if ((i + seed) % 19 === 0) {
          const f = {
            x,
            y,
            at: now,
            vx: (dx / distance) * (12 + g * 20),
            vy: (dy / distance) * 18 - 10,
            size: 1 + g * 2,
            spin: g * 6.28,
          };
          chips++;
          const slot = Math.floor(grain(i, chips, seed + 3) * chips);
          if (emitted.length < 5) emitted.push(f);
          else if (slot < 5) emitted[slot] = f;
        }
      }
    }
  return changed || moved
    ? { wear, removed, flakes: [...flakes, ...emitted.map(push)].slice(-MAX_FLAKES) }
    : s;
}
/** Three masks rebuilt only after a scrape; row runs avoid an ever-growing stroke history. */
export function scratchPaths(api: SkiaApi, s: ScratchState) {
  'worklet';
  const builders = [api.PathBuilder.Make(), api.PathBuilder.Make(), api.PathBuilder.Make()];
  for (let row = 0; row < ROWS; row++) {
    let start = 0,
      previous = -1;
    for (let col = 0; col <= COLS; col++) {
      const v = col < COLS ? s.wear[row * COLS + col] : 0;
      const level = v >= 0.75 ? 2 : v >= 0.38 ? 1 : v > 0 ? 0 : -1;
      if (level !== previous) {
        if (previous >= 0) {
          const x = FOIL.x + start * CELL,
            y = FOIL.y + row * CELL;
          const b = builders[previous];
          // Overlap row runs: anti-aliased internal seams must not become a brick texture.
          b.addRect(api.XYWHRect(x - 0.15, y - 0.15, (col - start) * CELL + 0.3, CELL + 0.3));
        }
        start = col;
        previous = level;
      }
    }
  }
  const paths = builders.map((b) => {
    const p = b.detach();
    b.dispose();
    return p;
  });
  return { scuffed: paths[0], worn: paths[1], open: paths[2] };
}
export function flakePosition(
  f: Flake,
  now: number,
  still = false,
  mode: 'fall' | 'stay' = 'fall',
) {
  'worklet';
  if (mode === 'stay') return { x: f.x, y: f.y, spin: f.spin };
  const t = still ? 1.1 : Math.min(1.1, Math.max(0, (now - f.at - 100) / 1000));
  return {
    x: f.x + f.vx * t * 0.45,
    y: Math.min(510 - f.size, f.y + f.vy * t + 70 * t * t),
    spin: f.spin + t * 4,
  };
}
/** Scraped foil collects briefly, then tumbles down. Settled chips remain; finite history caps cost. */
export function flakePaths(
  api: SkiaApi,
  flakes: Flake[],
  now: number,
  still = false,
  mode: 'fall' | 'stay' = 'fall',
) {
  'worklet';
  const dark = api.PathBuilder.Make(),
    light = api.PathBuilder.Make();
  for (const f of flakes) {
    const position = flakePosition(f, now, still, mode);
    const x = position.x,
      y = position.y;
    const angle = position.spin,
      c = Math.cos(angle),
      sn = Math.sin(angle),
      r = f.size;
    const b = dark;
    b.moveTo(x - r * c, y - r * sn)
      .lineTo(x + r * 0.1, y - r * 0.3)
      .lineTo(x + r * c, y + r * sn)
      .lineTo(x + r * 0.45, y + r * 0.4)
      .lineTo(x + r * 0.8, y + r * 0.8)
      .lineTo(x - r * 0.2, y + r * 0.6)
      .lineTo(x - r * 0.7, y + r * 0.8)
      .close();
    light
      .moveTo(x - r * c, y - r * sn - 0.5)
      .lineTo(x + r * 0.6 * c, y + r * 0.6 * sn - 0.5)
      .lineTo(x, y + r * 0.25)
      .close();
  }
  const result = { dark: dark.detach(), light: light.detach() };
  dark.dispose();
  light.dispose();
  return result;
}
