# Pulse

> **Note:** This is an experiment in iterative AI-assisted development — a "see if I could" project more than anything production-grade. The goal was to build something resembling pre-hooks React but without the lifecycle method mess: just pure render functions, external stores, and a clean connect API. Every commit was planned and written collaboratively with Claude Code.

A render-driven UI framework with virtual DOM and immutable stores. Like React, but with no hooks — state stores are first-class citizens and components are pure render functions.

## Why Pulse?

- **No hooks.** All state lives in external stores. Components are `(props) => VNode`.
- **Stores are first-class.** Create, import, and share stores anywhere. They're framework-agnostic.
- **Render-driven.** Describe what the UI looks like for a given state. Pulse handles the rest.
- **Built-in routing.** Store-based client-side router — routes are just state.
- **Middleware.** Pluggable middleware for logging, action history, and custom logic.
- **Devtools.** Built-in browser devtools panel — store inspector, action replay, time-travel.
- **Tiny.** ~6 KB gzipped core, ~9 KB devtools. Zero runtime dependencies.

## Quick Start

```bash
npm install @shane_il/pulse
```

Configure your JSX pragma (jsconfig.json, tsconfig.json, or Babel):

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  }
}
```

## Example

```jsx
import { h, createStore, connect, render } from '@shane_il/pulse';

// 1. Create a store
const counterStore = createStore({
  state: { count: 0 },
  actions: {
    increment: (state) => ({ ...state, count: state.count + 1 }),
    decrement: (state) => ({ ...state, count: state.count - 1 }),
    set: (state, value) => ({ ...state, count: value }),
  },
});

// 2. Write a pure component
function Counter({ count }) {
  return (
    <div>
      <h1>{count}</h1>
      <button onClick={() => counterStore.dispatch('increment')}>+</button>
      <button onClick={() => counterStore.dispatch('decrement')}>-</button>
    </div>
  );
}

// 3. Connect it to the store
const ConnectedCounter = connect({
  count: counterStore.select((state) => state.count),
})(Counter);

// 4. Render
render(<ConnectedCounter />, document.getElementById('app'));
```

## API

### `createStore({ state, actions, name?, middleware? })`

Creates an immutable state store.

```js
const store = createStore({
  state: { count: 0 },
  actions: {
    increment: (state) => ({ ...state, count: state.count + 1 }),
    set: (state, value) => ({ ...state, count: value }),
  },
});

store.getState();              // { count: 0 }
store.dispatch('increment');   // state is now { count: 1 }
store.dispatch('set', 42);     // state is now { count: 42 }

