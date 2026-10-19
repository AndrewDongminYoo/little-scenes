import { useEffect, useState, useRef } from 'react';
import { useFonts } from '@shopify/react-native-skia';
import type { Settings } from '../domain/model';
import { resourceKey, type Resources } from './resources';
import { prepareInBackground } from './background';
import { createGeneration } from '../domain/transactions';
export function useResources(settings: Settings) {
  const generation = useRef(createGeneration());
  const fonts = useFonts({
    LittleScenes: [require('../../assets/fonts/NotoSansKR.ttf')],
    Handwritten: [
      require('../../assets/fonts/Gaegu-Regular.ttf'),
      require('../../assets/fonts/Gaegu-Bold.ttf'),
    ],
  });
  const [result, setResult] = useState<{
    key: string;
    resources?: Resources;
    error?: string;
  }>({ key: '' });
  const key = resourceKey(settings);
  useEffect(() => {
    if (!fonts) return;
    let active = true;
    const token = generation.current.next();
    let resource: Resources | undefined;
    Promise.resolve().then(async () => {
      if (!active) return;
      try {
        resource = await prepareInBackground(fonts, settings);
        if (active && generation.current.current(token)) setResult({ key, resources: resource });
      } catch (e) {
        if (active && generation.current.current(token))
          setResult((prev) => ({
            key,
            resources: prev.resources,
            error: e instanceof Error ? e.message : '작품을 준비하지 못했어요.',
          }));
      }
    });
    // Skia resources are GC-owned and shared through a small cache; explicit disposal could
    // race UI-thread drawing or an export still holding them.
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input that matters.
  }, [fonts, key]);
  // The last good artwork stays on screen while a new one is prepared; `ready` says
  // whether it matches the current settings (sharing requires that).
  return {
    fonts,
    resources: result.resources,
    ready: result.key === key && !result.error && !!result.resources,
    error: result.key === key ? result.error : undefined,
  };
}
