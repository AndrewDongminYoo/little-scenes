import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  AccessibilityInfo,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { Canvas, Group, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { runOnUISync, scheduleOnRN } from 'react-native-worklets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaults,
  fitRect,
  freezeFrame,
  advanceClocks,
  TRAIL_FADE_MS,
  pushTrail,
  toLogicalPoint,
  validateText,
  type SceneId,
  type Settings,
} from '../../domain/model';
import { createShareGate } from '../../domain/transactions';
import {
  glossOffset,
  runningTrails,
  runningXforms,
  shadowOffset,
  trailColors,
  trailXforms,
} from '../../render/motion';
import { useResources } from '../../render/useResources';
import { artwork } from '../../scenes/artwork';
import { loadSettings, saveSettings } from '../../storage/settings';
import { sharePng } from '../../export/export-frame';
import { Button } from '../../ui/Button';
import { TextEditor } from '../../ui/TextEditor';
import { scenes } from '../../scenes/registry';
const NONE: number[] = [];
const PALETTES = [
  ['meadow', '들꽃'],
  ['dancheong', '단청'],
  ['navy', '남색 실'],
] as const;
export default function SceneRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id !== 'embroidery' && id !== 'rain')
    return (
      <SafeAreaView>
        <Text>작품을 찾지 못했어요.</Text>
        <Button label="갤러리" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  return <Scene key={id} id={id} />;
}
function Scene({ id }: { id: SceneId }) {
  const [settings, setSettings] = useState<Settings>(() => defaults(id)),
    [loaded, setLoaded] = useState(false),
    [editing, setEditing] = useState(false),
    [immersive, setImmersive] = useState(false),
    [playing, setPlaying] = useState(true),
    [touchRunning, setTouchRunning] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [hint, setHint] = useState(false),
    [viewport, setViewport] = useState({ width: 0, height: 0 });
  const { resources, ready, error } = useResources(settings);
  const gate = useRef(createShareGate());
  const mounted = useRef(true);
  const clock = useSharedValue(0),
    interactionClock = useSharedValue(0),
    restoring = useSharedValue(false),
    active = useSharedValue(false),
    touchX = useSharedValue(-100),
    touchY = useSharedValue(-100),
    touchStrength = useSharedValue(0),
    trail = useSharedValue<number[]>([]),
    shareFrozen = useSharedValue(false);
  const reduced = useRef(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    mounted.current = true;
    loadSettings(id)
      .then((s) => {
        if (mounted.current) {
          setSettings(s);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (mounted.current) {
          setLoaded(true);
          setNotice('저장된 설정을 읽지 못했어요. 기본 작품을 보여드려요.');
        }
      });
    return () => {
      mounted.current = false;
      active.set(false);
      cancelAnimation(touchStrength);
    };
  }, [id, active, touchStrength]);
  useEffect(() => {
    let alive = true;
    const update = (enabled: boolean) => {
      if (!alive) return;
      reduced.current = enabled;
      if (enabled) {
        setPlaying(false);
        clock.set(1600);
      }
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {
      alive = false;
      sub.remove();
    };
  }, [clock]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      active.set(false);
      setForeground(s === 'active');
    });
    return () => sub.remove();
  }, [active]);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        active.set(false);
        setFocused(false);
      };
    }, [active]),
  );
  useEffect(() => {
    active.set(playing && foreground && focused && loaded && ready && !busy && !editing);
  }, [playing, foreground, focused, loaded, ready, busy, editing, active]);
  const finishEmbroidery = useCallback(() => {
    if (mounted.current) setPlaying(false);
  }, []);
  const wakeTouch = useCallback(() => setTouchRunning(true), []);
  const finishTouch = useCallback(() => {
    if (mounted.current) setTouchRunning(false);
  }, []);
  const loop = useFrameCallback((frame) => {
    if (shareFrozen.get()) return;
    const delta = Math.min(frame.timeSincePreviousFrame ?? 0, 50);
    const next = advanceClocks(
      clock.get(),
      interactionClock.get(),
      delta,
      active.get(),
      restoring.get(),
      id,
    );
    clock.set(next.time);
    interactionClock.set(next.interactionTime);
    if (active.get() && id === 'embroidery' && next.time >= 1600) {
      active.set(false);
      scheduleOnRN(finishEmbroidery);
    }
    const points = trail.get();
    if (
      restoring.get() &&
      points.length &&
      next.interactionTime - points[points.length - 1] >= TRAIL_FADE_MS
    ) {
      restoring.set(false);
      trail.set([]);
      scheduleOnRN(finishTouch);
    }
  }, false);
  useEffect(() => {
    loop.setActive(
      (playing || touchRunning) && foreground && focused && loaded && ready && !busy && !editing,
    );
    return () => loop.setActive(false);
  }, [loop, playing, touchRunning, foreground, focused, loaded, ready, busy, editing]);
  const reveal = useDerivedValue(() => Math.min(1, clock.get() / 1600));
  const shadow = useDerivedValue(() =>
    shadowOffset(touchX.get(), touchY.get(), touchStrength.get()),
  );
  const gloss = useDerivedValue(() => glossOffset(touchX.get(), touchY.get(), touchStrength.get()));
  const running = resources?.scene === 'rain' ? resources.running : NONE;
  const runningPath = useDerivedValue(() => runningTrails(Skia, running, clock.get()), [running]);
  const runningDrops = useDerivedValue(() => runningXforms(Skia, running, clock.get()), [running]);
  const trailSprites = useDerivedValue(() => trailXforms(Skia, trail.get()));
  const trailAlphas = useDerivedValue(() => trailColors(trail.get(), interactionClock.get()));
  const rect = fitRect(viewport.width, viewport.height);
  const exit = useCallback(() => setImmersive(false), []);
  const pan = Gesture.Pan()
    .minDistance(8)
    .enabled(!busy)
    .onUpdate((e) => {
      const p = toLogicalPoint({ x: e.x, y: e.y }, rect);
      if (p) {
        touchX.set(p.x);
        touchY.set(p.y);
        touchStrength.set(1);
        if (id === 'rain') {
          if (!restoring.get()) {
            restoring.set(true);
            scheduleOnRN(wakeTouch);
          }
          trail.set(pushTrail(trail.get(), p.x, p.y, interactionClock.get()));
        }
      }
    })
    .onFinalize(() => {
      touchStrength.set(withTiming(0, { duration: 3200 }));
    });
  const tap = Gesture.Tap()
    .maxDistance(7)
    .enabled(immersive && !busy)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(exit);
    });
  const gesture = Gesture.Race(pan, tap);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (immersive) {
        exit();
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [immersive, exit]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(false), 2200);
    return () => clearTimeout(timer);
  }, [hint]);
  const change = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    // A new phrase or layout is stitched/written again; colour and mood changes keep the moment.
    if ('text' in patch || 'writing' in patch) {
      clock.set(reduced.current ? 1600 : 0);
      trail.set([]);
      restoring.set(false);
      setTouchRunning(false);
      setPlaying(!reduced.current);
    }
    saveSettings(next).catch(() => {
      if (mounted.current) setNotice('설정을 저장하지 못했어요. 앱을 닫기 전에 다시 적용해주세요.');
    });
  };
  const enter = async () => {
    setImmersive(true);
    try {
      if (!(await AsyncStorage.getItem('little-scenes:immersive-hint'))) {
        if (mounted.current) setHint(true);
        await AsyncStorage.setItem('little-scenes:immersive-hint', 'seen');
      }
    } catch {
      if (mounted.current) setHint(true);
    }
  };
  const share = async () => {
    if (!resources || !ready || !loaded || !validateText(settings.text).ok) return;
    await gate.current
      .run(async () => {
        setBusy(true);
        setNotice('');
        try {
          const frozen = runOnUISync(() => {
            'worklet';
            shareFrozen.set(true);
            cancelAnimation(touchStrength);
            return {
              time: clock.get(),
              interactionTime: interactionClock.get(),
              reveal: Math.min(1, clock.get() / 1600),
              touch: {
                x: touchX.get(),
                y: touchY.get(),
                strength: touchStrength.get(),
              },
              trail: trail.get(),
            };
          });
          await sharePng(freezeFrame({ ...settings, ...frozen }), resources);
          if (mounted.current) setNotice('공유 시트를 닫았어요.');
        } finally {
          shareFrozen.set(false);
          if (mounted.current) {
            touchStrength.set(withTiming(0, { duration: 3200 }));
            setBusy(false);
          }
        }
      })
      .catch((e) => {
        if (mounted.current)
          setNotice(e instanceof Error ? e.message : '공유하지 못했어요. 다시 시도해주세요.');
      });
  };
  const name = scenes.find((s) => s.id === id)!.name;
  return (
    <SafeAreaView
      style={[styles.page, immersive && { backgroundColor: id === 'rain' ? '#203942' : '#e6ddc8' }]}
      edges={immersive ? [] : ['top', 'bottom']}
    >
      <StatusBar hidden={immersive} style="dark" />
      {focused && <NavigationBar hidden={immersive} style="dark" />}
      {!immersive && (
        <View style={styles.header}>
          <Button label="뒤로" onPress={() => router.back()} disabled={busy} />
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.mark}>Little Scenes</Text>
        </View>
      )}
      <View style={styles.stage} onLayout={(e) => setViewport(e.nativeEvent.layout)}>
        <GestureDetector gesture={gesture}>
          <View
            collapsable={false}
            style={styles.fill}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${name}. ${settings.text.trim() || '빈 문구'}. ${playing ? '재생 중' : '일시정지'}. ${immersive ? '감상 모드. 종료 액션으로 돌아갈 수 있어요.' : ''}`}
            accessibilityActions={
              immersive
                ? [
                    { name: 'escape', label: '감상 모드 종료' },
                    { name: 'activate', label: '감상 모드 종료' },
                  ]
                : []
            }
            onAccessibilityAction={exit}
            onAccessibilityEscape={exit}
          >
            {resources && rect.width > 0 ? (
              <Canvas style={styles.fill}>
                <Group
                  transform={[
                    { translateX: rect.x },
                    { translateY: rect.y },
                    { scale: rect.width / 360 },
                  ]}
                >
                  {artwork(settings, resources, {
                    reveal,
                    shadow,
                    gloss,
                    runningPath,
                    runningXforms: runningDrops,
                    trailXforms: trailSprites,
                    trailColors: trailAlphas,
                  })}
                </Group>
              </Canvas>
            ) : (
              <View style={styles.center}>
                <Text style={styles.message}>{error ?? '작품을 준비하고 있어요.'}</Text>
              </View>
            )}
          </View>
        </GestureDetector>
        {hint && (
          <Text pointerEvents="none" style={styles.hint}>
            한 번 탭하면 도구가 돌아와요.
          </Text>
        )}
      </View>
      {!immersive && (
        <View style={styles.panel}>
          {(error || notice || !settings.text.trim()) && (
            <Text accessibilityRole="alert" style={styles.message}>
              {error || notice || '문구가 비어 있어요. 문구를 입력하면 공유할 수 있어요.'}
            </Text>
          )}
          <ScrollView
            horizontal
            contentContainerStyle={styles.row}
            showsHorizontalScrollIndicator={false}
          >
            {id === 'embroidery' ? (
              <>
                {(settings.thread === 'red'
                  ? [...PALETTES, ['red', '붉은 실'] as const]
                  : PALETTES
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    label={label}
                    disabled={busy || !loaded}
                    selected={settings.thread === value}
                    onPress={() => change({ thread: value })}
                  />
                ))}
                <Button
                  label={settings.writing === 'vertical' ? '세로쓰기' : '가로쓰기'}
                  hint={`글자 방향. 누르면 ${settings.writing === 'vertical' ? '가로쓰기' : '세로쓰기'}로 바뀌어요.`}
                  disabled={busy || !loaded}
                  onPress={() =>
                    change({
                      writing: settings.writing === 'vertical' ? 'horizontal' : 'vertical',
                    })
                  }
                />
                <Button
                  label={settings.density === 'fine' ? '땀 촘촘하게' : '땀 보통'}
                  hint={`스티치 간격. 누르면 ${settings.density === 'fine' ? '보통' : '촘촘하게'}으로 바뀌어요.`}
                  disabled={busy || !loaded}
                  onPress={() =>
                    change({
                      density: settings.density === 'fine' ? 'normal' : 'fine',
                    })
                  }
                />
              </>
            ) : (
              <>
                <Button
                  label="흐린 낮"
                  disabled={busy || !loaded}
                  selected={settings.mood === 'day'}
                  onPress={() => change({ mood: 'day' })}
                />
                <Button
                  label="비 오는 밤"
                  disabled={busy || !loaded}
                  selected={settings.mood === 'night'}
                  onPress={() => change({ mood: 'night' })}
                />
                <Button
                  label={`빗물 ${['적게', '보통', '많이'][settings.intensity - 1]}`}
                  hint="비의 강도. 누를 때마다 적게, 보통, 많이 순서로 바뀌어요."
                  disabled={busy || !loaded}
                  onPress={() =>
                    change({
                      intensity: ((settings.intensity % 3) + 1) as 1 | 2 | 3,
                    })
                  }
                />
              </>
            )}
          </ScrollView>
          <View style={styles.row}>
            <Button
              testID="edit-phrase"
              label="문구"
              disabled={busy || !loaded}
              onPress={() => setEditing(true)}
            />
            <Button
              label={id === 'embroidery' ? '다시 수놓기' : playing ? '일시정지' : '재생'}
              disabled={busy || !resources}
              onPress={() => {
                if (id === 'embroidery') {
                  clock.set(0);
                  setPlaying(true);
                } else setPlaying((p) => !p);
              }}
            />
            <Button
              testID="immersive"
              label="감상"
              disabled={busy || !resources}
              onPress={() => void enter()}
            />
            <Button
              testID="share"
              label={busy ? '준비 중' : 'PNG 공유'}
              selected
              disabled={busy || !ready || !loaded || !validateText(settings.text).ok}
              onPress={() => void share()}
            />
          </View>
          <Text style={styles.note}>
            작품을 드래그해보세요 · 공유 이미지에는 도구가 담기지 않아요
          </Text>
        </View>
      )}
      {editing && (
        <TextEditor
          initial={settings.text}
          onClose={() => setEditing(false)}
          onApply={(text) => {
            change({ text });
            setEditing(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f7f3eb' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#293d32', flex: 1 },
  mark: { fontSize: 10, color: '#727e71' },
  stage: { flex: 1, minHeight: 100 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  panel: { paddingVertical: 12, gap: 10 },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    flexWrap: 'wrap',
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    color: '#7c3828',
    paddingHorizontal: 16,
  },
  note: {
    fontSize: 10,
    color: '#6b7468',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  hint: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: '#263a30dd',
    color: 'white',
    padding: 12,
    borderRadius: 12,
  },
});
