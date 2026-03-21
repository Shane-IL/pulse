# Architecture

This document explains how Pulse works under the hood — the render pipeline, virtual DOM diffing, and component update flow. Understanding this isn't required to use Pulse, but it helps when debugging or contributing.

## Module Dependency Graph

```
vnode.ts ─────────────────────────────────────────┐
    │                                              │
createElement.ts                                   │
                                                   │
middleware.ts ←── store (types only)                │
    │                                              │
store.ts ←── middleware (types only)                │
                                                   │
scheduler.ts (standalone)                          │
    │                                              │
connect.ts ←── scheduler, globalThis hooks         │
    │                                              │
diff.ts ←── vnode                                  │
    │                                              │
patch.ts ←── vnode, diff                           │
    │                                              │
render.ts ←── diff, patch, connect, vnode          │
    │                                              │
router.ts ←── store, connect, createElement        │
    │                                              │
index.ts ←── barrel export ────────────────────────┘

devtools/
    core.ts ←── store, middleware (actionHistory)
    time-travel.ts ←── core
    panel/ ←── createElement, store, connect, render (self-contained)
    index.ts ←── core, time-travel, panel, connect (hooks)
```

Key design constraint: `store.ts` has **zero imports** from the rendering layer. Stores are fully framework-agnostic.

### Middleware Layer

`store.ts` imports only from `middleware.ts` (types). When middleware is provided, `dispatch` builds an onion chain per call:

```
dispatch('increment')
    │
    ├── No middleware? → dispatchSimple() — same hot path as v0.1.x
    │
    └── Has middleware? → dispatchWithMiddleware()
            │
            ▼
          Build DispatchContext { store, actionName, payload, prevState, nextState }
            │
            ▼
          mw[0](ctx, next) → mw[1](ctx, next) → ... → core action
            │                                              │
            └──────────── onion unwind ◄───────────────────┘
```

The reserved action `__devtools_replace__` bypasses the middleware chain entirely — it force-sets state for time-travel.

## The Render Pipeline

```
render(vnode, container)
    │
    ▼
  expand(vnode)          ← Recursively call component functions
    │                      Turn component VNodes into element VNodes
    │                      Create ComponentInstances for connected components
    ▼
  createDOMNode(vnode)   ← Build real DOM from expanded VNode tree (first mount only)
    │                      Stamp _dom reference on each VNode
    ▼
  container.appendChild  ← Insert into document
    │
    ▼
  collectInstances()     ← Walk tree, find all ComponentInstances
    │
    ▼
  instance.mount()       ← Subscribe to stores, call onMount lifecycle
```

### First Mount vs. Update

**First mount** (`render()` called on a fresh container):

1. `expand()` the VNode tree
2. `createDOMNode()` builds real DOM
3. Append to container
4. Mount all component instances

**Update** (`render()` called again on same container):

1. `expand()` the new VNode tree
2. `diff()` old tree vs. new tree → patch list
3. `applyPatches()` mutates the DOM
4. Unmount removed instances, mount new ones

## Virtual DOM

### VNode Shape

```js
{
  type: 'div' | Function | TEXT_NODE | FRAGMENT,
  props: { className: 'foo', onClick: fn, ... },
  children: [ VNode, VNode, ... ],
  key: 'unique-id' | null,
  _dom: HTMLElement | Text,       // stamped after DOM creation
  _instance: ComponentInstance,   // stamped on connected component roots
}
```

### Special Types

- **`TEXT_NODE`** — Symbol. Represents a text node. `props.nodeValue` holds the string.
- **`FRAGMENT`** — Symbol. Groups children without a wrapper element.

## Diffing Algorithm

`diff(oldVNode, newVNode)` returns an array of patches. The algorithm:

1. **Null checks**: null→VNode = CREATE, VNode→null = REMOVE
2. **Type mismatch**: different `type` or `key` = REPLACE
3. **Text nodes**: compare `nodeValue` = TEXT (or no-op)
4. **Same type + key**: diff props → UPDATE, then diff children

### Children Diffing

Uses a **two-pointer scan** with **key-map fallback** (Snabbdom-style):

```
Old: [A, B, C, D, E]
New: [A, C, E, F]

Phase 1: Two-pointer scan from both ends
  Front: A === A → patch in place
  Back:  no match → stop

Phase 2: Key-map fallback
  Build map of remaining old children by key: { B: 1, C: 2, D: 3, E: 4 }
  For each remaining new child:
    C → found in map → MOVE
    E → found in map → MOVE
    F → not found → CREATE
  Remaining old: B, D → REMOVE
```

This is O(n) for common cases (append, prepend, remove) with O(n) key-map fallback for shuffles.

### Patch Types

| Type      | When                                   | Effect                                        |
| --------- | -------------------------------------- | --------------------------------------------- |
| `CREATE`  | New node has no old counterpart        | `createDOMNode()` + insert                    |
| `REMOVE`  | Old node has no new counterpart        | `removeChild()`                               |
| `REPLACE` | Type or key changed                    | `createDOMNode()` + `replaceChild()`          |
| `UPDATE`  | Same type, props differ                | `applyProps()` (add/remove/change attributes) |
| `TEXT`    | Text node content changed              | Update `nodeValue`                            |
| `MOVE`    | Key-matched node at different position | `insertBefore()`                              |

## Component Expansion

`expand()` recursively walks the VNode tree and calls component functions:

### Plain Function Components

```
VNode { type: Counter, props: { count: 5 } }
    ↓ Counter({ count: 5 })
VNode { type: 'div', children: [...] }
    ↓ expand children recursively
Final element VNode tree
```

Plain components are called once and forgotten. They have no instance, no subscriptions, no lifecycle.

