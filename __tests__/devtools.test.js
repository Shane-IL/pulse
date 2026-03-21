import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStore } from '../src/store';
import { actionHistory } from '../src/middleware';
import { PulseDevtools, instrumentStore } from '../src/devtools/core';
import { travelTo, replayFrom } from '../src/devtools/time-travel';
import { __setComponentHooks, ComponentInstance, connect } from '../src/connect';

function makeTrackedCounter(dt, name = 'counter') {
  const history = [];
  const store = createStore({
    state: { count: 0 },
    name,
    actions: {
      increment: (state) => ({ ...state, count: state.count + 1 }),
      decrement: (state) => ({ ...state, count: state.count - 1 }),
      set: (state, value) => ({ ...state, count: value }),
    },
    middleware: [actionHistory(history)],
  });
  dt.registerStore(store, history, name);
  return { store, history };
}

describe('PulseDevtools', () => {
  let dt;

  beforeEach(() => {
    dt = new PulseDevtools();
  });

  it('registerStore tracks the store', () => {
    const { store } = makeTrackedCounter(dt);
    expect(dt.getStoreNames()).toEqual(['counter']);
    expect(dt.getStoreState('counter')).toEqual({ count: 0 });
  });

  it('emits store-registered event', () => {
    const listener = vi.fn();
    dt.on(listener);
    makeTrackedCounter(dt);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'store-registered', storeName: 'counter' }),
    );
  });

  it('emits action-dispatched on store dispatch', () => {
    const { store } = makeTrackedCounter(dt);
    const listener = vi.fn();
    dt.on(listener);
    store.dispatch('increment');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'action-dispatched', storeName: 'counter' }),
    );
  });

  it('getHistory returns action history for a store', () => {
    const { store, history } = makeTrackedCounter(dt);
    store.dispatch('increment');
    store.dispatch('set', 5);
    expect(dt.getHistory('counter')).toBe(history);
    expect(dt.getHistory('counter')).toHaveLength(2);
  });

  it('getHistory without name returns all sorted by timestamp', () => {
    const { store: s1 } = makeTrackedCounter(dt, 'a');
    const { store: s2 } = makeTrackedCounter(dt, 'b');
    s1.dispatch('increment');
    s2.dispatch('increment');
    s1.dispatch('increment');
    const all = dt.getHistory();
    expect(all).toHaveLength(3);
    // Sorted by timestamp
    for (let i = 1; i < all.length; i++) {
      expect(all[i].timestamp).toBeGreaterThanOrEqual(all[i - 1].timestamp);
    }
  });

  it('tracks multiple stores', () => {
    makeTrackedCounter(dt, 'a');
    makeTrackedCounter(dt, 'b');
    expect(dt.getStoreNames()).toEqual(['a', 'b']);
  });

  it('on() returns unsubscribe function', () => {
    const listener = vi.fn();
    const unsub = dt.on(listener);
    unsub();
    makeTrackedCounter(dt);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('instrumentStore', () => {
  it('creates store with actionHistory and registers it', () => {
    const dt = new PulseDevtools();
    const { store, history } = instrumentStore(dt, {
      state: { x: 0 },
      name: 'test',
      actions: {
        inc: (s) => ({ ...s, x: s.x + 1 }),
      },
    });

    store.dispatch('inc');
    expect(store.getState().x).toBe(1);
    expect(history).toHaveLength(1);
    expect(dt.getStoreNames()).toEqual(['test']);
  });

  it('preserves additional middleware', () => {
    const dt = new PulseDevtools();
    const order = [];
    const custom = (ctx, next) => {
      order.push('custom');
      next();
    };

    const { store } = instrumentStore(dt, {
      state: { x: 0 },
      name: 'test',
      actions: { inc: (s) => ({ ...s, x: s.x + 1 }) },
      middleware: [custom],
    });

    store.dispatch('inc');
    expect(order).toEqual(['custom']);
    expect(store.getState().x).toBe(1);
  });
});

describe('time-travel', () => {
  let dt;

  beforeEach(() => {
    dt = new PulseDevtools();
  });

  it('travelTo sets state to historical snapshot', () => {
    const { store } = makeTrackedCounter(dt);
    store.dispatch('increment'); // count: 1
    store.dispatch('increment'); // count: 2
    store.dispatch('increment'); // count: 3

    travelTo(dt, 'counter', 0); // back to count: 1
    expect(store.getState().count).toBe(1);
  });

  it('travelTo emits time-travel event', () => {
    const { store } = makeTrackedCounter(dt);
    store.dispatch('increment');

    const listener = vi.fn();
    dt.on(listener);
    travelTo(dt, 'counter', 0);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'time-travel',
        storeName: 'counter',
        data: { entryIndex: 0 },
      }),
    );
  });

  it('travelTo throws on unknown store', () => {
    expect(() => travelTo(dt, 'nope', 0)).toThrow('[pulse-devtools] Unknown store: "nope"');
  });

  it('travelTo throws on out-of-range index', () => {
    const { store } = makeTrackedCounter(dt);
    store.dispatch('increment');
    expect(() => travelTo(dt, 'counter', 5)).toThrow('out of range');
  });

  it('replayFrom re-executes actions from a point', () => {
    const { store } = makeTrackedCounter(dt);
    store.dispatch('increment'); // 0 → 1
    store.dispatch('increment'); // 1 → 2
    store.dispatch('increment'); // 2 → 3

    // Replay from index 1 means: reset to prevState of entry 1 (count=1),
    // then replay entry 1 (inc→2), entry 2 (inc→3)
    replayFrom(dt, 'counter', 1);
    expect(store.getState().count).toBe(3);
  });

  it('replayFrom from index 0 replays all', () => {
    const { store } = makeTrackedCounter(dt);
    store.dispatch('increment'); // 0 → 1
    store.dispatch('set', 10);  // 1 → 10

    replayFrom(dt, 'counter', 0);
    expect(store.getState().count).toBe(10);
  });

  it('replayFrom throws on unknown store', () => {
    expect(() => replayFrom(dt, 'nope', 0)).toThrow('[pulse-devtools] Unknown store: "nope"');
  });
});

