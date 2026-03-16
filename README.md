# Pulse

A render-driven UI framework with virtual DOM and immutable stores. Like React, but with no hooks — state stores are first-class citizens and components are pure render functions.

## Why Pulse?

- **No hooks.** All state lives in external stores. Components are `(props) => VNode`.
- **Stores are first-class.** Create, import, and share stores anywhere. They're framework-agnostic.
- **Render-driven.** Describe what the UI looks like for a given state. Pulse handles the rest.
- **Tiny.** ~3 KB gzipped. Zero runtime dependencies.

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

### `connect(bindings)(Component)`

Connects a store's state to a component via selectors.

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
