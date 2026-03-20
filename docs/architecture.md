# Architecture

This document explains how Pulse works under the hood — the render pipeline, virtual DOM diffing, and component update flow. Understanding this isn't required to use Pulse, but it helps when debugging or contributing.

## Module Dependency Graph

```
vnode.js ─────────────────────────────────────────┐
    │                                              │
createElement.js                                   │
                                                   │
store.js (standalone)                              │
                                                   │
scheduler.js (standalone)                          │
    │                                              │
connect.js ←── scheduler                           │
    │                                              │
diff.js ←── vnode                                  │
    │                                              │
patch.js ←── vnode, diff                           │
    │                                              │
render.js ←── diff, patch, connect, vnode          │
    │                                              │
index.js ←── barrel export ────────────────────────┘
```

Key design constraint: `store.js` has **zero imports** from the rendering layer. Stores are fully framework-agnostic.

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

| Type | When | Effect |
|------|------|--------|
| `CREATE` | New node has no old counterpart | `createDOMNode()` + insert |
| `REMOVE` | Old node has no new counterpart | `removeChild()` |
| `REPLACE` | Type or key changed | `createDOMNode()` + `replaceChild()` |
| `UPDATE` | Same type, props differ | `applyProps()` (add/remove/change attributes) |
| `TEXT` | Text node content changed | Update `nodeValue` |
| `MOVE` | Key-matched node at different position | `insertBefore()` |

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
    │  Update instance.lastVTree
    ▼
  Single paint
```

### Batching

The scheduler uses a `Set` for its queue. If the same connected component is triggered twice in the same tick (e.g., two stores it subscribes to both change), it only appears once in the queue. And because `queueMicrotask` runs after all synchronous code:

```js
store.dispatch('a');  // schedules re-render (once)
store.dispatch('b');  // same callback already in Set — no-op
store.dispatch('c');  // same callback already in Set — no-op
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

## File Reference

| File | Size | Responsibility |
|------|------|----------------|
| `src/vnode.js` | ~30 LOC | VNode types, text node creation, child normalization |
| `src/createElement.js` | ~15 LOC | JSX pragma `h()`, key extraction |
| `src/store.js` | ~25 LOC | Immutable store with dispatch/subscribe/select |
| `src/scheduler.js` | ~15 LOC | Microtask-based batched update queue |
| `src/diff.js` | ~180 LOC | VDOM tree diffing with two-pointer children reconciliation |
| `src/patch.js` | ~100 LOC | DOM creation and mutation |
| `src/connect.js` | ~100 LOC | `connect()` HOC, `ComponentInstance`, `shallowEqual` |
| `src/render.js` | ~140 LOC | `render()`, `expand()`, `reRenderInstance()` |
| **Total** | **~600 LOC** | **~3.5 KB gzipped** |
