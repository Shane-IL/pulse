# Getting Started

## Installation

```bash
npm install @shane_il/pulse
```

## JSX Setup

Pulse ships a JSX automatic runtime — your bundler injects the factory for you, so no manual imports needed.

### Vite

```js
// vite.config.js
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@shane_il/pulse',
  },
});
```

### TypeScript / jsconfig

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@shane_il/pulse"
  }
}
```

<details>
<summary>Classic mode (manual <code>h</code> import)</summary>

If you prefer the classic transform, set `"jsx": "react"`, `"jsxFactory": "h"`, `"jsxFragmentFactory": "Fragment"` and `import { h } from '@shane_il/pulse'` in every JSX file.
</details>

## Your First App

### 1. Create a store

Stores hold your application state. They're standalone objects — no framework coupling.

```js
// stores/counter.js
import { createStore } from '@shane_il/pulse';

export const counterStore = createStore({
  state: { count: 0 },
  actions: {
    increment: (s) => ({ count: s.count + 1 }),
    decrement: (s) => ({ count: s.count - 1 }),
    set: (s, value) => ({ count: value }),
  },
});
```

### 2. Write a component

Components are plain functions: `(props) => VNode`. No hooks, no `this`, no class syntax.

```jsx
// components/Counter.jsx
import { counterStore } from '../stores/counter';

function Counter({ count }) {
  return (
    <div>
      <h1>{count}</h1>
      <button onClick={() => counterStore.dispatch('increment')}>+</button>
      <button onClick={() => counterStore.dispatch('decrement')}>-</button>
    </div>
  );
}
```

### 3. Connect component to the store

`connect()` binds store state to a component via selectors. The component re-renders only when the selected values change.

```jsx
import { connect } from '@shane_il/pulse';
import { counterStore } from '../stores/counter';

const ConnectedCounter = connect({
  count: counterStore.select((s) => s.count),
})(Counter);
```

### 4. Render

```jsx
// components/Counter.jsx (at the bottom)
import { render } from '@shane_il/pulse';

render(<ConnectedCounter />);
```

`render()` mounts to `#app` by default. You can also pass a selector string or element:

```jsx
render(<ConnectedCounter />, '#other-root');
```

## Project Structure

A typical Pulse app:

```
my-app/
├── src/
│   ├── stores/
│   │   ├── counter.ts         # createStore({ state, actions })
│   │   └── user.ts
│   └── components/
│       ├── App.tsx             # root component + render() call
│       ├── Counter.tsx         # pure view function
│       └── UserCard.tsx
├── index.html                  # <script src="/src/components/App.tsx">
├── vite.config.js              # jsxImportSource: "@shane_il/pulse"
└── package.json
```

## Key Concepts

### Stores are importable singletons

Unlike Redux, there's no Provider or context. Stores are regular JS modules — import them wherever you need them:

```js
// Any file can dispatch
import { counterStore } from './stores/counter';
counterStore.dispatch('increment');
```

### Components are pure render functions

No hooks. No state inside components. A component receives props and returns a virtual DOM tree:

```jsx
function Greeting({ name }) {
  return <p>Hello, {name}!</p>;
}
```

### `connect()` is the bridge

`connect()` is the only way to make a component reactive to store changes. It subscribes to stores, runs selectors, and re-renders when the selected slice changes:

```jsx
const ConnectedGreeting = connect({
  name: userStore.select((s) => s.name),
})(Greeting);
```

### Updates are batched

Multiple store dispatches in the same tick are batched into a single re-render:

```js
counterStore.dispatch('increment'); // these three produce
counterStore.dispatch('increment'); // only ONE re-render
counterStore.dispatch('increment'); // of the connected component
```

## Next Steps

- [Stores](./stores.md) — actions, selectors, subscriptions, derived state
- [Components](./components.md) — plain components, connected components, keyed lists, error boundaries
- [Middleware](./middleware.md) — logging, action history, async actions, custom middleware
- [Devtools](./devtools.md) — browser panel, store inspector, time-travel, component tracking
- [Lifecycle](./lifecycle.md) — onMount, onUpdate, onDestroy, onError, cleanup functions
- [Routing](./routing.md) — store-based client-side router, Route/Link/Redirect, path matching, nested routes
- [Architecture](./architecture.md) — how the VDOM engine works under the hood