describe('component tracking hooks', () => {
  let dt;
  let mountedInstances;
  let unmountedInstances;

  beforeEach(() => {
    dt = new PulseDevtools();
    mountedInstances = [];
    unmountedInstances = [];

    __setComponentHooks(
      (instance) => {
        const bindings = instance.connectedFn._bindings || {};
        const storeNames = Object.values(bindings).map(
          (b) => b.store.name || 'unnamed',
        );
        const id = dt.trackComponent(
          instance.connectedFn.displayName || 'Unknown',
          storeNames,
        );
        instance._devtoolsId = id;
        mountedInstances.push(instance);
      },
      (instance) => {
        if (instance._devtoolsId) {
          dt.untrackComponent(instance._devtoolsId);
        }
        unmountedInstances.push(instance);
      },
    );
  });

  // Reset hooks after tests
  afterEach(() => {
    __setComponentHooks(null, null);
  });

  it('mount hook fires on ComponentInstance.mount()', () => {
    const store = createStore({
      state: { x: 0 },
      name: 'test',
      actions: { inc: (s) => ({ ...s, x: s.x + 1 }) },
    });

    const Connected = connect({
      x: store.select((s) => s.x),
    })((props) => null);

    const instance = new ComponentInstance(Connected, {});
    instance.mount(document.createElement('div'), () => {});

    expect(mountedInstances).toHaveLength(1);
    expect(dt.getComponents()).toHaveLength(1);
    expect(dt.getComponents()[0].storeNames).toEqual(['test']);
  });

  it('unmount hook fires on ComponentInstance.unmount()', () => {
    const store = createStore({
      state: { x: 0 },
      name: 'test',
      actions: { inc: (s) => ({ ...s, x: s.x + 1 }) },
    });

    const Connected = connect({
      x: store.select((s) => s.x),
    })((props) => null);

    const instance = new ComponentInstance(Connected, {});
    instance.mount(document.createElement('div'), () => {});
    expect(dt.getComponents()).toHaveLength(1);

    instance.unmount();
    expect(unmountedInstances).toHaveLength(1);
    expect(dt.getComponents()).toHaveLength(0);
  });

  it('hooks are zero-cost when null', () => {
    __setComponentHooks(null, null);

    const store = createStore({
      state: { x: 0 },
      actions: { inc: (s) => ({ ...s, x: s.x + 1 }) },
    });

    const Connected = connect({
      x: store.select((s) => s.x),
    })((props) => null);

    const instance = new ComponentInstance(Connected, {});
    // Should not throw
    instance.mount(document.createElement('div'), () => {});
    instance.unmount();
    expect(mountedInstances).toHaveLength(0);
  });
});

// need afterEach import
import { afterEach } from 'vitest';
