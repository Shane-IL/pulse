import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/store';
import { connect } from '../src/connect';
import { h } from '../src/createElement';
import { render } from '../src/render';

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
    expect(() => store.dispatch('unknown')).toThrow(
      '[pulse] Unknown action: "unknown"',
    );
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

// ── store.pick ────────────────────────────────────────────

describe('store.pick', () => {
  it('returns bindings for specified keys (variadic)', () => {
    const store = createStore({
      state: { x: 1, y: 2, z: 3 },
      actions: {},
    });
    const bindings = store.pick('x', 'z');
    expect(Object.keys(bindings)).toEqual(['x', 'z']);
    expect(bindings.x.store).toBe(store);
    expect(bindings.x.selector(store.getState())).toBe(1);
    expect(bindings.z.selector(store.getState())).toBe(3);
  });

  it('accepts an array of keys', () => {
    const store = createStore({
      state: { a: 10, b: 20 },
      actions: {},
    });
    const bindings = store.pick(['a', 'b']);
    expect(bindings.a.selector(store.getState())).toBe(10);
    expect(bindings.b.selector(store.getState())).toBe(20);
  });

  it('works with connect()', () => {
    const store = createStore({
      state: { count: 42 },
      actions: {},
    });
    const inner = vi.fn(() => null);
    const Connected = connect(store.pick('count'))(inner);
    const container = document.createElement('div');
    render(h(Connected, null), container);
    expect(inner.mock.calls[0][0].count).toBe(42);
  });

  it('can merge picks from multiple stores', () => {
    const storeA = createStore({ state: { x: 1 }, actions: {} });
    const storeB = createStore({ state: { y: 2 }, actions: {} });
    const inner = vi.fn(() => null);
    const Connected = connect({
      ...storeA.pick('x'),
      ...storeB.pick('y'),
    })(inner);
    const container = document.createElement('div');
    render(h(Connected, null), container);
    const props = inner.mock.calls[0][0];
    expect(props.x).toBe(1);
    expect(props.y).toBe(2);
  });
});

// ── store.actions ─────────────────────────────────────────

describe('store.actions', () => {
  it('exposes action dispatchers', () => {
    const store = makeCounter();
    expect(typeof store.actions.increment).toBe('function');
    expect(typeof store.actions.decrement).toBe('function');
    expect(typeof store.actions.set).toBe('function');
  });

  it('dispatchers update state', () => {
    const store = makeCounter();
    store.actions.increment();
    expect(store.getState().count).toBe(1);
    store.actions.set(99);
    expect(store.getState().count).toBe(99);
  });

  it('dispatchers pass payload', () => {
    const store = makeCounter();
    store.actions.set(42);
    expect(store.getState().count).toBe(42);
  });

  it('noop dispatchers do not notify', () => {
    const store = makeCounter();
    const listener = vi.fn();
    store.subscribe(listener);
    store.actions.noop();
    expect(listener).not.toHaveBeenCalled();
  });

  it('non-existent action property is undefined', () => {
    const store = makeCounter();
    expect(store.actions.nonexistent).toBeUndefined();
  });
});

// ── store.watch ───────────────────────────────────────────

describe('store.watch', () => {
  it('fires callback when selected value changes', () => {
    const store = makeCounter();
    const cb = vi.fn();
    store.watch((s) => s.count, cb);
    store.dispatch('increment');
    expect(cb).toHaveBeenCalledWith(1, 0);
  });

  it('does not fire when unrelated state changes', () => {
    const store = createStore({
      state: { x: 1, y: 2 },
      actions: {
        setY: (s, v) => ({ ...s, y: v }),
      },
    });
    const cb = vi.fn();
    store.watch((s) => s.x, cb);
    store.dispatch('setY', 99);
    expect(cb).not.toHaveBeenCalled();
  });

  it('provides correct prev and next values', () => {
    const store = makeCounter();
    const cb = vi.fn();
    store.watch((s) => s.count, cb);
    store.dispatch('set', 10);
    store.dispatch('increment');
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[0]).toEqual([10, 0]);
    expect(cb.mock.calls[1]).toEqual([11, 10]);
  });

  it('returns unsubscribe function', () => {
    const store = makeCounter();
    const cb = vi.fn();
    const unsub = store.watch((s) => s.count, cb);
    unsub();
    store.dispatch('increment');
    expect(cb).not.toHaveBeenCalled();
  });

  it('uses shallow equality for objects', () => {
    const store = createStore({
      state: { items: [1, 2, 3] },
      actions: {
        setItems: (s, items) => ({ ...s, items }),
        noop: (s) => ({ ...s }), // new reference but same items
      },
    });
    const cb = vi.fn();
    store.watch((s) => s.items, cb);
    store.dispatch('noop'); // items array is same reference
    expect(cb).not.toHaveBeenCalled();
    store.dispatch('setItems', [4, 5]);
    expect(cb).toHaveBeenCalledWith([4, 5], [1, 2, 3]);
  });

  it('does not fire on identity-returning actions', () => {
    const store = makeCounter();
    const cb = vi.fn();
    store.watch((s) => s.count, cb);
    store.dispatch('noop');
    expect(cb).not.toHaveBeenCalled();
  });
});
