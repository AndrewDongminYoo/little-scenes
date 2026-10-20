import React from 'react';
import {
  Group,
  Image,
  Mask,
  Rect,
  Path,
  Oval,
  BlurMask,
  LinearGradient,
  type SkPath,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import type { ScratchResources } from '../render/scratch-resources';
import type { Transform } from '../render/motion';
type Dynamic<T> = T | SharedValue<T>;
export type ScratchMotion = {
  open: Dynamic<SkPath>;
  worn: Dynamic<SkPath>;
  scuffed: Dynamic<SkPath>;
  dark: Dynamic<SkPath>;
  light: Dynamic<SkPath>;
  coin: Dynamic<Transform[]>;
  coinOpacity: Dynamic<number>;
};
const full = { x: 0, y: 0, width: 360, height: 640 };
export function scratchArtwork(r: ScratchResources, m: ScratchMotion) {
  return (
    <Group clip={full}>
      <Image image={r.paper} {...full} fit="fill" />
      <Mask
        mode="luminance"
        mask={
          <Group>
            <Rect {...full} color="white" />
            <Path path={m.scuffed} color="#aaaaaa">
              <BlurMask blur={0.5} style="normal" />
            </Path>
            <Path path={m.worn} color="#555555">
              <BlurMask blur={0.5} style="normal" />
            </Path>
            <Path path={m.open} color="black">
              <BlurMask blur={0.45} style="normal" />
            </Path>
          </Group>
        }
      >
        <Image image={r.foil} {...full} fit="fill" />
      </Mask>
      <Group transform={[{ translateY: 1 }]} opacity={0.2}>
        <Path path={m.dark} color="#352c24" />
      </Group>
      <Path path={m.dark} color="#747c82" />
      <Path path={m.light} color="#dde1df" />
      {/* The edge orientation is fixed by the control, not snapped to the swipe direction. */}
      <Group transform={m.coin} opacity={m.coinOpacity}>
        <Oval x={-20} y={-4} width={40} height={25} color="#28282344" />
        <Oval x={-21} y={-20} width={42} height={26}>
          <LinearGradient
            start={{ x: -15, y: -20 }}
            end={{ x: 16, y: 4 }}
            colors={['#eed6a1', '#b99a60', '#e5c98f', '#8e774e']}
          />
        </Oval>
        <Oval
          x={-18}
          y={-18}
          width={36}
          height={21}
          style="stroke"
          strokeWidth={0.8}
          color="#f7e5b7"
        />
        <Oval
          x={-15}
          y={-16}
          width={30}
          height={17}
          style="stroke"
          strokeWidth={0.7}
          color="#947847"
        />
        <Path path="M -5 -7 L 0 -12 L 5 -7 L 0 -3 Z" color="#9f814c" />
        <Path path="M -17 1 Q 0 7 17 1" style="stroke" strokeWidth={1.5} color="#f6e1b1" />
      </Group>
    </Group>
  );
}