const unsub = store.subscribe((newState) => {
  console.log('State changed:', newState);
});
unsub(); // unsubscribe
```

Actions are pure functions: `(state, payload) => newState`. If an action returns the same reference (`===`), subscribers are not notified.

Stores are standalone — they work outside of Pulse and can be shared across your app.

Optional fields:

- **`name`** — a display name for the store (used by devtools and logger middleware).
- **`middleware`** — an array of middleware functions (see [Middleware](#middleware) below). When no middleware is provided, dispatch uses a zero-overhead fast path.

### `connect(bindings, lifecycle?)(Component)`

Connects a store's state to a component via selectors, with optional lifecycle callbacks.

```js
const Connected = connect({
  count: counterStore.select((state) => state.count),
  name: userStore.select((state) => state.name),
})(MyComponent);
```

- Selected values are merged into the component's props.
- Re-renders only when selected values change (shallow equality).
- Subscriptions are automatically managed (mount/unmount).
- Multiple stores can be bound to a single component.

#### Lifecycle Callbacks

The optional second argument adds lifecycle hooks:

```jsx
const Timer = connect(
  { elapsed: timerStore.select((s) => s.elapsed) },
  {
    onMount: ({ dom, props }) => {
      // Called once after first render. DOM element is available.
      const id = setInterval(() => timerStore.dispatch('tick'), 1000);
      return () => clearInterval(id); // cleanup — called on destroy
    },
    onUpdate: ({ dom, props }) => {
      // Called after every store-driven re-render (not on initial mount).
      console.log('Timer updated:', dom.textContent);
    },
    onDestroy: ({ props }) => {
      // Called when component is removed from the DOM.
      console.log('Timer removed');
    },
    onError: ({ error, props }) => {
      // Called when the component throws during render. Return fallback VNode.
      return h('div', { className: 'error' }, `Error: ${error.message}`);
    },
  }
)(TimerView);
```

- **`onMount({ dom, props })`** — fires once after first render. `dom` is the rendered DOM element. Can return a cleanup function that runs on destroy.
- **`onUpdate({ dom, props })`** — fires after every store-driven re-render (not on initial mount). Useful for DOM measurement, animations, or logging.
- **`onDestroy({ props })`** — fires when the component is removed, after cleanup.
- **`onError({ error, props })`** — catches errors thrown during render. Return a fallback VNode (or `null`). The component stays subscribed and recovers on the next successful re-render.
- Re-renders do **not** re-trigger `onMount`.
- For components that only need lifecycle (no store bindings), pass empty bindings: `connect({}, { onMount })(Component)`.

### `render(vnode, container)`

Mounts a virtual DOM tree into a real DOM container. Subsequent calls to `render` with the same container diff and patch.

```js
render(<App />, document.getElementById('app'));
```

### `h(type, props, ...children)` / `createElement`

JSX pragma. You don't call this directly — your JSX compiler transforms `<div>` into `h('div', null)`.

### `Fragment`

Groups children without adding a wrapper DOM node.

```jsx
<>
  <span>a</span>
  <span>b</span>
</>
```

### `createRouter({ routes, initialPath? })`

Creates a store-based client-side router.

```jsx
import { h, createRouter, render } from '@shane_il/pulse';

const router = createRouter({
  routes: [
    { path: '/' },
    { path: '/users/:id' },
    { path: '*' },
  ],
});

const { Route, Link } = router;

function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/users/1">User 1</Link>
      </nav>
      <Route path="/" component={Home} />
      <Route path="/users/:id" component={UserProfile} />
      <Route path="*" component={NotFound} />
    </div>
  );
}

