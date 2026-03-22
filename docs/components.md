# Components

Pulse components are plain functions that take props and return virtual DOM nodes. There are no hooks, no classes, no `this`. State lives in stores, not components.

## Plain Components

The simplest component is a function that returns JSX:

```jsx
import { h } from '@shane_il/pulse';

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
</Card>;
```

### Fragments

Use `Fragment` (or `<>...</>`) to return multiple elements without a wrapper node:

```jsx
import { h, Fragment } from '@shane_il/pulse';

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
import { h, connect } from '@shane_il/pulse';
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
<Connected count={99} />;
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
{
  items.map((item) => <TodoItem key={item.id} item={item} />);
}
```

Keys should be stable, unique identifiers — not array indices. Without keys, Pulse falls back to positional matching which can cause incorrect updates when items are reordered, inserted, or removed.

> **Development warnings:** In development mode, Pulse warns about common key mistakes:
>
> - **Duplicate keys** — two siblings with the same key
> - **Mixed keyed and unkeyed** — some siblings have keys and others don't
>
> These warnings are removed in production builds (guarded by `process.env.NODE_ENV`).

## Event Handling

Event handlers are passed as `onXxx` props (camelCase):

```jsx
function Form() {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        todoStore.dispatch('add', e.target.elements.text.value);
      }}
    >
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
// Both className and class work
<div className="container active" />
<div class="container active" />

// Inline styles as objects
<div style={{ color: 'red', fontSize: '14px' }} />

// Boolean attributes
<input disabled={true} />
<input checked={isChecked} />

// Controlled inputs — value, checked, selected are set as DOM properties
<input value={currentValue} onInput={(e) => store.dispatch('setValue', e.target.value)} />
```

Properties like `value`, `checked`, and `selected` are set directly on the DOM element (not via `setAttribute`), so controlled inputs work correctly.

## Raw HTML

When you need to inject pre-rendered HTML (markdown output, CMS content, syntax-highlighted code), use `dangerouslySetInnerHTML`:

```jsx
function Article({ htmlContent }) {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
```

The prop takes an object with an `__html` key. As the name implies, this bypasses Pulse's normal rendering — you are responsible for sanitizing the HTML to prevent XSS.

## Connected vs. Plain — When to Use Which

|                    | Plain Component            | Connected Component                              |
| ------------------ | -------------------------- | ------------------------------------------------ |
| **State**          | None — just renders props  | Subscribes to stores                             |
| **Re-renders**     | When parent re-renders     | When selected store values change                |
| **Lifecycle**      | None                       | `onMount` / `onUpdate` / `onDestroy` / `onError` |
| **Error handling** | Errors bubble to parent    | Can catch errors via `onError` (error boundary)  |
| **Use for**        | Presentational UI, layouts | Data-fetching components, interactive widgets    |

**Rule of thumb:** Keep most components plain. Use `connect()` at the boundaries where data enters the component tree.

### Error Boundaries

Connected components can catch render errors via `onError`. Errors in plain function components bubble up to the nearest connected ancestor with `onError`:

```jsx
function RiskyWidget({ data }) {
  // If this throws, the error bubbles to ConnectedApp's onError
  return <div>{data.value.toFixed(2)}</div>;
}

function App({ data }) {
  return (
    <div>
      <h1>Dashboard</h1>
      <RiskyWidget data={data} />
    </div>
  );
}

const ConnectedApp = connect(
  { data: dataStore.select((s) => s.data) },
  {
    onError: ({ error }) => <p>Something went wrong: {error.message}</p>,
  },
)(App);
```

See [Lifecycle](./lifecycle.md) for the full `onError` API.
