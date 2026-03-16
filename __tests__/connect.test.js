import { describe, it, expect, vi } from 'vitest';
import { connect, CONNECTED, ComponentInstance, shallowEqual } from '../src/connect.js';
import { createStore } from '../src/store.js';
import { flushSync } from '../src/scheduler.js';

describe('connect', () => {
  it('returns a function', () => {
    const store = createStore({ state: { x: 1 }, actions: {} });
    const wrapped = connect({ x: store.select(s => s.x) })(function C() {});
    expect(typeof wrapped).toBe('function');
  });

  it('tags with CONNECTED symbol', () => {
    const store = createStore({ state: { x: 1 }, actions: {} });
    const wrapped = connect({ x: store.select(s => s.x) })(function C() {});
    expect(wrapped[CONNECTED]).toBe(true);
  });

  it('merges selected props into component call', () => {
    const store = createStore({ state: { count: 42 }, actions: {} });
    const inner = vi.fn(() => null);
    const Connected = connect({ count: store.select(s => s.count) })(inner);
    Connected({ extra: 'prop' });
    expect(inner).toHaveBeenCalledWith({ count: 42, extra: 'prop' });
  });

  it('explicit props override selected props', () => {
    const store = createStore({ state: { count: 42 }, actions: {} });
    const inner = vi.fn(() => null);
    const Connected = connect({ count: store.select(s => s.count) })(inner);
    Connected({ count: 99 });
    expect(inner).toHaveBeenCalledWith({ count: 99 });
  });

  it('sets displayName', () => {
    const store = createStore({ state: {}, actions: {} });
    function MyComponent() {}
    const Connected = connect({})(MyComponent);
    expect(Connected.displayName).toBe('Connected(MyComponent)');
  });
});

describe('ComponentInstance', () => {
  it('mount subscribes to stores', () => {
    const store = createStore({ state: { x: 1 }, actions: { inc: s => ({ x: s.x + 1 }) } });
    function Inner() { return null; }
    const Connected = connect({ x: store.select(s => s.x) })(Inner);
    const instance = new ComponentInstance(Connected, {});

    const renderCb = vi.fn();
    instance.mount(document.createElement('div'), renderCb);

    store.dispatch('inc');
    flushSync();
    // Should have been called via the scheduler
    expect(renderCb).toHaveBeenCalled();
  });

  it('unmount unsubscribes from stores', () => {
    const store = createStore({ state: { x: 1 }, actions: { inc: s => ({ x: s.x + 1 }) } });
    function Inner() { return null; }
    const Connected = connect({ x: store.select(s => s.x) })(Inner);
    const instance = new ComponentInstance(Connected, {});

    const renderCb = vi.fn();
    instance.mount(document.createElement('div'), renderCb);
    instance.unmount();

    renderCb.mockClear();
    store.dispatch('inc');
    expect(renderCb).not.toHaveBeenCalled();
  });

  it('skips render when shallowEqual', () => {
    const store = createStore({
      state: { x: 1 },
      actions: { noop: s => ({ ...s }) }, // new object, same values
    });
    function Inner() { return null; }
    // Selector returns a primitive, so shallow equal on primitives
    const Connected = connect({ x: store.select(s => s.x) })(Inner);
    const instance = new ComponentInstance(Connected, {});

    const renderCb = vi.fn();
    instance.mount(document.createElement('div'), renderCb);

    store.dispatch('noop');
    expect(renderCb).not.toHaveBeenCalled();
  });
});

describe('shallowEqual', () => {
  it('returns true for identical values', () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual('a', 'a')).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(shallowEqual(1, 2)).toBe(false);
  });

  it('returns true for objects with same keys/values', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('returns false for objects with different values', () => {
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('returns false for objects with different keys', () => {
    expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('handles null', () => {
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, { a: 1 })).toBe(false);
    expect(shallowEqual({ a: 1 }, null)).toBe(false);
  });

  it('handles NaN', () => {
    expect(shallowEqual(NaN, NaN)).toBe(true);
  });
});
