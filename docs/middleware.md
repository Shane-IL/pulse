# Middleware

Middleware lets you intercept and extend store dispatches. It's useful for logging, action recording, validation, and building developer tools.

## How It Works

Middleware uses an **onion model** — each middleware wraps the next, running code before and after the core action:

```
dispatch('increment')
    │
    ▼
  middleware A (before)
    │
    ▼
  middleware B (before)
    │
    ▼
  core action runs ← (state, payload) => newState
    │
    ▼
  middleware B (after)
    │
    ▼
  middleware A (after)
```

Each middleware is a function `(ctx, next) => void`. Call `next()` to continue down the chain. Skip `next()` to block the action entirely.

## Adding Middleware

Pass a `middleware` array to `createStore`:

```js
import { createStore, logger, actionHistory } from '@shane_il/pulse';

const history = [];

const store = createStore({
  name: 'counter',
  state: { count: 0 },
  actions: {
    increment: (s) => s.count++,
    set: (s, v) => (s.count = v),
  },
  middleware: [logger(), actionHistory(history)],
});
```

### Zero Overhead When Not Used

When no middleware is provided (or the array is empty), dispatch uses the same fast path as before — no wrapper, no context object, no function chain. Middleware is strictly opt-in.

## The Context Object

Every middleware receives a `DispatchContext`:

```ts
interface DispatchContext<S> {
  store: Store<S>; // the store being dispatched on
  actionName: string; // 'increment', 'set', etc.
  payload: any; // the dispatch payload
  prevState: S; // state before the action
  nextState: S | undefined; // state after — populated after next()
}
```

- `prevState` is always available.
- `nextState` is `undefined` until `next()` completes. After `next()`, it holds the new state (or the same reference if the action was a no-op).
- `payload` is mutable — middleware can modify it before `next()`.

## Built-in Middleware

### `logger()`

Logs each dispatch with prev state, payload, and next state using `console.group`:

```js
import { logger } from '@shane_il/pulse';

const store = createStore({
  name: 'counter',
  state: { count: 0 },
  actions: { increment: (s) => s.count++ },
  middleware: [logger()],
});

store.dispatch('increment');
// Console output:
// ▸ [pulse] increment
//     prev state  { count: 0 }
//     payload     undefined
//     next state  { count: 1 }
```

### `actionHistory(history[], opts?)`

Records every dispatch into a caller-owned array:

```js
import { actionHistory } from '@shane_il/pulse';

const history = [];
const store = createStore({
  state: { count: 0 },
  actions: { increment: (s) => s.count++ },
  middleware: [actionHistory(history, { maxEntries: 100 })],
});

store.dispatch('increment');
console.log(history[0]);
// { actionName: 'increment', payload: undefined,
//   prevState: { count: 0 }, nextState: { count: 1 },
//   timestamp: 1742500000000 }
```

Each entry is an `ActionEntry`:

```ts
interface ActionEntry {
  actionName: string;
  payload: any;
  prevState: any;
  nextState: any;
  timestamp: number; // Date.now()
}
```

**Options:**

- `maxEntries` — cap the history size. When exceeded, oldest entries are removed. Defaults to `Infinity`.

The history array is owned by you — read it, clear it, serialize it, whatever you need. `actionHistory` just pushes to it.

## Custom Middleware

### Basic Example

```js
const timing = (ctx, next) => {
  const start = performance.now();
  next();
  const ms = (performance.now() - start).toFixed(2);
  console.log(`${ctx.actionName} took ${ms}ms`);
};
```

### Blocking Actions

Don't call `next()` to prevent the action from running:

```js
const validator = (ctx, next) => {
  if (ctx.actionName === 'set' && ctx.payload < 0) {
    console.warn('Blocked negative value');
    return; // action never executes
  }
  next();
};
```

### Modifying Payloads

Middleware can transform the payload before it reaches the action:

```js
const normalizer = (ctx, next) => {
  if (ctx.actionName === 'setName') {
    ctx.payload = ctx.payload.trim().toLowerCase();
  }
  next();
};
```

### Side Effects After Actions

Run code after the action completes by placing it after `next()`:

```js
const persister = (ctx, next) => {
  next();
  // State has been updated — persist to localStorage
  localStorage.setItem('app-state', JSON.stringify(ctx.nextState));
};
```

### Composing Multiple Middleware

Middleware runs in array order. The first middleware is the outermost wrapper:

```js
middleware: [auth, validator, logger(), actionHistory(history)];
// Execution: auth → validator → logger → actionHistory → core action
//            auth ← validator ← logger ← actionHistory ← (return)
```

## Async Actions

`createAsyncAction` wraps an async operation with synchronous store dispatches — no middleware or special store support needed.

```js
import { createStore, createAsyncAction } from '@shane_il/pulse';

const userStore = createStore({
  state: { user: null, loading: false, error: null },
  actions: {
    fetchStart: (s) => { s.loading = true; s.error = null },
    fetchOk: (s, user) => { s.loading = false; s.user = user },
    fetchFail: (s, error) => { s.loading = false; s.error = error },
  },
});

const loadUser = createAsyncAction(userStore, {
  start: 'fetchStart',
  run: async (id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  },
  ok: 'fetchOk',
  fail: 'fetchFail',
});

// Use it like a normal async function
const user = await loadUser(42);
```

### Config

```ts
interface AsyncActionConfig {
  start?: string; // action dispatched immediately (optional)
  run: (...args) => Promise<R>; // your async work
  ok: string; // action dispatched with the resolved value
  fail?: string; // action dispatched with the error message (optional)
}
```

- **`start`** — optional. Dispatched synchronously before `run`. Use for setting loading state.
- **`run`** — your async function. Receives whatever arguments you pass to the returned function.
- **`ok`** — dispatched with the resolved value of `run`.
- **`fail`** — optional. Dispatched with `error.message` if `run` rejects. If omitted, errors propagate normally (thrown from the returned function).

### Return Value

`createAsyncAction` returns an async function. That function returns whatever `run` resolves to:

```js
const result = await loadUser(42);
// result is the parsed JSON from the fetch
```

### Without `start` or `fail`

Both are optional. At minimum you need `run` and `ok`:

```js
const refresh = createAsyncAction(store, {
  run: () => fetch('/api/data').then((r) => r.json()),
  ok: 'setData',
});

await refresh(); // dispatches 'setData' with the result, errors throw
```

### Philosophy

`createAsyncAction` is just orchestration sugar. The store stays synchronous and pure — all actions are still `(state, payload) => newState`. The async wrapper lives outside the store, keeping the separation clean.
