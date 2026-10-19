import type { Point } from '../domain/model.ts';

export type Stroke = { points: Point[]; closed: boolean };

/**
 * Zhang–Suen thinning over the foreground list only, followed by one pass that
 * removes staircase corners. `bin` must have a zero one-pixel border.
 */
export function thin(bin: Uint8Array, w: number, h: number): Uint8Array {
  'worklet';
  const img = bin.slice();
  let fg: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) if (img[y * w + x]) fg.push(y * w + x);
  const del: number[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      del.length = 0;
      for (const i of fg) {
        if (!img[i]) continue;
        const p2 = img[i - w],
          p3 = img[i - w + 1],
          p4 = img[i + 1],
          p5 = img[i + w + 1],
          p6 = img[i + w],
          p7 = img[i + w - 1],
          p8 = img[i - 1],
          p9 = img[i - w - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        const a =
          +(!p2 && !!p3) +
          +(!p3 && !!p4) +
          +(!p4 && !!p5) +
          +(!p5 && !!p6) +
          +(!p6 && !!p7) +
          +(!p7 && !!p8) +
          +(!p8 && !!p9) +
          +(!p9 && !!p2);
        if (a !== 1) continue;
        if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(i);
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
    fg = fg.filter((i) => img[i]);
  }
  // A pixel whose neighbours stay one 8-connected group is redundant (staircase corner).
  for (const i of fg) {
    const ring = neighbours(i, w).filter((j) => img[j]);
    if (ring.length >= 2 && components(ring, w) === 1) img[i] = 0;
  }
  return img;
}

const neighbours = (i: number, w: number) => {
  'worklet';
  return [i - w - 1, i - w, i - w + 1, i + 1, i + w + 1, i + w, i + w - 1, i - 1];
};
const adjacent = (a: number, b: number, w: number) => {
  'worklet';
  const dx = Math.abs((a % w) - (b % w)),
    dy = Math.abs(Math.floor(a / w) - Math.floor(b / w));
  return dx <= 1 && dy <= 1 && a !== b;
};
function components(set: number[], w: number) {
  'worklet';
  const seen = new Set<number>();
  let count = 0;
  for (const s of set) {
    if (seen.has(s)) continue;
    count++;
    const stack = [s];
    seen.add(s);
    while (stack.length) {
      const c = stack.pop()!;
      for (const o of set)
        if (!seen.has(o) && adjacent(c, o, w)) {
          seen.add(o);
          stack.push(o);
        }
    }
  }
  return count;
}

/** Traces a one-pixel skeleton into open segments (node to node) and closed loops. */
export function trace(sk: Uint8Array, w: number, h: number): Stroke[] {
  'worklet';
  const degree = new Uint8Array(sk.length);
  const pixels: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!sk[i]) continue;
      pixels.push(i);
      let d = 0;
      for (const j of neighbours(i, w)) d += sk[j];
      degree[i] = d;
    }
  const isNode = (i: number) => degree[i] !== 2;
  const visited = new Uint8Array(sk.length);
  const toPoints = (path: number[]) => path.map((i) => ({ x: i % w, y: Math.floor(i / w) }));
  // Prefer orthogonal steps so diagonal shortcuts do not skip pixels.
  const order = (i: number) => {
    const n = neighbours(i, w);
    return [n[1], n[3], n[5], n[7], n[0], n[2], n[4], n[6]];
  };
  const out: Stroke[] = [];
  const edges = new Set<string>();
  for (const start of pixels) {
    if (!isNode(start)) continue;
    if (degree[start] === 0) {
      out.push({ points: toPoints([start]), closed: false });
      continue;
    }
    for (const first of order(start)) {
      if (!sk[first]) continue;
      if (isNode(first)) {
        const key = start < first ? `${start}:${first}` : `${first}:${start}`;
        if (!edges.has(key)) edges.add(key);
        continue;
      }
      if (visited[first]) continue;
      const path = [start, first];
      visited[first] = 1;
      let prev = start,
        cur = first;
      for (;;) {
        let next = -1;
        for (const n of order(cur)) {
          if (!sk[n] || n === prev || n === start) continue;
          if (isNode(n)) {
            next = n;
            break;
          }
          if (!visited[n]) {
            next = n;
            break;
          }
        }
        if (next < 0) {
          // Returned to the starting node: a loop hanging off one junction.
          if (path.length > 3 && order(cur).includes(start)) path.push(start);
          break;
        }
        path.push(next);
        if (isNode(next)) break;
        visited[next] = 1;
        prev = cur;
        cur = next;
      }
      out.push({ points: toPoints(path), closed: false });
    }
  }
  for (const start of pixels) {
    if (isNode(start) || visited[start]) continue;
    const path = [start];
    visited[start] = 1;
    let cur = start;
    for (;;) {
      const next = order(cur).find((n) => sk[n] && !visited[n] && !isNode(n));
      if (next === undefined) break;
      visited[next] = 1;
      path.push(next);
      cur = next;
    }
    if (path.length > 2) out.push({ points: toPoints(path), closed: true });
  }
  // Drop short spurs (endpoint → junction) produced by thinning blobby glyph corners.
  return out.filter((s) => {
    const a = s.points[0],
      b = s.points[s.points.length - 1];
    const da = degree[a.y * w + a.x],
      db = degree[b.y * w + b.x];
    const spur = (da === 1 && db >= 3) || (db === 1 && da >= 3);
    return !(spur && s.points.length < 6) && !(s.points.length === 2 && da >= 3 && db >= 3);
  });
}

