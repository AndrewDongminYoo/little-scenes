import type { ScratchState } from '../render/scratch';
export type SceneId = 'embroidery' | 'rain' | 'scratch';
export type Palette = 'meadow' | 'dancheong' | 'red' | 'navy';
export type Writing = 'vertical' | 'horizontal';
export type Settings = {
  scene: SceneId;
  text: string;
  seed: number;
  thread: Palette;
  density: 'fine' | 'normal';
  writing: Writing;
  mood: 'day' | 'night';
  intensity: 1 | 2 | 3;
  coinAngle: 0 | 45 | 90;
};
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
/** Finger trail as flat [x, y, clockMs] triples, oldest first. */
export type Trail = number[];
export type Frame = Settings & {
  scratch?: ScratchState;
  scratchStill?: boolean;
  time: number;
  /** Independent clock for finger-trail restoration, frozen together with exports. */
  interactionTime?: number;
  reveal: number;
  touch: Point & { strength: number };
  trail: Trail;
};
export const TRAIL_POINTS = 40;
export const TRAIL_FADE_MS = 3200;
export function validateText(raw: string): {
  ok: boolean;
  error?: string;
  text: string;
} {
  const text = raw.replace(/\r\n?/g, '\n').normalize('NFC');
  if (!text.trim())
    return {
      ok: false,
      error: '문구를 입력해주세요. 빈 작품은 공유할 수 없어요.',
      text,
    };
  if (text.split('\n').length > 3)
    return { ok: false, error: '문구는 세 줄까지 넣을 수 있어요.', text };
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ\u1100-\u11ffA-Za-z0-9 \n.,!?…:;~/&%\-'"“”‘’()·]+$/u.test(text))
    return {
      ok: false,
      error: '한글·영문·숫자·기본 문장부호만 사용할 수 있어요. 이모지는 지원하지 않아요.',
      text,
    };
  // NFC makes supported Hangul syllables one codepoint; the allowlist excludes combining emoji.
  const count =
    typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].length
      : [...text].length;
  return count > 40
    ? {
        ok: false,
        error: '문구는 공백과 줄바꿈을 포함해 40자까지 넣을 수 있어요.',
        text,
      }
    : { ok: true, text };
}
export function defaults(scene: SceneId): Settings {
  return {
    scene,
    text:
      scene === 'scratch'
        ? '오늘은 당신의 날'
        : scene === 'rain'
          ? '흐르는 대로'
          : '오늘도, 천천히',
    seed: 2731,
    thread: 'meadow',
    density: 'fine',
    writing: 'vertical',
    mood: 'night',
    intensity: 2,
    coinAngle: 45,
  };
}
export function random(seed: number): () => number {
  'worklet';
  // Scramble the seed (murmur3 finaliser) so neighbouring seeds do not start in lockstep.
  let x = seed >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
export function freezeFrame(frame: Frame): Readonly<Frame> {
  return Object.freeze({
    ...frame,
    ...(frame.scratch
      ? {
          scratch: {
            wear: [...frame.scratch.wear],
            flakes: frame.scratch.flakes.map((f) => ({ ...f })),
            removed: frame.scratch.removed,
          },
        }
      : {}),
    touch: Object.freeze({ ...frame.touch }),
    trail: Object.freeze([...frame.trail]) as Trail,
  });
}
const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T => {
  return allowed.includes(value as T) ? (value as T) : fallback;
};
/** Invalid fields fall back one by one so an old or partial record keeps the user's phrase. */
export function decodeSettings(id: SceneId, json: string | null): Settings {
  const base = defaults(id);
  let s: Record<string, unknown>;
  try {
    s = JSON.parse(json ?? 'null');
  } catch {
    return base;
  }
  if (!s || typeof s !== 'object' || s.scene !== id) return base;
  const seed = s.seed;
  return {
    scene: id,
    coinAngle: pick(s.coinAngle, [0, 45, 90] as const, base.coinAngle),
    text: typeof s.text === 'string' && s.text.length <= 500 ? s.text : base.text,
    seed:
      typeof seed === 'number' && Number.isInteger(seed) && seed >= 0 && seed <= 4294967295
        ? seed
        : base.seed,
    thread: pick(s.thread, ['meadow', 'dancheong', 'red', 'navy'] as const, base.thread),
    density: pick(s.density, ['fine', 'normal'] as const, base.density),
    writing: pick(s.writing, ['vertical', 'horizontal'] as const, base.writing),
    mood: pick(s.mood, ['day', 'night'] as const, base.mood),
    intensity: pick(s.intensity, [1, 2, 3] as const, base.intensity),
  };
}
/** Opacity of a finger-trail point at clock `now`; future points (clock reset) are gone. */
export function trailAlpha(now: number, at: number): number {
  'worklet';
  const age = now - at;
  if (age < 0 || age >= TRAIL_FADE_MS) return 0;
  const k = 1 - age / TRAIL_FADE_MS;
  return k * k * (3 - 2 * k);
}
export function pushTrail(trail: Trail, x: number, y: number, now: number) {
  'worklet';
  const n = trail.length;
  if (n >= 3) {
    const dx = trail[n - 3] - x,
      dy = trail[n - 2] - y;
    if (dx * dx + dy * dy < 16 && now - trail[n - 1] < 120) return trail;
  }
  const next = trail.length >= TRAIL_POINTS * 3 ? trail.slice(3) : trail.slice();
  next.push(x, y, now);
  return next;
}
export function nextClock(time: number, delta: number, active: boolean, scene: SceneId): number {
  'worklet';
  return active ? (scene === 'embroidery' ? Math.min(1600, time + delta) : time + delta) : time;
}
export function fitRect(width: number, height: number): Rect {
  'worklet';
  const scale = Math.max(0, Math.min(width / 360, height / 640));
  return {
    x: (width - 360 * scale) / 2,
    y: (height - 640 * scale) / 2,
    width: 360 * scale,
    height: 640 * scale,
  };
}
export function toLogicalPoint(p: Point, r: Rect): Point | null {
  'worklet';
  if (
    !r.width ||
    !r.height ||
    p.x < r.x ||
    p.y < r.y ||
    p.x > r.x + r.width ||
    p.y > r.y + r.height
  )
    return null;
  return {
    x: ((p.x - r.x) * 360) / r.width,
    y: ((p.y - r.y) * 640) / r.height,
  };
}

export function advanceClocks(
  time: number,
  interactionTime: number,
  delta: number,
  playing: boolean,
  touching: boolean,
  scene: SceneId,
) {
  'worklet';
  return {
    time: nextClock(time, delta, playing, scene),
    interactionTime: touching ? interactionTime + delta : interactionTime,
  };
}
