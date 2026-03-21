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

## How It Works

```
Store dispatch → Notify subscribers → Schedule re-render → Expand components
    → Diff VDOM → Patch DOM (single paint)
```

1. **Stores** hold immutable state. Actions produce new state via pure functions.
2. **`connect()`** subscribes components to store slices via selectors.
3. When a store changes, connected components whose selected values differ are scheduled for re-render.
4. The **scheduler** batches multiple store updates in the same tick into a single render pass.
5. The **VDOM engine** diffs the old and new virtual trees and patches only the changed DOM nodes.

## Documentation

- **[Getting Started](docs/getting-started.md)** — installation, JSX setup, first app, project structure
- **[Stores](docs/stores.md)** — `createStore`, actions, selectors, subscriptions, derived state
- **[Components](docs/components.md)** — pure components, `connect()`, keyed lists, error boundaries
- **[Lifecycle](docs/lifecycle.md)** — `onMount`, `onUpdate`, `onDestroy`, `onError`, cleanup functions
- **[Routing](docs/routing.md)** — `createRouter`, Route/Link/Redirect, path matching, nested routes
- **[Middleware](docs/middleware.md)** — `logger`, `actionHistory`, `createAsyncAction`, custom middleware
- **[Devtools](docs/devtools.md)** — browser panel, store inspector, time-travel, component tracking
- **[Architecture](docs/architecture.md)** — how the VDOM engine works under the hood

## Development

```bash
npm install
npm test          # 204 tests (vitest)
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # vite lib mode → dist/
```

## License

MIT
