import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/store';
import { logger, actionHistory, createAsyncAction } from '../src/middleware';

function makeCounter(middleware) {
  return createStore({
    state: { count: 0 },
    name: 'counter',
    actions: {
      increment: (state) => ({ ...state, count: state.count + 1 }),
      set: (state, value) => ({ ...state, count: value }),
      noop: (state) => state,
    },
    middleware,
  });
}

describe('middleware', () => {
  it('store without middleware works unchanged', () => {
    const store = makeCounter();
    store.dispatch('increment');
    expect(store.getState().count).toBe(1);
  });

  it('store with empty middleware array works', () => {
    const store = makeCounter([]);
    store.dispatch('increment');
    expect(store.getState().count).toBe(1);
  });

  it('single middleware sees ctx fields', () => {
    const seen = [];
    const mw = (ctx, next) => {
      seen.push({
        actionName: ctx.actionName,
        payload: ctx.payload,
        prevState: ctx.prevState,
        storeName: ctx.store.name,
      });
      next();
      seen.push({ nextState: ctx.nextState });
    };

    const store = makeCounter([mw]);
    store.dispatch('set', 42);

    expect(seen[0]).toEqual({
      actionName: 'set',
      payload: 42,
      prevState: { count: 0 },
      storeName: 'counter',
    });
    expect(seen[1]).toEqual({
      nextState: { count: 42 },
    });
  });

  it('middleware chain runs in order (onion model)', () => {
    const order = [];

    const first = (ctx, next) => {
      order.push('first-before');
      next();
      order.push('first-after');
    };
    const second = (ctx, next) => {
      order.push('second-before');
      next();
      order.push('second-after');
    };

    const store = makeCounter([first, second]);
    store.dispatch('increment');

    expect(order).toEqual([
      'first-before',
      'second-before',
      'second-after',
      'first-after',
    ]);
  });

  it('middleware can prevent action by not calling next', () => {
    const blocker = (_ctx, _next) => {
      // intentionally not calling next
    };

    const store = makeCounter([blocker]);
    store.dispatch('increment');
    expect(store.getState().count).toBe(0);
  });

  it('middleware can modify payload', () => {
    const doubler = (ctx, next) => {
      ctx.payload = ctx.payload * 2;
      next();
    };

    const store = makeCounter([doubler]);
    store.dispatch('set', 5);
    expect(store.getState().count).toBe(10);
  });

  it('subscribers fire through middleware dispatch', () => {
    const listener = vi.fn();
    const noop = (ctx, next) => next();
    const store = makeCounter([noop]);
    store.subscribe(listener);
    store.dispatch('increment');
    expect(listener).toHaveBeenCalledWith({ count: 1 });
  });

  it('identity return still skips notification with middleware', () => {
    const listener = vi.fn();
    const noop = (ctx, next) => next();
    const store = makeCounter([noop]);
    store.subscribe(listener);
    store.dispatch('noop');
    expect(listener).not.toHaveBeenCalled();
  });

  it('unknown action throws with middleware', () => {
    const noop = (ctx, next) => next();
    const store = makeCounter([noop]);
    expect(() => store.dispatch('unknown')).toThrow('[pulse] Unknown action: "unknown"');
  });

  it('store.name is set from config', () => {
    const store = makeCounter([]);
    expect(store.name).toBe('counter');
  });

  it('store.name is undefined when not set', () => {
    const store = createStore({
      state: { x: 0 },
      actions: { inc: (s) => ({ ...s, x: s.x + 1 }) },
    });
    expect(store.name).toBeUndefined();
  });

  it('__devtools_replace__ force-sets state', () => {
    const noop = (ctx, next) => next();
    const store = makeCounter([noop]);
    store.dispatch('increment');
    expect(store.getState().count).toBe(1);

    store.dispatch('__devtools_replace__', { count: 99 });
    expect(store.getState().count).toBe(99);
  });

  it('__devtools_replace__ notifies subscribers', () => {
    const listener = vi.fn();
    const noop = (ctx, next) => next();
    const store = makeCounter([noop]);
    store.subscribe(listener);
    store.dispatch('__devtools_replace__', { count: 50 });
    expect(listener).toHaveBeenCalledWith({ count: 50 });
  });
});

describe('logger middleware', () => {
  it('logs group with prev, payload, next state', () => {
    const group = vi.spyOn(console, 'group').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const store = makeCounter([logger()]);
    store.dispatch('set', 7);

    expect(group).toHaveBeenCalledWith('[pulse] set');
    expect(log).toHaveBeenCalledWith('prev state', { count: 0 });
    expect(log).toHaveBeenCalledWith('payload', 7);
    expect(log).toHaveBeenCalledWith('next state', { count: 7 });
    expect(groupEnd).toHaveBeenCalled();

    group.mockRestore();
    log.mockRestore();
    groupEnd.mockRestore();
  });
});

