# Lifecycle Callbacks

Pulse components are pure render functions — but sometimes you need side effects: fetching data when a component mounts, cleaning up timers when it's removed, or integrating with a third-party library that needs a DOM reference.

Lifecycle callbacks are the escape hatch for these cases. They're available on connected components via the second argument to `connect()`.

## API

```js
connect(bindings, {
  onMount: ({ dom, props }) => { ... },
  onDestroy: ({ props }) => { ... },
})(Component);
```

### `onMount({ dom, props })`

Called **once** after the component's first render, when the DOM element exists and store subscriptions are active.

**Arguments:**
- `dom` — the rendered DOM element (the actual node in the document)
- `props` — the component's props at mount time

**Return value:** optionally return a cleanup function that will be called when the component is removed.

```jsx
const Chart = connect(
  { data: dataStore.select((s) => s.points) },
  {
    onMount: ({ dom, props }) => {
      // DOM is ready — initialize a third-party chart library
      const chart = new ChartLib(dom, { data: props.data });

      // Return cleanup function
      return () => chart.destroy();
    },
  }
)(ChartView);
```

### `onDestroy({ props })`

Called when the component is removed from the DOM, **after** the cleanup function (if any).

**Arguments:**
- `props` — the component's props at destroy time

```jsx
const Logger = connect({}, {
  onMount: ({ props }) => {
    analytics.track('component_mounted', { id: props.id });
  },
  onDestroy: ({ props }) => {
    analytics.track('component_destroyed', { id: props.id });
  },
})(LoggerView);
```

## Cleanup Functions

The most common pattern: `onMount` sets something up and returns a teardown function. This keeps setup and teardown co-located:

```jsx
const WindowSize = connect({}, {
  onMount: ({ dom }) => {
    const handler = () => {
      sizeStore.dispatch('set', {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  },
})(SizeDisplay);
```

### Execution Order on Unmount

When a component is removed, callbacks fire in this order:

1. **Cleanup function** (returned by `onMount`)
2. **`onDestroy`**
3. Store unsubscriptions

This ordering ensures lifecycle callbacks can still read store state if needed.

## Lifecycle-Only Components

Not every component with lifecycle needs store bindings. Pass empty bindings to get lifecycle without store subscriptions:

```jsx
const FocusInput = connect({}, {
  onMount: ({ dom }) => {
    // Focus the input element on mount
    const input = dom.querySelector('input');
    if (input) input.focus();
  },
})(InputForm);
```

## Common Patterns

### Data Fetching on Mount

```jsx
function UserProfile({ user, loading }) {
  if (loading) return <p>Loading...</p>;
  if (!user) return <p>No user found</p>;
  return <div>{user.name}</div>;
}

const ConnectedProfile = connect(
  {
    user: userStore.select((s) => s.user),
    loading: userStore.select((s) => s.loading),
  },
  {
    onMount: ({ props }) => {
      // Fetch user data when component mounts
      userStore.dispatch('setLoading');
      fetch(`/api/users/${props.userId}`)
        .then((r) => r.json())
        .then((user) => userStore.dispatch('setUser', user));
    },
  }
)(UserProfile);
```

### Timers and Intervals

```jsx
const Clock = connect(
  { time: clockStore.select((s) => s.time) },
  {
    onMount: () => {
      const id = setInterval(() => {
        clockStore.dispatch('tick', Date.now());
      }, 1000);
      return () => clearInterval(id);
    },
  }
)(ClockView);
```

### Third-Party Library Integration

```jsx
const Map = connect(
  { markers: mapStore.select((s) => s.markers) },
  {
    onMount: ({ dom, props }) => {
      const map = L.map(dom).setView([51.505, -0.09], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

      props.markers.forEach((m) => L.marker(m.coords).addTo(map));

      return () => map.remove();
    },
  }
)(MapView);
```

### Event Listeners

```jsx
const KeyboardShortcuts = connect({}, {
  onMount: () => {
    const handler = (e) => {
      if (e.key === 'Escape') modalStore.dispatch('close');
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveStore.dispatch('save');
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  },
})(ShortcutProvider);
```

## Important Notes

- **`onMount` fires once.** Re-renders do not re-trigger it. If you need to react to prop changes, use a store subscription.
- **`onDestroy` fires once** when the component is removed from the DOM — either by conditional rendering or by the parent unmounting.
- **Both callbacks are optional.** Use one, both, or neither.
- **`dom` in `onMount` is the actual DOM element.** You can call native DOM APIs on it.
- **Lifecycle is only available on connected components.** Plain function components have no lifecycle. If you need lifecycle without store bindings, use `connect({}, { onMount })`.
