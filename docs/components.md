# Components

Pulse components are plain functions that take props and return virtual DOM nodes. There are no hooks, no classes, no `this`. State lives in stores, not components.

## Plain Components

The simplest component is a function that returns JSX:

```jsx
import { h } from 'pulse-ui';

function Greeting({ name }) {
  return <p>Hello, {name}!</p>;
}
```

Plain components are **pure** — same props in, same output out. They have no subscriptions, no lifecycle, and no re-render trigger of their own. They re-render when their parent re-renders.

### Children

Components receive `children` as a prop:

```jsx
function Card({ title, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="card-body">{children}</div>
    </div>
  );
}

// Usage
<Card title="Welcome">
  <p>Content goes here</p>
</Card>
```

### Fragments

Use `Fragment` (or `<>...</>`) to return multiple elements without a wrapper node:

```jsx
import { h, Fragment } from 'pulse-ui';

function UserInfo({ name, email }) {
  return (
    <>
      <span className="name">{name}</span>
      <span className="email">{email}</span>
    </>
  );
}
```

## Connected Components

`connect()` upgrades a plain component to a reactive one. It subscribes to stores, injects selected state as props, and re-renders when those values change.

```jsx
import { h, connect } from 'pulse-ui';
import { counterStore } from '../stores/counter';

// 1. Plain component — just renders props
function Counter({ count }) {
  return (
    <div>
      <span>{count}</span>
      <button onClick={() => counterStore.dispatch('increment')}>+</button>
    </div>
  );
}

// 2. Connect it — maps store state to props
export const ConnectedCounter = connect({
  count: counterStore.select((s) => s.count),
})(Counter);
```

### How `connect()` Works

1. For each binding, runs the selector against the store's current state.
2. Merges selected values into the component's props (selected props + passed props).
3. Subscribes to each store. On change, re-runs selectors.
4. If any selected value differs (shallow equality), schedules a re-render.
5. On unmount, unsubscribes from all stores.

### Explicit Props Override Selected Props

If a parent passes a prop with the same name as a selected prop, the explicit prop wins:

```jsx
const Connected = connect({
  count: counterStore.select((s) => s.count), // selects 42
})(Counter);

// `count` will be 99, not 42
<Connected count={99} />
```

### Multiple Store Bindings

A single component can bind to several stores:

```jsx
const Connected = connect({
  user: authStore.select((s) => s.user),
  items: todoStore.select((s) => s.items),
  theme: settingsStore.select((s) => s.theme),
})(Dashboard);
```

## Composing Components

Build UIs by composing small, focused components:

```jsx
function TodoItem({ item }) {
  return (
    <li className={item.done ? 'done' : ''}>
      <span>{item.text}</span>
      <button onClick={() => todoStore.dispatch('toggle', item.id)}>
        {item.done ? 'Undo' : 'Done'}
      </button>
    </li>
  );
}

function TodoList({ items }) {
  return (
    <ul>
      {items.map((item) => (
        <TodoItem key={item.id} item={item} />
      ))}
    </ul>
  );
}

const ConnectedTodoList = connect({
  items: todoStore.select((s) => s.items),
})(TodoList);
```

### Keyed Lists

When rendering lists, always provide a `key` prop to help the diffing algorithm match elements efficiently:

```jsx
{items.map((item) => (
  <TodoItem key={item.id} item={item} />
))}
```

Keys should be stable, unique identifiers — not array indices. Without keys, Pulse falls back to positional matching which can cause incorrect updates when items are reordered, inserted, or removed.

## Event Handling

Event handlers are passed as `onXxx` props (camelCase):

```jsx
function Form() {
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      todoStore.dispatch('add', e.target.elements.text.value);
    }}>
      <input name="text" />
      <button type="submit">Add</button>
    </form>
  );
}
```

Pulse attaches event listeners directly via `addEventListener` — no synthetic event system.

## Conditional Rendering

Use ternaries or `&&` for conditional rendering:

```jsx
function App({ isLoggedIn, user }) {
  return (
    <div>
      {isLoggedIn ? <Dashboard user={user} /> : <LoginForm />}
      {user?.isAdmin && <AdminPanel />}
    </div>
  );
}
```

When a connected component is conditionally removed, its subscriptions are cleaned up and lifecycle callbacks fire (see [Lifecycle](./lifecycle.md)).

## Style and Class

```jsx
// className (not class)
<div className="container active" />

// Inline styles as objects
<div style={{ color: 'red', fontSize: '14px' }} />

// Boolean attributes
<input disabled={true} />
<input checked={isChecked} />
```

## Connected vs. Plain — When to Use Which

| | Plain Component | Connected Component |
|---|---|---|
| **State** | None — just renders props | Subscribes to stores |
| **Re-renders** | When parent re-renders | When selected store values change |
| **Lifecycle** | None | `onMount` / `onDestroy` available |
| **Use for** | Presentational UI, layouts | Data-fetching components, interactive widgets |

**Rule of thumb:** Keep most components plain. Use `connect()` at the boundaries where data enters the component tree.
