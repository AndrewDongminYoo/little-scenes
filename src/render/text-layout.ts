import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { Writing } from '../domain/model.ts';
import type { SkiaApi } from './resources';

/** Pixels per logical unit for the analysis mask. */
export const MASK_SCALE = 2;
const W = 360,
  H = 640;
const AREA = { x: 40, y: 64, width: 280, height: 512 };

export type TextLayout = {
  alpha: Uint8Array;
  width: number;
  height: number;
  scale: number;
  fontSize: number;
  writing: Writing;
  /** Logical centre of every grapheme cell in reading order (vertical only). */
  cells: { x: number; y: number }[];
};

export const VERTICAL_PITCH = 1.02;
export const COLUMN_PITCH = 1.3;

const UPPER_RIGHT = [',', '.', '、', '。'];
const ROTATED = ['(', ')', '-', '~', '…', '“', '”', '‘', '’', '"', "'"];

const segment = (text: string) => {
  'worklet';
  return typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment)
    : [...text];
};

/** Keep trailing punctuation with its preceding grapheme in vertical layout. */
export function verticalGlyphs(text: string): string[] {
  'worklet';
  const out: string[] = [];
  for (const glyph of segment(text)) {
    if (out.length && /[.,!?…:;、。]/u.test(glyph)) out[out.length - 1] += glyph;
    else out.push(glyph);
  }
  return out;
}

/** Fills columns word by word; only a word longer than a column is split. */
export function wrapColumns(words: string[][], rows: number): string[][] {
  'worklet';
  const columns: string[][] = [];
  let col: string[] = [];
  for (const word of words) {
    const gap = col.length ? 1 : 0;
    if (col.length + gap + word.length <= rows) {
      if (gap) col.push(' ');
      col.push(...word);
      continue;
    }
    if (col.length) columns.push(col);
    col = [];
    for (let i = 0; i < word.length; i += rows) {
      const part = word.slice(i, i + rows);
      if (part.length === rows && i + rows < word.length) columns.push(part);
      else col = part;
    }
  }
  columns.push(col);
  return columns;
}

export function layoutText(
  api: SkiaApi,
  fonts: SkTypefaceFontProvider,
  text: string,
  writing: Writing,
  weight: number,
  maxSize = 72,
): TextLayout {
  'worklet';
  const families = ['Handwritten', 'LittleScenes'];
  const paragraph = (value: string, fontSize: number, width: number) => {
    const builder = api.ParagraphBuilder.Make({ textAlign: 2 }, fonts);
    builder
      .pushStyle({
        fontFamilies: families,
        fontSize,
        color: api.Color('white'),
        heightMultiplier: 1.22,
        fontStyle: { weight },
      })
      .addText(value);
    // The native ParagraphBuilder has no dispose(), despite its type declaration.
    const p = builder.build();
    p.layout(width);
    return p;
  };
  const w = W * MASK_SCALE,
    h = H * MASK_SCALE;
  const surface = api.Surface.Make(w, h);
  if (!surface) throw new Error('텍스트 이미지를 준비하지 못했어요.');
  const canvas = surface.getCanvas();
  canvas.clear(api.Color('transparent'));
  canvas.save();
  canvas.scale(MASK_SCALE, MASK_SCALE);
  let fontSize = 0;
  const cells: { x: number; y: number }[] = [];
  const lines = text.split('\n');
  if (writing === 'horizontal') {
    for (let size = maxSize; size >= 20; size -= 2) {
      const p = paragraph(text, size, AREA.width);
      const metrics = p.getLineMetrics();
      // Skia breaks Hangul between any syllables; prefer a size where soft breaks fall
      // between words, and accept mid-word breaks only at the smallest size.
      const wordBreaks = metrics.every(
        (m) =>
          m.isHardBreak ||
          m.endIndex >= text.length ||
          /\s/.test(text[m.endExcludingWhitespaces] ?? ' '),
      );
      if (
        p.getHeight() <= AREA.height * 0.6 &&
        metrics.length <= Math.max(lines.length, 4) &&
        p.getLongestLine() <= AREA.width + 0.5 &&
        (wordBreaks || size === 20)
      ) {
        p.paint(canvas, AREA.x, (H - p.getHeight()) / 2);
        p.dispose();
        fontSize = size;
        break;
      }
      p.dispose();
    }
  } else {
    const words = lines.map((line) => line.split(' ').filter(Boolean).map(verticalGlyphs));
    for (let size = maxSize; size >= 20; size -= 2) {
      const pitch = size * VERTICAL_PITCH,
        colPitch = size * COLUMN_PITCH;
      const rows = Math.floor(AREA.height / pitch);
      const columns = words.flatMap((line) => wrapColumns(line, rows));
      if ((columns.length - 1) * colPitch + size > AREA.width) continue;
      fontSize = size;
      const tallest = Math.max(1, ...columns.map((c) => c.length));
      const top = (H - tallest * pitch) / 2;
      columns.forEach((col, c) => {
        const cx = W / 2 + ((columns.length - 1) / 2 - c) * colPitch;
        col.forEach((g, r) => {
          const cy = top + (r + 0.5) * pitch;
          cells.push({ x: cx, y: cy });
          if (g === ' ') return;
          // Centred alignment inside a 3em box, so painting at -1.5em centres the glyph.
          const cluster = segment(g);
          for (let index = 0; index < cluster.length; index++) {
            const char = cluster[index];
            const p = paragraph(char, size, size * 3);
            const gh = p.getHeight();
            canvas.save();
            if (UPPER_RIGHT.includes(char) || index > 0) {
              canvas.translate(cx + size * (0.3 + Math.max(0, index - 1) * 0.22), cy - size * 0.3);
            } else {
              canvas.translate(cx, cy);
              if (ROTATED.includes(char)) canvas.rotate(90, 0, 0);
            }
            p.paint(canvas, -size * 1.5, -gh / 2);
            canvas.restore();
            p.dispose();
          }
        });
      });
      break;
    }
  }
  canvas.restore();
  if (!fontSize) {
    surface.dispose();
    throw new Error('글자가 작품 영역에 들어가지 않아요. 문구를 조금 줄여주세요.');
  }
  surface.flush();
  const image = surface.makeImageSnapshot();
  const rgba = image.readPixels();
  image.dispose();
  surface.dispose();
  if (!(rgba instanceof Uint8Array)) throw new Error('텍스트 픽셀을 읽지 못했어요.');
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return { alpha, width: w, height: h, scale: MASK_SCALE, fontSize, writing, cells };
}
