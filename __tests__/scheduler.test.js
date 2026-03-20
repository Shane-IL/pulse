import { describe, it, expect, vi } from 'vitest';
import { scheduleUpdate, flushSync } from '../src/scheduler';

describe('scheduler', () => {
  it('flushSync executes callbacks synchronously', () => {
    const cb = vi.fn();
    scheduleUpdate(cb);
    flushSync();
    expect(cb).toHaveBeenCalledOnce();
  });

  it('deduplicates same callback', () => {
    const cb = vi.fn();
    scheduleUpdate(cb);
    scheduleUpdate(cb);
    flushSync();
    expect(cb).toHaveBeenCalledOnce();
  });

  it('batches multiple different callbacks', () => {
    const a = vi.fn();
    const b = vi.fn();
    scheduleUpdate(a);
    scheduleUpdate(b);
    flushSync();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('schedules via queueMicrotask', async () => {
    const cb = vi.fn();
    scheduleUpdate(cb);
    expect(cb).not.toHaveBeenCalled();
    await new Promise((resolve) => queueMicrotask(resolve));
    // The flush microtask should have run before ours or at the same time
    // Give it one more tick to be safe
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cb).toHaveBeenCalledOnce();
  });
});
