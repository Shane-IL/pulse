# Devtools

Pulse includes a browser devtools panel for inspecting stores, replaying actions, and viewing the component tree. The panel is built with Pulse itself (dogfooding) and ships as a separate entry point — apps that don't import it pay zero cost.

## Quick Start

```js
import { instrumentStore, openPanel } from '@shane_il/pulse/devtools';

const store = instrumentStore({
  name: 'todos',
  state: { items: [], nextId: 1 },
  actions: {
    add: (s, text) => ({
      ...s,
      items: [...s.items, { id: s.nextId, text, done: false }],
      nextId: s.nextId + 1,
    }),
    toggle: (s, id) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
    }),
  },
});

openPanel();
```

That's it. The devtools panel appears at the bottom of the page. You can also toggle it with **Ctrl+Shift+P**.

## `instrumentStore(config)`

A convenience wrapper around `createStore`. It:

1. Adds `actionHistory` middleware to record every dispatch
2. Registers the store with the devtools singleton
3. Returns a regular `Store` — same API as `createStore`

```js
import { instrumentStore } from '@shane_il/pulse/devtools';

// Same config as createStore, but name is required for devtools display
const store = instrumentStore({
  name: 'counter',
  state: { count: 0 },
  actions: {
    increment: (s) => ({ ...s, count: s.count + 1 }),
  },
});
```

You can add your own middleware alongside the devtools middleware:

```js
import { instrumentStore } from '@shane_il/pulse/devtools';
import { logger } from '@shane_il/pulse';

const store = instrumentStore({
  name: 'counter',
  state: { count: 0 },
  actions: { increment: (s) => ({ ...s, count: s.count + 1 }) },
  middleware: [logger()], // logger runs in addition to actionHistory
});
```

## The Panel

### Opening and Closing

```js
import { openPanel, closePanel, togglePanel } from '@shane_il/pulse/devtools';

openPanel(); // show the panel
closePanel(); // hide the panel
togglePanel(); // toggle visibility
```

Or press **Ctrl+Shift+P** anywhere in the app.

### Stores Tab

Lists all instrumented stores on the left. Selecting a store shows its current state as a recursive tree on the right. The state view updates live as you dispatch actions.

### Actions Tab

Shows a chronological log of all dispatches for the selected store:

- **Action name** and **payload** for each entry
- **Timestamp** on the right
- **Filter input** at the top to search by action name
- **Time-travel slider** — drag to jump the store to any historical state

Click any action entry to time-travel to that point.

### Components Tab

Lists all connected components currently mounted in the DOM, along with which stores they're bound to. Components are tracked automatically — no extra setup needed.

## Time-Travel

Time-travel lets you jump a store's state to any point in its action history.

### Via the Panel

1. Open the **Actions** tab
2. Select the store you want to inspect
3. Drag the slider or click an action entry
4. The store's state is replaced with the historical state at that point
5. All connected components re-render to reflect the past state

### Programmatic API

```js
import { devtools, travelTo, replayFrom } from '@shane_il/pulse/devtools';

// Jump to the state after the 3rd action (0-indexed)
travelTo(devtools, 'counter', 2);

// Reset to the state before action 1, then replay actions 1 through current
replayFrom(devtools, 'counter', 1);
```

**`travelTo(devtools, storeName, index)`** — sets the store's state to `history[index].nextState`. The store's actual action history is preserved — you're just moving the current state pointer.

**`replayFrom(devtools, storeName, index)`** — resets the store to `history[index].prevState`, then re-dispatches all actions from that point forward. This is useful when action logic has changed and you want to see how the new logic affects historical inputs.

## Architecture

### Tree-Shaking

Devtools is a separate entry point:

```js
// Only this import pulls in devtools code
import { instrumentStore } from '@shane_il/pulse/devtools';

// This import has zero devtools code
import { createStore } from '@shane_il/pulse';
```

Bundle sizes:

- **Core** (`@shane_il/pulse`): ~6 KB gzipped
- **Devtools** (`@shane_il/pulse/devtools`): ~9 KB gzipped

Apps that never import from `@shane_il/pulse/devtools` ship zero devtools code.

### Self-Contained

The devtools bundle includes its own copy of the Pulse rendering layer. This means:

- It doesn't interfere with your app's rendering
- Version mismatches between your app and devtools are impossible
- The panel renders into its own isolated DOM container (`#pulse-devtools-root`)

### Component Tracking

Component tracking works across bundles via `globalThis.__PULSE_HOOKS__`. When devtools is imported, it installs mount/unmount hooks that the core `connect()` function calls. The devtools panel's own internal components are excluded from tracking (they only bind to internal stores marked via a `WeakSet`).

### Console Access

The devtools singleton is exposed on `window.__PULSE_DEVTOOLS__` for console debugging:

```js
// In browser console
__PULSE_DEVTOOLS__.getStoreNames(); // ['todos', 'counter']
__PULSE_DEVTOOLS__.getStoreState('todos'); // { items: [...], nextId: 3 }
__PULSE_DEVTOOLS__.getHistory('todos'); // [ActionEntry, ActionEntry, ...]
__PULSE_DEVTOOLS__.getComponents(); // [{ id: 1, displayName: 'TodoList', storeNames: ['todos'] }]
```

## Devtools Without the Panel

You can use `instrumentStore` and the devtools API without ever opening the panel — useful for automated testing, logging, or building custom tooling:

```js
import { instrumentStore, devtools } from '@shane_il/pulse/devtools';

const store = instrumentStore({
  name: 'counter',
  state: { count: 0 },
  actions: { increment: (s) => ({ ...s, count: s.count + 1 }) },
});

store.dispatch('increment');
store.dispatch('increment');

// Read history programmatically
const history = devtools.getHistory('counter');
console.log(history.length); // 2
console.log(history[1].nextState); // { count: 2 }
```

## Migration from `createStore`

Switching an existing store to devtools is a one-line change:

```diff
- import { createStore } from '@shane_il/pulse';
+ import { instrumentStore } from '@shane_il/pulse/devtools';

- const store = createStore({
+ const store = instrumentStore({
+   name: 'todos',
    state: { items: [] },
    actions: { /* ... */ },
  });
```

Add a `name` field (required for devtools display) and swap `createStore` for `instrumentStore`. Everything else stays the same.
