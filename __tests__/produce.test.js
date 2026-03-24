import { describe, it, expect, vi } from 'vitest';
import { produce, replace } from '../src/produce';
import { createStore } from '../src/store';

// ── produce (standalone) ──────────────────────────────────

describe('produce', () => {
  it('shallow mutation creates new object', () => {
    const base = { a: 1, b: 2 };
    const next = produce(base, (draft) => {
      draft.a = 10;
    });
    expect(next).toEqual({ a: 10, b: 2 });
    expect(next).not.toBe(base);
    expect(base.a).toBe(1); // original untouched
  });

  it('returns same reference when nothing is mutated', () => {
    const base = { a: 1 };
    const next = produce(base, () => {});
    expect(next).toBe(base);
  });

  it('returns same reference when same value is set', () => {
    const base = { a: 1 };
    const next = produce(base, (draft) => {
      draft.a = 1;
    });
    expect(next).toBe(base);
  });

  it('deep mutation with structural sharing', () => {
    const base = {
      user: { name: 'Alice', age: 30 },
      settings: { theme: 'dark' },
    };
    const next = produce(base, (draft) => {
      draft.user.age = 31;
    });
    expect(next).not.toBe(base);
    expect(next.user).not.toBe(base.user);
    expect(next.user.age).toBe(31);
    // Untouched branch shares reference
    expect(next.settings).toBe(base.settings);
  });

  it('array push', () => {
    const base = { items: [1, 2, 3] };
    const next = produce(base, (draft) => {
      draft.items.push(4);
    });
    expect(next.items).toEqual([1, 2, 3, 4]);
    expect(base.items).toEqual([1, 2, 3]); // original untouched
  });

  it('array splice', () => {
    const base = { items: ['a', 'b', 'c'] };
    const next = produce(base, (draft) => {
      draft.items.splice(1, 1);
    });
    expect(next.items).toEqual(['a', 'c']);
    expect(base.items).toEqual(['a', 'b', 'c']);
  });

  it('array index assignment', () => {
    const base = { items: [1, 2, 3] };
    const next = produce(base, (draft) => {
      draft.items[0] = 99;
    });
    expect(next.items).toEqual([99, 2, 3]);
    expect(base.items).toEqual([1, 2, 3]);
  });

  it('array sort', () => {
    const base = { nums: [3, 1, 2] };
    const next = produce(base, (draft) => {
      draft.nums.sort();
    });
    expect(next.nums).toEqual([1, 2, 3]);
    expect(base.nums).toEqual([3, 1, 2]);
  });

  it('array pop', () => {
    const base = { items: [1, 2, 3] };
    const next = produce(base, (draft) => {
      draft.items.pop();
    });
    expect(next.items).toEqual([1, 2]);
  });

  it('array reverse', () => {
    const base = { items: [1, 2, 3] };
    const next = produce(base, (draft) => {
      draft.items.reverse();
    });
    expect(next.items).toEqual([3, 2, 1]);
    expect(base.items).toEqual([1, 2, 3]);
  });

  it('array unshift', () => {
    const base = { items: [2, 3] };
    const next = produce(base, (draft) => {
      draft.items.unshift(1);
    });
    expect(next.items).toEqual([1, 2, 3]);
  });

  it('nested array mutation', () => {
    const base = {
      lists: [
        { id: 1, items: ['a'] },
        { id: 2, items: ['b'] },
      ],
    };
    const next = produce(base, (draft) => {
      draft.lists[1].items.push('c');
    });
    expect(next.lists[1].items).toEqual(['b', 'c']);
    // Structural sharing: list[0] untouched
    expect(next.lists[0]).toBe(base.lists[0]);
    expect(next.lists[1]).not.toBe(base.lists[1]);
  });

  it('delete property', () => {
    const base = { a: 1, b: 2 };
    const next = produce(base, (draft) => {
      delete draft.b;
    });
    expect(next).toEqual({ a: 1 });
    expect(base).toEqual({ a: 1, b: 2 });
  });

  it('add new property', () => {
    const base = { a: 1 };
    const next = produce(base, (draft) => {
      draft.b = 2;
    });
    expect(next).toEqual({ a: 1, b: 2 });
    expect(base).toEqual({ a: 1 });
  });

  it('multiple mutations in one recipe', () => {
    const base = { x: 1, y: 2, z: { nested: true } };
    const next = produce(base, (draft) => {
      draft.x = 10;
      draft.y = 20;
      draft.z.nested = false;
    });
    expect(next).toEqual({ x: 10, y: 20, z: { nested: false } });
    expect(base.z.nested).toBe(true);
  });

  it('Array.isArray works on proxy', () => {
    const base = { items: [1, 2] };
    produce(base, (draft) => {
      expect(Array.isArray(draft.items)).toBe(true);
    });
  });

  it('handles map/filter on draft arrays', () => {
    const base = {
      items: [
        { id: 1, done: false },
        { id: 2, done: true },
      ],
    };
    const next = produce(base, (draft) => {
      const item = draft.items.find((i) => i.id === 1);
      item.done = true;
    });
    expect(next.items[0].done).toBe(true);
    expect(next.items[1]).toBe(base.items[1]); // structural sharing
  });
});

