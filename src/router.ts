import { createStore } from './store';
import { connect } from './connect';
import { h } from './createElement';
import type { Store } from './store';
import type { VNode, ComponentFunction } from './vnode';

// ── Types ──────────────────────────────────────────────────

export interface RouteState {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  matched: string | null;
}

export interface RouteConfig {
  path: string;
}

export interface RouterOptions {
  routes: RouteConfig[];
  initialPath?: string;
}

export interface Router {
  store: Store<RouteState>;
  navigate: (path: string) => void;
  redirect: (path: string) => void;
  back: () => void;
  forward: () => void;
  destroy: () => void;
  Route: ComponentFunction;
  Link: ComponentFunction;
  Redirect: ComponentFunction;
}

// ── Path Utilities ─────────────────────────────────────────

function normalizePath(path: string): string {
  // Strip trailing slash (but keep root "/")
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path || '/';
}

function parseQuery(search: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!search) return result;
  const cleaned = search.startsWith('?') ? search.slice(1) : search;
  if (!cleaned) return result;
  const params = new URLSearchParams(cleaned);
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ── Route Matching ─────────────────────────────────────────

interface MatchResult {
  pattern: string;
  params: Record<string, string>;
}

function matchSingle(
  path: string,
  pattern: string,
): { params: Record<string, string> } | null {
  const normalizedPath = normalizePath(path);
  const normalizedPattern = normalizePath(pattern);

  // Catch-all wildcard
  if (normalizedPattern === '*') {
    return { params: { '*': normalizedPath } };
  }

  const pathSegments =
    normalizedPath === '/' ? [''] : normalizedPath.split('/').slice(1);
  const patternSegments =
    normalizedPattern === '/' ? [''] : normalizedPattern.split('/').slice(1);

  // Check for trailing wildcard (prefix matching)
  const hasTrailingWildcard =
    patternSegments.length > 0 &&
    patternSegments[patternSegments.length - 1] === '*';

  if (hasTrailingWildcard) {
    const prefixSegments = patternSegments.slice(0, -1);

    // Path must have at least as many segments as the prefix
    if (pathSegments.length < prefixSegments.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < prefixSegments.length; i++) {
      const ps = prefixSegments[i];
      if (ps.startsWith(':')) {
        params[ps.slice(1)] = pathSegments[i];
      } else if (ps !== pathSegments[i]) {
        return null;
      }
    }

    // Capture the rest as "*" param
    const rest = pathSegments.slice(prefixSegments.length).join('/');
    params['*'] = rest;
    return { params };
  }

  // Exact segment count required for non-wildcard patterns
  if (pathSegments.length !== patternSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const ps = patternSegments[i];
    if (ps.startsWith(':')) {
      params[ps.slice(1)] = pathSegments[i];
    } else if (ps !== pathSegments[i]) {
      return null;
    }
  }

  return { params };
}

function matchRoute(path: string, routes: RouteConfig[]): MatchResult | null {
  for (const route of routes) {
    const result = matchSingle(path, route.path);
    if (result) {
      return { pattern: route.path, params: result.params };
    }
  }
  return null;
}

// ── Router Factory ─────────────────────────────────────────

export function createRouter(options: RouterOptions): Router {
  const { routes, initialPath } = options;

  // Read initial URL
  const initPathRaw = initialPath ?? window.location.pathname;
  const initSearch = initialPath ? '' : window.location.search;
  const initPath = normalizePath(initPathRaw);
  const initQuery = parseQuery(initSearch);
  const initMatch = matchRoute(initPath, routes);

  // Create the route store
  const store = createStore<RouteState>({
    state: {
      path: initPath,
      params: initMatch?.params ?? {},
      query: initQuery,
      matched: initMatch?.pattern ?? null,
    },
    actions: {
      _sync: (_: RouteState, payload: RouteState) => payload,
    },
  });

  // ── Navigation ──

  function buildState(rawPath: string): RouteState {
    const qIdx = rawPath.indexOf('?');
    const pathname = normalizePath(
      qIdx >= 0 ? rawPath.slice(0, qIdx) : rawPath,
    );
    const queryStr = qIdx >= 0 ? rawPath.slice(qIdx + 1) : '';
    const query = parseQuery(queryStr);
    const match = matchRoute(pathname, routes);
    return {
      path: pathname,
      params: match?.params ?? {},
      query,
      matched: match?.pattern ?? null,
    };
  }

  function navigate(path: string): void {
    const state = buildState(path);
    window.history.pushState(null, '', path);
    store.dispatch('_sync', state);
  }

  function redirect(path: string): void {
    const state = buildState(path);
    window.history.replaceState(null, '', path);
    store.dispatch('_sync', state);
  }

  function back(): void {
    window.history.back();
  }

  function forward(): void {
    window.history.forward();
  }

  // ── Popstate ──

  function onPopState(): void {
    const state = buildState(window.location.pathname + window.location.search);
    store.dispatch('_sync', state);
  }

  window.addEventListener('popstate', onPopState);

  function destroy(): void {
    window.removeEventListener('popstate', onPopState);
  }

  // ── Route Component (connected) ──

  const Route = connect({
    _path: store.select((s: RouteState) => s.path),
  })(function RouteInner(props: Record<string, any>): VNode | null {
    const { _path, path: pattern, component, children, ...rest } = props;
    const match = matchSingle(_path, pattern);
    if (!match) return null;
    if (component) {
      return h(component, { ...rest, params: match.params });
    }
    return children?.[0] ?? null;
  });

  // ── Link Component (connected for activeClass support) ──

  const Link = connect({
    _currentPath: store.select((s: RouteState) => s.path),
  })(function LinkInner(props: Record<string, any>): VNode {
    const { to, children, activeClass, className, _currentPath, ...rest } =
      props;

    const isActive = normalizePath(to) === _currentPath;
    let cls = className || '';
    if (activeClass && isActive) {
      cls = cls ? `${cls} ${activeClass}` : activeClass;
    }

    return h(
      'a',
      {
        ...rest,
        href: to,
        className: cls || undefined,
        onClick: (e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          navigate(to);
        },
      },
      ...(children || []),
    );
  });

  // ── Redirect Component (plain) ──

  function RedirectComponent(props: Record<string, any>): VNode | null {
    redirect(props.to);
    return null;
  }

  return {
    store,
    navigate,
    redirect,
    back,
    forward,
    destroy,
    Route,
    Link,
    Redirect: RedirectComponent,
  };
}