render(<App />, document.getElementById('app'));
```

Returns a `Router` object with:

- **`store`** — a Pulse store holding `{ path, params, query, matched }`. Connect any component to route state.
- **`navigate(path)`** — push a new history entry and update the store.
- **`redirect(path)`** — replace the current history entry (back button skips it).
- **`back()` / `forward()`** — browser history navigation.
- **`Route`** — connected component that renders its `component` prop when the path matches. Passes `params` to the component.
- **`Link`** — renders an `<a>` with SPA navigation on click. Modifier clicks (Ctrl, Cmd) open in a new tab.
- **`Redirect`** — performs a redirect when rendered.
- **`destroy()`** — removes the `popstate` listener (for cleanup in tests).

Path patterns support static paths (`/about`), dynamic params (`/users/:id`), wildcard suffixes (`/dashboard/*`), and catch-all (`*`).

### `flushSync()`

Synchronously flushes all pending store-triggered re-renders. Primarily useful for testing.

```js
store.dispatch('increment');
flushSync();
// DOM is now updated
```

## Middleware

Middleware intercepts dispatches with an onion model — each middleware wraps the next, running code before and after the core action.

```js
import { createStore, logger, actionHistory } from '@shane_il/pulse';

const history = [];
const store = createStore({
  name: 'counter',
  state: { count: 0 },
  actions: {
    increment: (s) => ({ ...s, count: s.count + 1 }),
    set: (s, v) => ({ ...s, count: v }),
  },
  middleware: [logger(), actionHistory(history)],
});

store.dispatch('increment');
// Console: [pulse] increment  prev: {count: 0}  next: {count: 1}
// history: [{ actionName: 'increment', prevState: ..., nextState: ..., timestamp: ... }]
```

### Built-in middleware

- **`logger()`** — logs each dispatch with prev state, payload, and next state via `console.group`.
- **`actionHistory(history[], opts?)`** — pushes `ActionEntry` objects to a caller-owned array. `opts.maxEntries` caps the size.

### Custom middleware

A middleware is `(ctx, next) => void`. Call `next()` to continue the chain, or skip it to block the action.

```js
const validator = (ctx, next) => {
  if (ctx.actionName === 'set' && ctx.payload < 0) return; // block
  next();
};
```

`ctx` fields: `store`, `actionName`, `payload`, `prevState`, `nextState` (populated after `next()`).

## Async Actions

`createAsyncAction` wraps an async operation with loading/success/error dispatches.

```js
import { createStore, createAsyncAction } from '@shane_il/pulse';

const store = createStore({
  state: { items: [], loading: false, error: null },
  actions: {
    fetchStart: (s) => ({ ...s, loading: true, error: null }),
    fetchOk:    (s, items) => ({ ...s, loading: false, items }),
    fetchFail:  (s, error) => ({ ...s, loading: false, error }),
  },
});

const loadItems = createAsyncAction(store, {
  start: 'fetchStart',      // optional — dispatched immediately
  run: (query) => api.getItems(query),  // your async work
  ok: 'fetchOk',            // dispatched with the resolved value
  fail: 'fetchFail',        // optional — dispatched with error message
});

await loadItems({ limit: 10 });
```

- `start` and `fail` are optional. Without `fail`, errors propagate normally.
- Returns the resolved value from `run`.
- The store stays synchronous and pure — `createAsyncAction` is just orchestration sugar.

## Devtools

A browser devtools panel for inspecting stores, replaying actions, and viewing the component tree. Built with Pulse itself.

```bash
npm install @shane_il/pulse  # devtools included as a subpath export
```

```js
import { instrumentStore } from '@shane_il/pulse/devtools';
import { openPanel } from '@shane_il/pulse/devtools';

// Use instrumentStore instead of createStore — it adds action history + registers with devtools
const store = instrumentStore({
  name: 'todos',
  state: { items: [] },
  actions: {
    add: (s, item) => ({ ...s, items: [...s.items, item] }),
  },
});

openPanel(); // or press Ctrl+Shift+P
```

### Features

- **Stores tab** — live state tree for all instrumented stores.
- **Actions tab** — filterable action log with timestamps. Click any entry or use the slider to time-travel.
- **Components tab** — lists all connected components and their store bindings.

### API

- **`instrumentStore(config)`** — creates a store with `actionHistory` middleware and registers it with devtools.
- **`openPanel()` / `closePanel()` / `togglePanel()`** — control the overlay panel.
- **`travelTo(devtools, storeName, index)`** — jump a store to a historical state.
- **`replayFrom(devtools, storeName, index)`** — replay actions from a point forward.
- **`devtools`** — the singleton `PulseDevtools` instance (also available as `window.__PULSE_DEVTOOLS__`).

### Tree-shaking

Devtools is a separate entry point (`@shane_il/pulse/devtools`). Apps that don't import it ship zero devtools code.

## How It Works

1. **Stores** hold immutable state. Actions produce new state via pure functions.
2. **`connect()`** subscribes components to store slices via selectors.
3. When a store changes, connected components whose selected values differ are scheduled for re-render.
4. The **scheduler** batches multiple store updates in the same tick into a single render pass.
5. The **VDOM engine** diffs the old and new virtual trees and patches only the changed DOM nodes.

```
Store dispatch → Notify subscribers → Schedule re-render → Expand components
    → Diff VDOM → Patch DOM (single paint)
```

## Development

```bash
npm install
npm test          # run tests (vitest)
npm run build     # build dist/ (vite lib mode)
```

## License

MIT
