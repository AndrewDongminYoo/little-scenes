import React from 'react';
import {
  Atlas,
  BlurMask,
  DashPathEffect,
  Group,
  Image,
  Mask,
  Path,
  Rect,
  RadialGradient,
  FilterMode,
  ImageShader,
  MipmapMode,
  type SkColor,
  type SkPath,
  type SkRSXform,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import type { Settings } from '../domain/model';
import type { Transform } from '../render/motion';
import type { Resources } from '../render/resources';
import { LINEN_TILE } from '../render/shaders';

type Dynamic<T> = T | SharedValue<T>;
export type Motion = {
  reveal: Dynamic<number>;
  shadow: Dynamic<Transform[]>;
  gloss: Dynamic<Transform[]>;
  runningPath: Dynamic<SkPath>;
  runningXforms: Dynamic<SkRSXform[]>;
  trailXforms: Dynamic<SkRSXform[]>;
  trailColors: Dynamic<SkColor[]>;
};
const full = { x: 0, y: 0, width: 360, height: 640 };

/** The artwork alone, in 360×640 logical units. No UI ever enters this tree. */
export function artwork(s: Settings, r: Resources, m: Motion): React.ReactElement {
  if (r.scene === 'embroidery')
    return (
      <Group>
        <Rect {...full}>
          <ImageShader
            image={r.weave}
            tx="repeat"
            ty="repeat"
            fit="fill"
            rect={{ x: 0, y: 0, width: LINEN_TILE, height: LINEN_TILE }}
            sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
          />
        </Rect>
        <Image image={r.mottle} {...full} fit="fill" sampling={{ B: 1 / 3, C: 1 / 3 }} />
        <Rect {...full}>
          <RadialGradient c={{ x: 170, y: 260 }} r={460} colors={['#ffffff14', '#5a463018']} />
        </Rect>
        {/* Basting lines of the hoop margin. */}
        <Path
          path="M 26 36 L 26 604 M 334 36 L 334 604"
          style="stroke"
          strokeWidth={0.8}
          color="#fffaf0"
          opacity={0.85}
        >
          <DashPathEffect intervals={[4, 3]} />
        </Path>
        <Mask
          mode="alpha"
          mask={
            <Path
              path={r.revealPath}
              style="stroke"
              strokeWidth={r.revealWidth}
              strokeCap="round"
              strokeJoin="round"
              color="white"
              end={m.reveal}
            />
          }
        >
          <Group transform={m.shadow} opacity={0.55}>
            <Atlas image={r.sheet} sprites={r.shadow} transforms={r.xforms} />
          </Group>
          <Atlas
            image={r.sheet}
            sprites={r.body}
            transforms={r.xforms}
            colors={r.colors}
            colorBlendMode="modulate"
          />
          <Group transform={m.gloss} opacity={0.55}>
            <Atlas image={r.sheet} sprites={r.gloss} transforms={r.xforms} />
          </Group>
        </Mask>
      </Group>
    );
  return (
    <Group>
      <Image image={r.clear} {...full} fit="fill" />
      <Mask
        mode="luminance"
        mask={
          <Group>
            <Rect {...full} color="white" />
            <Path
              path={r.wipePath}
              style="stroke"
              strokeWidth={r.wipeWidth}
              strokeCap="round"
              strokeJoin="round"
              color="black"
              end={m.reveal}
            >
              <BlurMask blur={1.1} style="normal" />
            </Path>
            <Group opacity={m.reveal}>
              <Path
                path={r.dripPath}
                style="stroke"
                strokeWidth={r.wipeWidth * 0.24}
                strokeCap="round"
                color="black"
                opacity={0.8}
              />
            </Group>
            <Path
              path={m.runningPath}
              style="stroke"
              strokeWidth={2.2}
              strokeCap="round"
              color="black"
              opacity={0.75}
            >
              <BlurMask blur={0.6} style="normal" />
            </Path>
            <Atlas
              image={r.sheet}
              sprites={r.soft}
              transforms={m.trailXforms}
              colors={m.trailColors}
              colorBlendMode="modulate"
            />
          </Group>
        }
      >
        <Image image={r.glass} {...full} fit="fill" />
      </Mask>
      <Group opacity={m.reveal}>
        <Image image={r.rim} {...full} fit="fill" />
      </Group>
      <Group transform={[{ translateY: 1 }]} opacity={0.5}>
        <Atlas image={r.sheet} sprites={r.dropShadow} transforms={m.runningXforms} />
      </Group>
      <Atlas image={r.sheet} sprites={r.dropBody} transforms={m.runningXforms} />
      <Atlas image={r.sheet} sprites={r.dropGloss} transforms={m.runningXforms} />
      <Rect {...full}>
        <RadialGradient c={{ x: 180, y: 300 }} r={430} colors={['#0b141a00', '#0b141a40']} />
      </Rect>
    </Group>
  );
}