// ── mutation-style store actions ──────────────────────────

describe('mutation-style store actions', () => {
  it('basic mutation action works', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (prevState) => {
          prevState.count++;
        },
      },
    });
    store.dispatch('increment');
    expect(store.getState().count).toBe(1);
  });

  it('mutation with payload', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        set: (prevState, value) => {
          prevState.count = value;
        },
      },
    });
    store.dispatch('set', 42);
    expect(store.getState().count).toBe(42);
  });

  it('no-op mutation does not notify', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        noop: () => {},
      },
    });
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch('noop');
    expect(listener).not.toHaveBeenCalled();
  });

  it('replace() swaps entire state', () => {
    const store = createStore({
      state: { count: 5, name: 'test' },
      actions: {
        reset: () => replace({ count: 0, name: 'reset' }),
      },
    });
    store.dispatch('reset');
    expect(store.getState()).toEqual({ count: 0, name: 'reset' });
  });

  it('replace() with payload', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        load: (_s, snapshot) => replace(snapshot),
      },
    });
    store.dispatch('load', { count: 99 });
    expect(store.getState().count).toBe(99);
  });

  it('mutation and replace coexist in same store', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (s) => { s.count++ },
        reset: () => replace({ count: 0 }),
      },
    });
    store.dispatch('increment');
    store.dispatch('increment');
    expect(store.getState().count).toBe(2);
    store.dispatch('reset');
    expect(store.getState().count).toBe(0);
  });

  it('deep nested mutation', () => {
    const store = createStore({
      state: {
        user: { profile: { name: 'Alice', settings: { theme: 'light' } } },
      },
      actions: {
        setTheme: (prevState, theme) => {
          prevState.user.profile.settings.theme = theme;
        },
      },
    });
    const original = store.getState();
    store.dispatch('setTheme', 'dark');
    const next = store.getState();
    expect(next.user.profile.settings.theme).toBe('dark');
    expect(original.user.profile.settings.theme).toBe('light');
  });

  it('array mutation in action', () => {
    const store = createStore({
      state: { items: [] },
      actions: {
        add: (prevState, item) => {
          prevState.items.push(item);
        },
        remove: (prevState, index) => {
          prevState.items.splice(index, 1);
        },
      },
    });
    store.dispatch('add', 'a');
    store.dispatch('add', 'b');
    store.dispatch('add', 'c');
    expect(store.getState().items).toEqual(['a', 'b', 'c']);
    store.dispatch('remove', 1);
    expect(store.getState().items).toEqual(['a', 'c']);
  });

  it('toggle pattern with find', () => {
    const store = createStore({
      state: {
        items: [
          { id: 1, done: false },
          { id: 2, done: false },
        ],
      },
      actions: {
        toggle: (prevState, id) => {
          const item = prevState.items.find((i) => i.id === id);
          item.done = !item.done;
        },
      },
    });
    store.dispatch('toggle', 1);
    expect(store.getState().items[0].done).toBe(true);
    expect(store.getState().items[1].done).toBe(false);
  });

  it('works with store.actions dispatchers', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (prevState) => {
          prevState.count++;
        },
      },
    });
    store.actions.increment();
    expect(store.getState().count).toBe(1);
  });

  it('works with middleware', () => {
    const log = [];
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (prevState) => {
          prevState.count++;
        },
      },
      middleware: [
        (ctx, next) => {
          log.push(`before:${ctx.actionName}`);
          next();
          log.push(`after:${ctx.nextState?.count}`);
        },
      ],
    });
    store.dispatch('increment');
    expect(store.getState().count).toBe(1);
    expect(log).toEqual(['before:increment', 'after:1']);
  });

  it('structural sharing preserved', () => {
    const store = createStore({
      state: {
        a: { value: 1 },
        b: { value: 2 },
      },
      actions: {
        setA: (prevState, v) => {
          prevState.a.value = v;
        },
      },
    });
    const before = store.getState();
    store.dispatch('setA', 10);
    const after = store.getState();
    expect(after.a.value).toBe(10);
    // b was not touched — same reference
    expect(after.b).toBe(before.b);
  });

  it('watch works with mutation-style actions', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (prevState) => {
          prevState.count++;
        },
      },
    });
    const cb = vi.fn();
    store.watch((s) => s.count, cb);
    store.dispatch('increment');
    expect(cb).toHaveBeenCalledWith(1, 0);
  });
});
