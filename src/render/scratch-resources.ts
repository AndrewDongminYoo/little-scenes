import {
  PaintStyle,
  TileMode,
  type SkImage,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import type { Settings } from '../domain/model';
import { random } from '../domain/model';
import type { SkiaApi } from './resources';
import { FOIL } from './scratch';
export type ScratchResources = {
  scene: 'scratch';
  paper: SkImage;
  foil: SkImage;
  fontSize: number;
};
/** All static paper, typography and metallic grain are baked once off the UI thread. */
export function prepareScratch(
  api: SkiaApi,
  fonts: SkTypefaceFontProvider,
  s: Settings,
): ScratchResources {
  'worklet';
  const surface = api.Surface.Make(1080, 1920);
  if (!surface) throw new Error('복권 이미지를 준비하지 못했어요.');
  try {
    const canvas = surface.getCanvas();
    canvas.scale(3, 3);
    const p = api.Paint();
    p.setAntiAlias(true);
    const rect = (x: number, y: number, w: number, h: number, color: string, r = 0) => {
      p.setShader(null);
      p.setColor(api.Color(color));
      p.setStyle(PaintStyle.Fill);
      canvas.drawRRect(api.RRectXY(api.XYWHRect(x, y, w, h), r, r), p);
    };
    const text = (
      value: string,
      y: number,
      size: number,
      color: string,
      width = 270,
      x = 45,
      weight = 500,
    ) => {
      const builder = api.ParagraphBuilder.Make({ textAlign: 2 }, fonts);
      builder
        .pushStyle({
          fontFamilies: weight >= 700 ? ['Handwritten'] : ['LittleScenes'],
          fontSize: size,
          color: api.Color(color),
          fontStyle: { weight },
          heightMultiplier: 1.3,
        })
        .addText(value);
      const paragraph = builder.build();
      paragraph.layout(width);
      paragraph.paint(canvas, x, y);
      const h = paragraph.getHeight();
      paragraph.dispose();
      return h;
    };
    rect(0, 0, 360, 640, '#e8e3d9');
    rect(25, 87, 314, 485, '#cec6b7', 12);
    rect(22, 80, 314, 485, '#fff9e9', 12);
    rect(22, 80, 314, 148, '#bd4635', 12);
    rect(22, 210, 314, 18, '#bd4635');
    const rng = random(s.seed);
    // Screen-print flecks and paper fibres rather than a flat digital card.
    for (let i = 0; i < 3800; i++) {
      p.setColor(api.Color(i % 2 ? '#614d3510' : '#ffffff30'));
      canvas.drawCircle(24 + rng() * 310, 82 + rng() * 480, 0.1 + rng() * 0.45, p);
    }
    text('LITTLE SCENES  /  SCRATCH CARD', 106, 8, '#ffe3aa');
    text('오늘의 행운', 132, 32, '#fff7df', 270, 45, 800);
    text('긁는 순간, 당신에게 닿는 한 문장', 184, 10, '#ffe2bf');
    text('A LITTLE LUCK, JUST FOR YOU', 252, 8, '#946545');
    rect(41, 290, 278, 152, '#c8b99e', 8);
    rect(45, 294, 270, 144, '#fff4d5', 5);
    let fontSize = 30;
    // Fit the actual user phrase into the scratch panel, allowing soft wraps at every size.
    for (let size = 30; size >= 16; size -= 2) {
      const builder = api.ParagraphBuilder.Make({ textAlign: 2 }, fonts);
      builder
        .pushStyle({
          fontFamilies: ['Handwritten'],
          fontSize: size,
          color: api.Color('#713a28'),
          fontStyle: { weight: 700 },
          heightMultiplier: 1.35,
        })
        .addText(s.text);
      const paragraph = builder.build();
      paragraph.layout(242);
      if (paragraph.getHeight() <= 116) {
        paragraph.paint(canvas, 59, FOIL.y + (FOIL.height - paragraph.getHeight()) / 2);
        paragraph.dispose();
        fontSize = size;
        break;
      }
      paragraph.dispose();
      if (size === 16) throw new Error('문구를 조금 줄여주세요. 은박 안에 모두 담기지 않아요.');
    }
    text('동전으로 은박을 천천히 긁어보세요', 463, 10, '#9a7654');
    text('당신의 문장으로 만드는 작은 선물', 520, 9, '#a98c6a');
    text('NO.  002731     •     A MOMENT TO KEEP', 543, 7, '#b19876');
    surface.flush();
    const paper = surface.makeImageSnapshot();
    canvas.clear(api.Color('transparent'));
    canvas.save();
    canvas.clipRRect(api.RRectXY(api.XYWHRect(45, 294, 270, 144), 5, 5), 1, true);
    p.setShader(
      api.Shader.MakeLinearGradient(
        { x: 40, y: 300 },
        { x: 330, y: 440 },
        ['#8b9094', '#dce0e0', '#a7adb1', '#ececea', '#939b9e'].map((c) => api.Color(c)),
        [0, 0.3, 0.51, 0.7, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(api.XYWHRect(45, 294, 270, 144), p);
    p.setShader(null);
    for (let i = 0; i < 11000; i++) {
      const x = 45 + rng() * 270,
        y = 294 + rng() * 144;
      p.setColor(api.Color(i % 3 === 0 ? '#ffffff45' : '#25323c22'));
      canvas.drawRect(api.XYWHRect(x, y, 0.15 + rng() * 1.5, 0.1 + rng() * 0.45), p);
    }
    // Fine rolling striations catch light independently of the coarse metallic gradient.
    p.setStrokeWidth(0.22);
    for (let i = 0; i < 240; i++) {
      p.setColor(api.Color(i % 3 ? '#ffffff18' : '#303f4820'));
      const y = 294 + rng() * 144;
      canvas.drawLine(45, y, 315, y - 1.5, p);
    }
    text('SCRATCH HERE', 357, 9, '#626c7280');
    canvas.restore();
    surface.flush();
    const foil = surface.makeImageSnapshot();
    return { scene: 'scratch', paper, foil, fontSize };
  } finally {
    surface.dispose();
  }
}
