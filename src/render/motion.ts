import type { SkColor, SkPath, SkRSXform } from '@shopify/react-native-skia';
import { TRAIL_POINTS, trailAlpha, type Frame, type Trail } from '../domain/model';
import { RAIN_DIRECTION, RUNNING_FIELDS, RUNNING_MAX, runningHead } from './rain';
import type { SkiaApi } from './resources';
import { placeSprite } from './sprites';

export type Transform = { translateX: number } | { translateY: number };
export const TOUCH_RADIUS = 15;

/** Shadow shifts away from the finger as if it were a lamp; eases back with `strength`. */
export function shadowOffset(x: number, y: number, strength: number): Transform[] {
  'worklet';
  const dx = strength > 0 ? ((x - 180) / 180) * strength : 0,
    dy = strength > 0 ? ((y - 320) / 320) * strength : 0;
  return [{ translateX: 0.9 - dx * 1.8 }, { translateY: 1.3 - dy * 1.8 }];
}
export function glossOffset(x: number, y: number, strength: number): Transform[] {
  'worklet';
  const dx = strength > 0 ? ((x - 180) / 180) * strength : 0,
    dy = strength > 0 ? ((y - 320) / 320) * strength : 0;
  return [{ translateX: dx * 0.7 }, { translateY: dy * 0.7 }];
}

/** Clear tracks left above (behind) each running drop. */
export function runningTrails(api: SkiaApi, params: number[], ms: number): SkPath {
  'worklet';
  const b = api.PathBuilder.Make();
  const count = params.length / RUNNING_FIELDS;
  for (let i = 0; i < count; i++) {
    const o = i * RUNNING_FIELDS;
    const head = runningHead(params, i, ms);
    const len = Math.min(params[o + 3], head.travel);
    if (len < 2) continue;
    let first = true;
    for (let d = len; d >= 0; d -= 6) {
      const y = head.y - RAIN_DIRECTION * d;
      const x = params[o] + Math.sin(y * 0.045 + params[o + 5]) * 1.6;
      if (first) b.moveTo(x, y);
      else b.lineTo(x, y);
      first = false;
    }
    b.lineTo(head.x, head.y);
  }
  const path = b.detach();
  b.dispose();
  return path;
}

export function runningXforms(api: SkiaApi, params: number[], ms: number): SkRSXform[] {
  'worklet';
  const out: SkRSXform[] = [];
  const count = Math.min(RUNNING_MAX, params.length / RUNNING_FIELDS);
  for (let i = 0; i < RUNNING_MAX; i++) {
    if (i >= count) {
      out.push(api.RSXform(0, 0, -100, -100));
      continue;
    }
    const head = runningHead(params, i, ms);
    out.push(
      placeSprite(api, 'drop', head.x, head.y, Math.PI / 2, params[i * RUNNING_FIELDS + 4] * 2.3),
    );
  }
  return out;
}

export function trailXforms(api: SkiaApi, trail: Trail): SkRSXform[] {
  'worklet';
  const out: SkRSXform[] = [];
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const o = i * 3;
    out.push(
      o + 2 < trail.length
        ? placeSprite(api, 'soft', trail[o], trail[o + 1], 0, TOUCH_RADIUS * 2.4)
        : api.RSXform(0, 0, -100, -100),
    );
  }
  return out;
}
export function trailColors(trail: Trail, now: number): SkColor[] {
  'worklet';
  const out: SkColor[] = [];
  for (let i = 0; i < TRAIL_POINTS; i++) {
    const o = i * 3;
    const a = o + 2 < trail.length ? trailAlpha(now, trail[o + 2]) : 0;
    out.push(new Float32Array([0, 0, 0, a]));
  }
  return out;
}

export type MotionValues = {
  reveal: number;
  shadow: Transform[];
  gloss: Transform[];
  runningPath: SkPath;
  runningXforms: SkRSXform[];
  trailXforms: SkRSXform[];
  trailColors: SkColor[];
};

/** Everything the artwork needs for one fixed frame (export, previews, render checks). */
export function frameMotion(api: SkiaApi, frame: Readonly<Frame>, running: number[]): MotionValues {
  return {
    reveal: frame.reveal,
    shadow: shadowOffset(frame.touch.x, frame.touch.y, frame.touch.strength),
    gloss: glossOffset(frame.touch.x, frame.touch.y, frame.touch.strength),
    runningPath: runningTrails(api, running, frame.time),
    runningXforms: runningXforms(api, running, frame.time),
    trailXforms: trailXforms(api, frame.trail),
    trailColors: trailColors(frame.trail, frame.interactionTime ?? frame.time),
  };
}
