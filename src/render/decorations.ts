import type { Point } from '../domain/model';
import type { Stroke } from './strokes';
export type DecorationCircle = Point & { radius: number; ignoreStroke?: number };
function segmentDistance(p: Point, a: Point, b: Point) {
  'worklet';
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = dx * dx + dy * dy;
  const t = d ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Conservative decoration envelopes protect letter readability; no forced placement. */
export function fitsDecoration(
  c: DecorationCircle,
  strokes: Stroke[],
  occupied: DecorationCircle[],
  clearance: number,
  ignoreStroke = -1,
) {
  'worklet';
  if (c.x - c.radius < 30 || c.x + c.radius > 330 || c.y - c.radius < 40 || c.y + c.radius > 600)
    return false;
  if (occupied.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.radius + c.radius + clearance))
    return false;
  for (let index = 0; index < strokes.length; index++) {
    if (index === ignoreStroke) continue;
    const s = strokes[index],
      n = s.points.length;
    for (let i = 0; i < n; i++) {
      const a = s.points[i],
        b = s.points[(i + 1) % n];
      if (!s.closed && i === n - 1) {
        if (Math.hypot(c.x - a.x, c.y - a.y) < c.radius + clearance) return false;
      } else if (segmentDistance(c, a, b) < c.radius + clearance) return false;
    }
  }
  return true;
}
