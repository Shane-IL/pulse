# Pulse

A render-driven UI framework with virtual DOM and immutable stores. Like React, but with no hooks — state stores are first-class citizens and components are pure render functions.

## Why Pulse?

- **No hooks.** All state lives in external stores. Components are `(props) => VNode`.
- **Stores are first-class.** Create, import, and share stores anywhere. They're framework-agnostic.
- **Render-driven.** Describe what the UI looks like for a given state. Pulse handles the rest.
- **Built-in routing.** Store-based client-side router — routes are just state.
- **Tiny.** ~5 KB gzipped. Zero runtime dependencies.

## Quick Start

```bash
npm install pulse-ui
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
import { h, createStore, connect, render } from 'pulse-ui';

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

### `createStore({ state, actions })`

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
import { h, createRouter, render } from 'pulse-ui';

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
