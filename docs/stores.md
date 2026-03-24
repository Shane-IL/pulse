# Stores

Stores are the heart of Pulse. They hold immutable state, expose named actions for mutations, and notify subscribers when state changes. Stores are framework-agnostic — you can use them with Pulse, React, vanilla JS, or anything else.

## Creating a Store

```js
import { createStore } from '@shane_il/pulse';

const todoStore = createStore({
  state: {
    items: [],
    filter: 'all', // 'all' | 'active' | 'completed'
  },
  actions: {
    add: (s, text) => {
      s.items.push({ id: Date.now(), text, done: false });
    },
    toggle: (s, id) => {
      const item = s.items.find((i) => i.id === id);
      item.done = !item.done;
    },
    remove: (s, id) => {
      const idx = s.items.findIndex((i) => i.id === id);
      s.items.splice(idx, 1);
    },
    setFilter: (s, filter) => ({ filter }),
  },
});
```

### Store Config

| Field        | Required | Description                                                       |
| ------------ | -------- | ----------------------------------------------------------------- |
| `state`      | yes      | Initial state object                                              |
| `actions`    | yes      | Named action functions: `(state, payload?) => newState`           |
| `name`       | no       | Display name (used by devtools and logger middleware)             |
| `middleware` | no       | Array of middleware functions (see [Middleware](./middleware.md)) |

When no middleware is provided, dispatch uses a zero-overhead fast path — no wrapper objects, no function chains.

## Reading State

```js
todoStore.getState();
// { items: [], filter: 'all' }
```

`getState()` returns the current state snapshot. It's always a reference to the latest state — never stale.

## Dispatching Actions

There are two ways to dispatch:

```js
// String-based dispatch — serializable, loggable
todoStore.dispatch('add', 'Buy milk');
todoStore.dispatch('toggle', 1742500000000);

// Action dispatchers — cleaner call syntax
todoStore.actions.add('Buy milk');
todoStore.actions.toggle(1742500000000);
todoStore.actions.setFilter('active');
```

Both are equivalent. `store.actions` is an object with one method per action defined in the store config. Under the hood, `store.actions.add(payload)` calls `store.dispatch('add', payload)`.

- Unknown action names throw: `[pulse] Unknown action: "typo"`.
- Payload is optional — actions like `clearAll: () => replace({ items: [] })` ignore the second argument.

## Writing Actions

Return an object with only the fields you're changing — Pulse merges it into state:

```js
actions: {
  increment: (s) => ({ count: s.count + 1 }),
  setTheme: (s, theme) => ({ theme }),
  setUser: (s, user) => ({ user, loading: false }),
}
```

No spreading the whole state, no manual cloning — just return what changed.

### Complex Updates

For nested objects and arrays, mutate the state parameter directly. Pulse uses a structural-sharing proxy behind the scenes:

```js
actions: {
  toggle: (s, id) => {
    const item = s.items.find(i => i.id === id);
    item.done = !item.done;
  },
  addItem: (s, text) => {
    s.items.push({ id: Date.now(), text, done: false });
  },
}
```

Arrays work naturally: `push`, `pop`, `splice`, `sort`, `reverse`, `shift`, `unshift` all work.

### Full State Replacement

When you need to replace the entire state (e.g., a reset), use `replace()`:

```js
import { replace } from '@shane_il/pulse';

actions: {
  reset: () => replace({ items: [], filter: 'all' }),
  loadSnapshot: (s, snapshot) => replace(snapshot),
}
```

## Identity Check

If an action doesn't mutate anything, the state reference stays the same and subscribers are **not** notified:

```js
const store = createStore({
  state: { count: 0 },
  actions: {
    incrementIfPositive: (s) => {
      if (s.count >= 0) s.count++;
      // if count < 0, nothing is mutated → no-op, subscribers NOT called
    },
  },
});
```

## Subscriptions

```js
const unsub = todoStore.subscribe((newState) => {
  console.log('Todos changed:', newState.items.length);
});

// Later: stop listening
unsub();
```

- Subscribers are called synchronously after each dispatch that produces a new state.
- The callback receives the new state as its argument.
- `subscribe()` returns an unsubscribe function.
- You rarely need manual subscriptions — `connect()` handles this for components.

### Watching a Slice

`watch()` is a selective subscription that only fires when a chosen slice of state changes:

```js
const unsub = todoStore.watch(
  (s) => s.items.length,
  (count, prevCount) => console.log(`Todos: ${prevCount} → ${count}`),
);
```

- The selector runs on every dispatch; the callback only fires when the selected value changes (shallow comparison).
- Receives `(newValue, previousValue)` — useful for side effects like analytics, localStorage sync, or logging.
- Returns an unsubscribe function, just like `subscribe()`.

## Selectors

Selectors extract slices of state for use with `connect()`:

```js
const countSelector = todoStore.select((state) => state.items.length);
const activeSelector = todoStore.select((state) =>
  state.items.filter((item) => !item.done),
);
```

`select(fn)` returns a `{ store, selector }` binding object — it doesn't call the function immediately. The selector runs when `connect()` checks for changes.

### Picking Multiple Keys

When you just want several top-level state properties, `pick()` is a shorthand that returns a bindings object:

```js
// Instead of:
connect({
  user: authStore.select((s) => s.user),
  loading: authStore.select((s) => s.loading),
})(Component);

// You can write:
connect(authStore.pick('user', 'loading'))(Component);

// Or merge picks from multiple stores:
connect({
  ...authStore.pick('user'),
  ...todoStore.pick('items', 'filter'),
})(Dashboard);
```

### Derived State via Selectors

Selectors can compute derived values:

```js
const Connected = connect({
  total: todoStore.select((s) => s.items.length),
  remaining: todoStore.select((s) => s.items.filter((i) => !i.done).length),
  filtered: todoStore.select((s) => {
    if (s.filter === 'all') return s.items;
    if (s.filter === 'active') return s.items.filter((i) => !i.done);
    return s.items.filter((i) => i.done);
  }),
})(TodoList);
```

> **Performance note:** Selectors run on every store change to check if the component needs to re-render. Keep them fast — avoid heavy computation inside selectors. If a selector returns a new array/object reference every time (like `filter()`), the component will re-render on every dispatch. For expensive derived state, consider caching the result in the store itself via an action.

## Multiple Stores

Use multiple stores to separate concerns:

```js
const authStore = createStore({
  state: { user: null, loading: false },
  actions: {
    setUser: (s, user) => ({ user, loading: false }),
    logout: () => replace({ user: null, loading: false }),
    setLoading: () => ({ loading: true }),
  },
});

const todoStore = createStore({
  state: { items: [] },
  actions: {
    /* ... */
  },
});
```

A single component can connect to multiple stores:

```js
const Connected = connect({
  user: authStore.select((s) => s.user),
  todos: todoStore.select((s) => s.items),
})(Dashboard);
```

## Stores Outside Components

Stores are regular JS modules. Use them anywhere — event handlers, async functions, other stores' actions:

```js
// Fetch data and dispatch to store
async function loadTodos() {
  authStore.dispatch('setLoading');
  const res = await fetch('/api/todos');
  const items = await res.json();
  todoStore.dispatch('setItems', items);
  authStore.dispatch('setUser', { name: 'loaded' });
}

// Call from an onClick handler, a timer, a WebSocket handler — anywhere
loadTodos();
```

This is a core design difference from hooks-based frameworks: **side effects live outside the component tree**, making them easier to test, share, and reason about.

For a more structured approach to async operations, see [`createAsyncAction`](./middleware.md#async-actions) — a thin wrapper that dispatches loading/success/error actions around an async function.
