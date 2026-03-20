# Routing

Pulse includes a store-based client-side router. Routes are just store state — the `path`, `params`, and `query` live in a Pulse store, and `Route` components are connected components that conditionally render based on the current path.

## Creating a Router

```js
import { createRouter } from '@shane_il/pulse';

const router = createRouter({
  routes: [
    { path: '/' },
    { path: '/users/:id' },
    { path: '/settings' },
    { path: '*' },  // catch-all
  ],
});
```

`createRouter()` returns a `Router` object with everything you need:

```ts
interface Router {
  store: Store<RouteState>;    // the route state store
  navigate: (path: string) => void;
  redirect: (path: string) => void;
  back: () => void;
  forward: () => void;
  destroy: () => void;
  Route: ComponentFunction;    // connected component
  Link: ComponentFunction;     // plain component
  Redirect: ComponentFunction; // plain component
}
```

## Route State

The router's store holds this state:

```ts
interface RouteState {
  path: string;                      // "/users/42"
  params: Record<string, string>;    // { id: "42" }
  query: Record<string, string>;     // { tab: "settings" }
  matched: string | null;            // "/users/:id" — the first matching pattern
}
```

Since route state is a regular Pulse store, you can select from it in any connected component:

```jsx
const NavIndicator = connect({
  path: router.store.select((s) => s.path),
})(function NavIndicator({ path }) {
  return <span>Current: {path}</span>;
});
```

## Route Component

`Route` is a connected component that renders its `component` only when the current path matches the route pattern:

```jsx
const { Route } = router;

function App() {
  return (
    <div>
      <Route path="/" component={Home} />
      <Route path="/users/:id" component={UserProfile} />
      <Route path="*" component={NotFound} />
    </div>
  );
}
```

- Each `Route` does its own matching — it's independent of other Routes.
- When matched, the `component` receives `params` as a prop.
- When not matched, the Route renders nothing.
- Multiple Routes can match simultaneously (no exclusive matching by default).

### Passing Props to Route Components

Route components receive `params` plus any extra props passed to `Route`:

```jsx
<Route path="/users/:id" component={UserProfile} showAvatar={true} />

// UserProfile receives: { params: { id: "42" }, showAvatar: true }
```

## Link Component

`Link` renders a real `<a>` element that navigates without a full page reload:

```jsx
const { Link } = router;

function Nav() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/users/1">User 1</Link>
      <Link to="/settings?tab=profile">Settings</Link>
    </nav>
  );
}
```

- Renders a standard `<a>` with a valid `href` — right-click "open in new tab" works, as does accessibility and SEO.
- Normal clicks call `e.preventDefault()` and use `navigate()` for SPA navigation.
- Modifier clicks (Ctrl, Cmd, Shift, middle-click) pass through to the browser's default behavior.
- Extra props are spread onto the `<a>` element:

```jsx
<Link to="/about" className="nav-link" id="about-link">About</Link>
```

## Redirect Component

`Redirect` performs a redirect when rendered. Useful for default routes or auth guards:

```jsx
const { Route, Redirect } = router;

function App() {
  return (
    <div>
      <Route path="/" component={Home} />
      <Route path="/old-page" component={() => <Redirect to="/new-page" />} />
    </div>
  );
}
```

`Redirect` uses `replaceState` — the redirected-from page doesn't appear in browser history.

## Navigation

### Programmatic Navigation

```js
// Push a new history entry
router.navigate('/users/42');

// Replace the current history entry (back button skips it)
router.redirect('/login');

// Browser back/forward
router.back();
router.forward();
```

### With Query Strings

```js
router.navigate('/search?q=pulse&page=2');
// State: { path: "/search", query: { q: "pulse", page: "2" }, ... }
```

## Path Matching

Routes are matched in definition order — the first match wins.

### Static Paths

```js
{ path: '/' }          // matches exactly "/"
{ path: '/about' }     // matches exactly "/about"
```

### Dynamic Parameters

```js
{ path: '/users/:id' }           // matches "/users/42" → { id: "42" }
{ path: '/posts/:year/:slug' }   // matches "/posts/2024/hello" → { year: "2024", slug: "hello" }
```

### Wildcard Suffix

```js
{ path: '/dashboard/*' }   // matches "/dashboard/settings" → { "*": "settings" }
                            // matches "/dashboard/a/b/c"    → { "*": "a/b/c" }
                            // matches "/dashboard"          → { "*": "" }
```

### Catch-All

```js
{ path: '*' }   // matches any path → { "*": "/whatever/path" }
```

### Trailing Slashes

Trailing slashes are normalized: `/about/` matches the same as `/about`. The root path `/` is preserved as-is.

## Nested Routes

All paths are absolute. Parent routes use a wildcard suffix, and child routes use full paths:

```jsx
const router = createRouter({
  routes: [
    { path: '/' },
    { path: '/dashboard/*' },
    { path: '/dashboard/settings' },
    { path: '/dashboard/profile' },
  ],
});

const { Route } = router;

function App() {
  return (
    <div>
      <Route path="/" component={Home} />
      <Route path="/dashboard/*" component={Dashboard} />
    </div>
  );
}

function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <Route path="/dashboard/settings" component={Settings} />
      <Route path="/dashboard/profile" component={Profile} />
    </div>
  );
}
```

Each `Route` does its own matching independently — nested routes work because the parent `Route` renders when the path starts with `/dashboard/`, and the child Routes render when the path matches their specific patterns.

## Connecting to Route State

Since the router uses a standard Pulse store, you can connect any component to route state:

```jsx
// Highlight active nav link
const NavLink = connect({
  currentPath: router.store.select((s) => s.path),
})(function NavLink({ currentPath, to, children }) {
  const isActive = currentPath === to;
  return (
    <Link to={to} className={isActive ? 'active' : ''}>
      {children}
    </Link>
  );
});

// Read route params anywhere
const Breadcrumb = connect({
  params: router.store.select((s) => s.params),
  path: router.store.select((s) => s.path),
})(function Breadcrumb({ params, path }) {
  return <span>{path} — {JSON.stringify(params)}</span>;
});
```

## Cleanup

Call `destroy()` to remove the `popstate` listener when the router is no longer needed:

```js
router.destroy();
```

This is mainly useful in tests or when tearing down a single-page app. In most apps, the router lives for the entire session.

## Testing

Use the `initialPath` option to set the starting path without depending on `window.location`:

```js
const router = createRouter({
  routes: [
    { path: '/' },
    { path: '/users/:id' },
  ],
  initialPath: '/users/42',
});

router.store.getState();
// { path: "/users/42", params: { id: "42" }, query: {}, matched: "/users/:id" }
```

## Full Example

```jsx
import { h, render, createRouter } from '@shane_il/pulse';

const router = createRouter({
  routes: [
    { path: '/' },
    { path: '/users/:id' },
    { path: '*' },
  ],
});

const { Route, Link } = router;

function Home() {
  return <h1>Home</h1>;
}

function UserProfile({ params }) {
  return <h1>User {params.id}</h1>;
}

function NotFound() {
  return <h1>404 — Page Not Found</h1>;
}

function App() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/users/1">User 1</Link>
        <Link to="/users/2">User 2</Link>
      </nav>
      <main>
        <Route path="/" component={Home} />
        <Route path="/users/:id" component={UserProfile} />
        <Route path="*" component={NotFound} />
      </main>
    </div>
  );
}

render(<App />, document.getElementById('app'));
```