### Connected Components

```
VNode { type: ConnectedCounter, props: {} }
    ↓ new ComponentInstance(ConnectedCounter, {})
    ↓ ConnectedCounter({}) → merges store state into props
    ↓ Counter({ count: 5 })
VNode { type: 'div', children: [...], _instance: inst }
```

Connected components create a `ComponentInstance` that:

- Tracks the expanded VNode tree (`lastVTree`)
- Holds store subscriptions
- Gets a re-render callback via the scheduler

## Re-Render Flow

When a store dispatches and a connected component's selected values change:

```
store.dispatch('increment')
    │
    ▼
  Notify subscribers
    │
    ▼
  ComponentInstance._onStoreChange()
    │  Run selectors, compare with shallowEqual
    │  If changed:
    ▼
  scheduleUpdate(renderCallback)
    │  Add to Set-based queue
    │  queueMicrotask(flush) if not already pending
    ▼
  flush()                        ← runs after all sync code, before paint
    │
    ▼
  reRenderInstance(instance)
    │  Call connectedFn(props) → new VNode
    │  expand() → new element tree
    │  diff(oldTree, newTree) → patches
    │  applyPatches() → DOM mutations
    │  unmountSubtree() on removed/replaced subtrees (skipping self)
    │  Update instance.lastVTree
    │  Call onUpdate lifecycle (if present)
    │
    │  On error (if onError provided):
    │    → expand fallback VNode
    │    → diff/patch old tree with fallback
    │    → instance stays subscribed (retries on next store change)
    ▼
  Single paint
```

### Batching

The scheduler uses a `Set` for its queue. If the same connected component is triggered twice in the same tick (e.g., two stores it subscribes to both change), it only appears once in the queue. And because `queueMicrotask` runs after all synchronous code:

```js
store.dispatch('a'); // schedules re-render (once)
store.dispatch('b'); // same callback already in Set — no-op
store.dispatch('c'); // same callback already in Set — no-op
// ── microtask boundary ──
// Single re-render runs here, sees count = 3
```

## DOM Reference Stamping

Every VNode gets a `_dom` reference pointing to its real DOM node. This is stamped during:

- `createDOMNode()` — initial creation
- `diff()` — `newVNode._dom = oldVNode._dom` when types match (transfer)
- `reRenderInstance()` — fallback transfer when `_dom` isn't set

This reference is critical: it's how `applyPatches()` knows which real DOM node to mutate, and how `onMount` receives the `dom` argument.

## Instance Lifecycle During Re-Renders

When a parent connected component re-renders and a child connected component is removed (conditional rendering):

1. `diff()` produces a REMOVE patch for the child's subtree
2. `applyPatches()` removes the DOM node
3. `unmountSubtree()` walks the removed VNode tree and calls `unmount()` on any instances found
4. `unmount()` runs cleanup → onDestroy → unsubscribe

This ensures no subscription leaks and proper lifecycle callback ordering.

### Self-Unmount Protection

When `reRenderInstance()` diffs the old tree against a new tree (or an error fallback), a REPLACE patch can target the instance's own root VNode. To prevent the instance from unmounting itself (which would kill its store subscriptions), `unmountSubtree()` accepts an optional `skip` parameter — the current instance. Child instances in removed subtrees are still properly unmounted.

### Error Boundary Flow

When a connected component throws during render:

1. `onError({ error, props })` is called if provided — returns a fallback VNode
2. The fallback is expanded, diffed against the old tree, and patched into the DOM
3. The instance remains subscribed to its stores (not unmounted)
4. On the next store change, the component retries the real render
5. If the render succeeds, the fallback is replaced with normal output (recovery)
6. If `onError` is not provided, the error propagates to the caller
7. If the fallback itself throws, the error propagates (no infinite loop)

## Keyed List Warnings (Development Only)

In development (`process.env.NODE_ENV !== 'production'`), the diffing algorithm warns about:

- **Duplicate keys** among siblings
- **Mixed keyed and unkeyed** children in the same list

These warnings are dead-code eliminated by Vite in production builds.

## File Reference

| File                   | Size          | Responsibility                                                            |
| ---------------------- | ------------- | ------------------------------------------------------------------------- |
| `src/vnode.ts`         | ~60 LOC       | VNode types, Lifecycle interface, text node creation, child normalization |
| `src/createElement.ts` | ~18 LOC       | JSX pragma `h()`, key extraction                                          |
| `src/store.ts`         | ~120 LOC      | Immutable store with dispatch/subscribe/select, middleware chain          |
| `src/middleware.ts`    | ~90 LOC       | Middleware types, `logger`, `actionHistory`, `createAsyncAction`          |
| `src/scheduler.ts`     | ~20 LOC       | Microtask-based batched update queue                                      |
| `src/diff.ts`          | ~240 LOC      | VDOM tree diffing with two-pointer children reconciliation, key warnings  |
| `src/patch.ts`         | ~150 LOC      | DOM creation and mutation                                                 |
| `src/connect.ts`       | ~160 LOC      | `connect()` HOC, `ComponentInstance`, `shallowEqual`, devtools hooks      |
| `src/render.ts`        | ~205 LOC      | `render()`, `expand()`, `reRenderInstance()`, error boundaries            |
| `src/router.ts`        | ~270 LOC      | `createRouter()`, path matching, Route/Link/Redirect components           |
| `src/devtools/`        | ~600 LOC      | Store registry, time-travel, browser panel (built with Pulse)             |
| **Core total**         | **~1330 LOC** | **~6 KB gzipped**                                                         |
| **Devtools total**     | **~600 LOC**  | **~9 KB gzipped** (separate entry point)                                  |
