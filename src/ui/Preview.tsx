import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Canvas, Group, Skia } from '@shopify/react-native-skia';
import { defaults, type SceneId } from '../domain/model';
import { frameMotion } from '../render/motion';
import { useResources } from '../render/useResources';
import { artwork } from '../scenes/artwork';
export function Preview({ id, width }: { id: SceneId; width: number }) {
  const s = useMemo(() => defaults(id), [id]);
  const { resources, error } = useResources(s);
  const height = (width * 16) / 9;
  const motion = useMemo(
    () =>
      resources &&
      frameMotion(
        Skia,
        { ...s, time: 5200, reveal: 1, touch: { x: -100, y: -100, strength: 0 }, trail: [] },
        resources.scene === 'rain' ? resources.running : [],
      ),
    [resources, s],
  );
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: id === 'rain' ? '#22323a' : '#e6dfd0',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {resources && motion ? (
        <Canvas style={{ width, height }}>
          <Group transform={[{ scale: width / 360 }]}>{artwork(s, resources, motion)}</Group>
        </Canvas>
      ) : (
        <Text style={{ padding: 20, color: id === 'rain' ? '#d8e2e4' : '#4b5a50' }}>
          {error ?? '작품을 준비하고 있어요.'}
        </Text>
      )}
    </View>
  );
}