describe('actionHistory middleware', () => {
  it('records action entries', () => {
    const history = [];
    const store = makeCounter([actionHistory(history)]);

    store.dispatch('increment');
    store.dispatch('set', 10);

    expect(history).toHaveLength(2);
    expect(history[0].actionName).toBe('increment');
    expect(history[0].prevState).toEqual({ count: 0 });
    expect(history[0].nextState).toEqual({ count: 1 });
    expect(history[1].actionName).toBe('set');
    expect(history[1].payload).toBe(10);
    expect(history[1].nextState).toEqual({ count: 10 });
  });

  it('includes timestamps', () => {
    const history = [];
    const store = makeCounter([actionHistory(history)]);
    store.dispatch('increment');
    expect(typeof history[0].timestamp).toBe('number');
    expect(history[0].timestamp).toBeGreaterThan(0);
  });

  it('respects maxEntries', () => {
    const history = [];
    const store = makeCounter([actionHistory(history, { maxEntries: 2 })]);

    store.dispatch('increment');
    store.dispatch('increment');
    store.dispatch('increment');

    expect(history).toHaveLength(2);
    expect(history[0].prevState).toEqual({ count: 1 });
    expect(history[1].prevState).toEqual({ count: 2 });
  });

  it('records noop actions with same prev/next state', () => {
    const history = [];
    const store = makeCounter([actionHistory(history)]);
    store.dispatch('noop');
    expect(history).toHaveLength(1);
    expect(history[0].prevState).toEqual({ count: 0 });
    expect(history[0].nextState).toEqual({ count: 0 });
  });

  it('works with logger in chain', () => {
    const group = vi.spyOn(console, 'group').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const history = [];
    const store = makeCounter([logger(), actionHistory(history)]);
    store.dispatch('increment');

    expect(history).toHaveLength(1);
    expect(group).toHaveBeenCalled();

    group.mockRestore();
    log.mockRestore();
    groupEnd.mockRestore();
  });
});

describe('createAsyncAction', () => {
  function makeAsyncStore() {
    return createStore({
      state: { items: [], loading: false, error: null },
      actions: {
        fetchStart: (s) => ({ ...s, loading: true, error: null }),
        fetchOk: (s, items) => ({ ...s, loading: false, items }),
        fetchFail: (s, error) => ({ ...s, loading: false, error }),
      },
    });
  }

  it('dispatches start then ok on success', async () => {
    const store = makeAsyncStore();
    const load = createAsyncAction(store, {
      start: 'fetchStart',
      run: async () => ['a', 'b'],
      ok: 'fetchOk',
    });

    const promise = load();
    expect(store.getState().loading).toBe(true);

    await promise;
    expect(store.getState().loading).toBe(false);
    expect(store.getState().items).toEqual(['a', 'b']);
  });

  it('dispatches start then fail on error', async () => {
    const store = makeAsyncStore();
    const load = createAsyncAction(store, {
      start: 'fetchStart',
      run: async () => { throw new Error('network'); },
      ok: 'fetchOk',
      fail: 'fetchFail',
    });

    await load();
    expect(store.getState().loading).toBe(false);
    expect(store.getState().error).toBe('network');
    expect(store.getState().items).toEqual([]);
  });

  it('throws if no fail action and run rejects', async () => {
    const store = makeAsyncStore();
    const load = createAsyncAction(store, {
      run: async () => { throw new Error('boom'); },
      ok: 'fetchOk',
    });

    await expect(load()).rejects.toThrow('boom');
  });

  it('start is optional', async () => {
    const store = makeAsyncStore();
    const load = createAsyncAction(store, {
      run: async () => ['x'],
      ok: 'fetchOk',
    });

    await load();
    expect(store.getState().items).toEqual(['x']);
    expect(store.getState().loading).toBe(false);
  });

  it('passes arguments to run', async () => {
    const store = makeAsyncStore();
    const load = createAsyncAction(store, {
      run: async (query, limit) => [`${query}:${limit}`],
      ok: 'fetchOk',
    });

    await load('test', 5);
    expect(store.getState().items).toEqual(['test:5']);
  });

  it('returns the result from run', async () => {
    const store = makeAsyncStore();
    const load = createAsyncAction(store, {
      run: async () => ['result'],
      ok: 'fetchOk',
    });

    const result = await load();
    expect(result).toEqual(['result']);
  });
});
