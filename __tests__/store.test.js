import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/store.js';

function makeCounter() {
  return createStore({
    state: { count: 0 },
    actions: {
      increment: (state) => ({ ...state, count: state.count + 1 }),
      decrement: (state) => ({ ...state, count: state.count - 1 }),
      set: (state, value) => ({ ...state, count: value }),
      noop: (state) => state, // returns same reference
    },
  });
}

describe('createStore', () => {
  it('getState returns initial state', () => {
    const store = makeCounter();
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('dispatch updates state', () => {
    const store = makeCounter();
    store.dispatch('increment');
    expect(store.getState().count).toBe(1);
  });

  it('dispatch passes payload', () => {
    const store = makeCounter();
    store.dispatch('set', 42);
    expect(store.getState().count).toBe(42);
  });

  it('dispatch throws on unknown action', () => {
    const store = makeCounter();
    expect(() => store.dispatch('unknown')).toThrow('[pulse] Unknown action: "unknown"');
  });

  it('subscribe listener is called on dispatch', () => {
    const store = makeCounter();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch('increment');
    expect(listener).toHaveBeenCalledWith({ count: 1 });
  });

  it('subscribe returns unsubscribe function', () => {
    const store = makeCounter();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.dispatch('increment');
    expect(listener).not.toHaveBeenCalled();
  });

  it('identity return skips notification', () => {
    const store = makeCounter();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch('noop');
    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple subscribers all notified', () => {
    const store = makeCounter();
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.dispatch('increment');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('select returns binding descriptor', () => {
    const store = makeCounter();
    const selector = (state) => state.count;
    const binding = store.select(selector);
    expect(binding.store).toBe(store);
    expect(binding.selector).toBe(selector);
  });
});
