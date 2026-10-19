import React from 'react';
import { Skia, Group, drawAsPicture } from '@shopify/react-native-skia';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Frame } from '../domain/model';
import { encodeInBackground } from '../render/background';
import type { Resources } from '../render/resources';
import { artwork } from '../scenes/artwork';
import { frameMotion } from '../render/motion';
const directory = () => new Directory(Paths.cache, 'little-scenes');
export async function renderPng(frame: Readonly<Frame>, resources: Resources): Promise<Uint8Array> {
  let picture;
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
    return await encodeInBackground(picture);
  } finally {
    picture?.dispose();
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
