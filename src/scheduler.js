let pending = false;
const queue = new Set();

export function scheduleUpdate(callback) {
  queue.add(callback);
  if (!pending) {
    pending = true;
    queueMicrotask(flush);
  }
}

function flush() {
  const batch = [...queue];
  queue.clear();
  pending = false;
  for (const callback of batch) {
    callback();
  }
}

export function flushSync() {
  const batch = [...queue];
  queue.clear();
  pending = false;
  for (const callback of batch) {
    callback();
  }
}
