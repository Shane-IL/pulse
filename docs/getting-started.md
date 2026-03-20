# Getting Started

## Installation

```bash
npm install pulse-ui
```

## JSX Setup

Pulse uses a custom JSX pragma. Configure your toolchain to use `h` as the factory and `Fragment` as the fragment factory.

### Vite / esbuild

```json
// jsconfig.json or tsconfig.json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "h",
    "jsxFragmentFactory": "Fragment"
  }
}
```

### Babel

```json
// .babelrc or babel.config.json
{
  "plugins": [
    ["@babel/plugin-transform-react-jsx", {
      "pragma": "h",
      "pragmaFrag": "Fragment"
    }]
  ]
}
```

> **Important:** Every file that uses JSX must import `h` (and `Fragment` if using `<>...</>`):
>
> ```js
> import { h, Fragment } from 'pulse-ui';
> ```

## Your First App

### 1. Create a store

Stores hold your application state. They're standalone objects — no framework coupling.

```js
// stores/counter.js
import { createStore } from 'pulse-ui';

export const counterStore = createStore({
  state: { count: 0 },
  actions: {
    increment: (state) => ({ ...state, count: state.count + 1 }),
    decrement: (state) => ({ ...state, count: state.count - 1 }),
    set: (state, value) => ({ ...state, count: value }),
  },
});
```

### 2. Write a component

Components are plain functions: `(props) => VNode`. No hooks, no `this`, no class syntax.

```jsx
// components/Counter.jsx
import { h } from 'pulse-ui';
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
import { connect } from 'pulse-ui';
import { counterStore } from '../stores/counter';

const ConnectedCounter = connect({
  count: counterStore.select((s) => s.count),
})(Counter);
```

### 4. Render

```jsx
// main.jsx
import { h, render } from 'pulse-ui';
import { ConnectedCounter } from './components/Counter';

render(<ConnectedCounter />, document.getElementById('app'));
```

## Project Structure

A typical Pulse app:

```
my-app/
├── src/
│   ├── main.jsx              # entry — render(<App />, ...)
│   ├── stores/
│   │   ├── counter.js         # createStore({ state, actions })
│   │   └── user.js
│   └── components/
│       ├── App.jsx            # root component
│       ├── Counter.jsx        # pure view function
│       └── UserCard.jsx
├── index.html
├── jsconfig.json              # jsxFactory: "h"
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
- [Components](./components.md) — plain components, connected components, composition
- [Lifecycle](./lifecycle.md) — onMount, onDestroy, cleanup functions
- [Architecture](./architecture.md) — how the VDOM engine works under the hood