export function smooth(points: Point[], closed: boolean, radius = 2): Point[] {
  'worklet';
  if (points.length < 3) return points;
  let cur = points;
  for (let pass = 0; pass < 2; pass++) {
    const n = cur.length;
    cur = cur.map((p, i) => {
      if (!closed && (i === 0 || i === n - 1)) return p;
      let sx = 0,
        sy = 0,
        c = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = closed ? (i + k + n) % n : Math.min(n - 1, Math.max(0, i + k));
        sx += cur[j].x;
        sy += cur[j].y;
        c++;
      }
      return { x: sx / c, y: sy / c };
    });
  }
  return cur;
}

export function length(points: Point[], closed = false): number {
  'worklet';
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  if (closed && points.length > 2) {
    const a = points[0],
      b = points[points.length - 1];
    total += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return total;
}

/** Evenly spaced samples with their tangent angle. */
export function resample(
  points: Point[],
  step: number,
  closed = false,
): { x: number; y: number; angle: number }[] {
  'worklet';
  const pts = closed && points.length > 2 ? [...points, points[0]] : points;
  if (pts.length === 1) return [{ ...pts[0], angle: 0 }];
  const total = length(pts);
  const count = Math.max(1, Math.round(total / step));
  const out: { x: number; y: number; angle: number }[] = [];
  let seg = 1,
    segStart = 0;
  for (let k = 0; k <= count - (closed ? 1 : 0); k++) {
    const d = (k / count) * total;
    while (seg < pts.length - 1) {
      const len = Math.hypot(pts[seg].x - pts[seg - 1].x, pts[seg].y - pts[seg - 1].y);
      if (segStart + len >= d) break;
      segStart += len;
      seg++;
    }
    const a = pts[seg - 1],
      b = pts[seg];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = Math.min(1, Math.max(0, (d - segStart) / len));
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    });
  }
  return out;
}

/**
 * Glyph alpha (row-major, `scale` pixels per logical unit) → smoothed centreline
 * strokes in logical units, plus the mean ink width.
 */
export function extractStrokes(
  alpha: Uint8Array,
  w: number,
  h: number,
  scale: number,
): { strokes: Stroke[]; inkWidth: number } {
  'worklet';
  const bin = new Uint8Array(w * h);
  let area = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (alpha[y * w + x] > 110) {
        bin[y * w + x] = 1;
        area++;
      }
  const sk = thin(bin, w, h);
  let skeleton = 0;
  for (let i = 0; i < sk.length; i++) skeleton += sk[i];
  const strokes = trace(sk, w, h).map((s) => ({
    closed: s.closed,
    points: smooth(s.points, s.closed).map((p) => ({ x: p.x / scale, y: p.y / scale })),
  }));
  return { strokes, inkWidth: skeleton ? area / skeleton / scale : 0 };
}
