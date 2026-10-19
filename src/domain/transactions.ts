export function createGeneration() {
  let version = 0;
  return {
    next: () => ++version,
    current: (candidate: number) => candidate === version,
  };
}
export function createSerialWriter(write: (s: string) => Promise<void>) {
  let tail = Promise.resolve();
  return (value: string) => {
    const task = tail.catch(() => {}).then(() => write(value));
    tail = task;
    return task;
  };
}
export function createShareGate() {
  let busy = false;
  return {
    run: async (fn: () => Promise<void>): Promise<'busy' | 'dismissed'> => {
      if (busy) return 'busy';
      busy = true;
      try {
        await fn();
        return 'dismissed';
      } finally {
        busy = false;
      }
    },
  };
}
