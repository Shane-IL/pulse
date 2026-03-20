let pending = false;
const queue = new Set<() => void>();

export function scheduleUpdate(callback: () => void): void {
  queue.add(callback);
  if (!pending) {
    pending = true;
    queueMicrotask(flush);
  }
}

function flush(): void {
  const batch = [...queue];
  queue.clear();
  pending = false;
  for (const callback of batch) {
    callback();
  }
}

export function flushSync(): void {
  const batch = [...queue];
  queue.clear();
  pending = false;
  for (const callback of batch) {
    callback();
  }
}
