import React from 'react';
import { Skia, Group, drawAsPicture } from '@shopify/react-native-skia';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Frame } from '../domain/model';
import type { Resources } from '../render/resources';
import { artwork } from '../scenes/artwork';
import { frameMotion } from '../render/motion';
const directory = () => new Directory(Paths.cache, 'little-scenes');
export async function renderPng(frame: Readonly<Frame>, resources: Resources): Promise<Uint8Array> {
  const surface = Skia.Surface.Make(1080, 1920);
  if (!surface) throw new Error('이미지를 만들 공간이 부족해요.');
  let picture;
  let image;
  try {
    picture = await drawAsPicture(
      <Group transform={[{ scale: 3 }]}>
        {artwork(
          frame,
          resources,
          frameMotion(Skia, frame, resources.scene === 'rain' ? resources.running : []),
        )}
      </Group>,
    );
    surface.getCanvas().drawPicture(picture);
    surface.flush();
    image = surface.makeImageSnapshot();
    const bytes = image.encodeToBytes();
    if (!bytes) throw new Error('PNG 변환에 실패했어요.');
    return bytes;
  } finally {
    image?.dispose();
    picture?.dispose();
    surface.dispose();
  }
}
export async function cleanOldExports() {
  const dir = directory();
  if (!dir.exists) return;
  for (const file of dir.list()) {
    if (
      file instanceof File &&
      file.name.startsWith('scene-') &&
      file.modificationTime &&
      Date.now() - file.modificationTime > 86400000
    )
      file.delete();
  }
}
export async function sharePng(frame: Readonly<Frame>, resources: Resources) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('이 기기에서는 공유 시트를 열 수 없어요.');
  const bytes = await renderPng(frame, resources);
  const dir = directory();
  dir.create({ idempotent: true, intermediates: true });
  const file = new File(dir, `scene-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: '작품 이미지 공유',
  });
  // Keep the file for consumers that read after the share sheet dismisses.
}
