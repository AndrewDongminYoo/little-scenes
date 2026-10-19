import { Platform } from 'react-native';
import {
  createWorkletRuntime,
  runOnRuntimeAsync,
  type WorkletRuntime,
} from 'react-native-worklets';
import { Skia, type SkPicture, type SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { Settings } from '../domain/model';
import { prepareResources } from './resources';

let runtime: WorkletRuntime | undefined;
const getRuntime = () =>
  runtime ?? (runtime = createWorkletRuntime({ name: 'little-scenes-render' }));

/** Native CPU surfaces and text analysis run off both RN and UI threads. Web is an explicit fallback. */
export async function prepareInBackground(fonts: SkTypefaceFontProvider, settings: Settings) {
  if (Platform.OS === 'web') {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return prepareResources(Skia, fonts, settings);
  }
  return runOnRuntimeAsync(
    getRuntime(),
    (provider: SkTypefaceFontProvider, value: Settings) => {
      'worklet';
      return prepareResources(Skia, provider, value);
    },
    fonts,
    settings,
  );
}

/** Record the React tree on RN; rasterize/encode its immutable picture on a dedicated runtime. */
function encode(picture: SkPicture) {
  'worklet';
  const surface = Skia.Surface.Make(1080, 1920);
  if (!surface) throw new Error('이미지를 만들 공간이 부족해요.');
  let image;
  try {
    surface.getCanvas().drawPicture(picture);
    surface.flush();
    image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    if (!bytes) throw new Error('PNG 변환에 실패했어요.');
    return bytes;
  } finally {
    image?.dispose();
    surface.dispose();
  }
}
export async function encodeInBackground(picture: SkPicture) {
  if (Platform.OS === 'web') {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return encode(picture);
  }
  return runOnRuntimeAsync(getRuntime(), encode, picture);
}
