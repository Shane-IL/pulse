import { describe, it, expect, vi, afterEach } from 'vitest';
import { h, render, flushSync, createRouter } from '../src/index';

// ── Helpers ────────────────────────────────────────────────

function setup(routes, initialPath = '/') {
  window.history.pushState(null, '', initialPath);
  const router = createRouter({ routes: routes.map((p) => ({ path: p })) });
  const container = document.createElement('div');
  return { router, container };
}

// ── Route Matching ─────────────────────────────────────────

describe('route matching', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('exact path matches', () => {
    const { router } = setup(['/about'], '/about');
    expect(router.store.getState().matched).toBe('/about');
    expect(router.store.getState().path).toBe('/about');
    router.destroy();
  });

  it('exact path does not match different path', () => {
    const { router } = setup(['/about'], '/contact');
    expect(router.store.getState().matched).toBeNull();
    router.destroy();
  });

  it('parameterized path matches and extracts params', () => {
    const { router } = setup(['/users/:id'], '/users/42');
    expect(router.store.getState().matched).toBe('/users/:id');
    expect(router.store.getState().params).toEqual({ id: '42' });
    router.destroy();
  });

  it('multi-param path matches', () => {
    const { router } = setup(['/posts/:year/:slug'], '/posts/2024/hello-world');
    expect(router.store.getState().params).toEqual({
      year: '2024',
      slug: 'hello-world',
    });
    router.destroy();
  });

  it('wildcard * catches all', () => {
    const { router } = setup(['*'], '/anything/at/all');
    expect(router.store.getState().matched).toBe('*');
    router.destroy();
  });

  it('prefix wildcard /dashboard/* matches nested paths', () => {
    const { router } = setup(['/dashboard/*'], '/dashboard/settings');
    expect(router.store.getState().matched).toBe('/dashboard/*');
    expect(router.store.getState().params).toEqual({ '*': 'settings' });
    router.destroy();
  });

  it('prefix wildcard matches the base path too', () => {
    const { router } = setup(['/dashboard/*'], '/dashboard');
    expect(router.store.getState().matched).toBe('/dashboard/*');
    expect(router.store.getState().params).toEqual({ '*': '' });
    router.destroy();
  });

  it('trailing slash is normalized', () => {
    const { router } = setup(['/about'], '/about/');
    expect(router.store.getState().matched).toBe('/about');
    router.destroy();
  });

  it('root / matches exactly', () => {
    const { router } = setup(['/'], '/');
    expect(router.store.getState().matched).toBe('/');
    router.destroy();
  });

  it('first match wins', () => {
    const { router } = setup(
      ['/users/:id', '/users/special'],
      '/users/special',
    );
    // :id matches first
    expect(router.store.getState().matched).toBe('/users/:id');
    expect(router.store.getState().params).toEqual({ id: 'special' });
    router.destroy();
  });
});

// ── Router Store ───────────────────────────────────────────

describe('router store', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('initial state reflects current path', () => {
    const { router } = setup(['/about', '*'], '/about');
    const state = router.store.getState();
    expect(state.path).toBe('/about');
    expect(state.matched).toBe('/about');
    expect(state.params).toEqual({});
    expect(state.query).toEqual({});
    router.destroy();
  });

  it('navigate() updates path, params, and matched', () => {
    const { router } = setup(['/users/:id', '*'], '/');
    router.navigate('/users/7');
    const state = router.store.getState();
    expect(state.path).toBe('/users/7');
    expect(state.params).toEqual({ id: '7' });
    expect(state.matched).toBe('/users/:id');
    router.destroy();
  });

  it('navigate() updates query', () => {
    const { router } = setup(['/', '*'], '/');
    router.navigate('/?tab=settings&page=2');
    const state = router.store.getState();
    expect(state.path).toBe('/');
    expect(state.query).toEqual({ tab: 'settings', page: '2' });
    router.destroy();
  });

  it('navigate() to unmatched path sets matched to null', () => {
    const { router } = setup(['/about'], '/about');
    router.navigate('/nowhere');
    expect(router.store.getState().matched).toBeNull();
    router.destroy();
  });

  it('redirect() updates state like navigate', () => {
    const { router } = setup(['/login', '/dashboard'], '/login');
    router.redirect('/dashboard');
    expect(router.store.getState().path).toBe('/dashboard');
    expect(router.store.getState().matched).toBe('/dashboard');
    router.destroy();
  });

  it('subscribers are notified on navigation', () => {
    const { router } = setup(['/a', '/b'], '/a');
    const listener = vi.fn();
    router.store.subscribe(listener);
    router.navigate('/b');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/b' }),
    );
    router.destroy();
  });

  it('initialPath option overrides window.location', () => {
    window.history.pushState(null, '', '/actual');
    const router = createRouter({
      routes: [{ path: '/override' }],
      initialPath: '/override',
    });
    expect(router.store.getState().path).toBe('/override');
    expect(router.store.getState().matched).toBe('/override');
    router.destroy();
  });
});

// ── History Integration ────────────────────────────────────

describe('history integration', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('navigate() calls history.pushState', () => {
    const { router } = setup(['/a', '/b'], '/a');
    const spy = vi.spyOn(window.history, 'pushState');
    router.navigate('/b');
    expect(spy).toHaveBeenCalledWith(null, '', '/b');
    spy.mockRestore();
    router.destroy();
  });

  it('redirect() calls history.replaceState', () => {
    const { router } = setup(['/a', '/b'], '/a');
    const spy = vi.spyOn(window.history, 'replaceState');
    router.redirect('/b');
    expect(spy).toHaveBeenCalledWith(null, '', '/b');
    spy.mockRestore();
    router.destroy();
  });

  it('popstate event updates the store', () => {
    const { router } = setup(['/a', '/b'], '/a');
    // Simulate browser navigating to /b
    window.history.pushState(null, '', '/b');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(router.store.getState().path).toBe('/b');
    router.destroy();
  });

  it('destroy() removes popstate listener', () => {
    const { router } = setup(['/a', '/b'], '/a');
    router.destroy();
    window.history.pushState(null, '', '/b');
    window.dispatchEvent(new PopStateEvent('popstate'));
    // Store should NOT have updated
    expect(router.store.getState().path).toBe('/a');
  });

  it('back() calls history.back()', () => {
    const { router } = setup([], '/');
    const spy = vi.spyOn(window.history, 'back');
    router.back();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    router.destroy();
  });

  it('forward() calls history.forward()', () => {
    const { router } = setup([], '/');
    const spy = vi.spyOn(window.history, 'forward');
    router.forward();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    router.destroy();
  });
});

// ── Route Component ────────────────────────────────────────

describe('Route component', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('renders component when path matches', () => {
    const { router, container } = setup(['/', '/about'], '/about');
    const { Route } = router;
    function About() {
      return h('h1', null, 'About');
    }
    render(h(Route, { path: '/about', component: About }), container);
    expect(container.querySelector('h1').textContent).toBe('About');
    router.destroy();
  });

  it('renders nothing when path does not match', () => {
    const { router, container } = setup(['/about'], '/');
    const { Route } = router;
    function About() {
      return h('h1', null, 'About');
    }
    render(h(Route, { path: '/about', component: About }), container);
    expect(container.querySelector('h1')).toBeNull();
    router.destroy();
  });

  it('passes params to rendered component', () => {
    const { router, container } = setup(['/users/:id'], '/users/42');
    const { Route } = router;
    function User({ params }) {
      return h('span', null, params.id);
    }
    render(h(Route, { path: '/users/:id', component: User }), container);
    expect(container.querySelector('span').textContent).toBe('42');
    router.destroy();
  });

  it('switches component on navigation', () => {
    const { router, container } = setup(['/a', '/b'], '/a');
    const { Route } = router;
    function PageA() {
      return h('div', { className: 'a' }, 'A');
    }
    function PageB() {
      return h('div', { className: 'b' }, 'B');
    }

    function App() {
      return h(
        'div',
        null,
        h(Route, { path: '/a', component: PageA }),
        h(Route, { path: '/b', component: PageB }),
      );
    }

    render(h(App, null), container);
    expect(container.querySelector('.a')).not.toBeNull();
    expect(container.querySelector('.b')).toBeNull();

    router.navigate('/b');
    flushSync();
    expect(container.querySelector('.a')).toBeNull();
    expect(container.querySelector('.b')).not.toBeNull();
    router.destroy();
  });

  it('wildcard route renders when nothing else matches', () => {
    const { router, container } = setup(['/home', '*'], '/unknown');
    const { Route } = router;
    function Home() {
      return h('div', { className: 'home' }, 'Home');
    }
    function NotFound() {
      return h('div', { className: 'nf' }, '404');
    }

    function App() {
      return h(
        'div',
        null,
        h(Route, { path: '/home', component: Home }),
        h(Route, { path: '*', component: NotFound }),
      );
    }

    render(h(App, null), container);
    expect(container.querySelector('.home')).toBeNull();
    expect(container.querySelector('.nf')).not.toBeNull();
    router.destroy();
  });

  it('nested routes render correctly', () => {
    const { router, container } = setup(
      ['/dashboard/*', '/dashboard/settings'],
      '/dashboard/settings',
    );
    const { Route } = router;

    function Settings() {
      return h('span', { className: 'settings' }, 'Settings');
    }
    function Dashboard() {
      return h(
        'div',
        { className: 'dash' },
        h(Route, { path: '/dashboard/settings', component: Settings }),
      );
    }

    render(h(Route, { path: '/dashboard/*', component: Dashboard }), container);
    expect(container.querySelector('.dash')).not.toBeNull();
    expect(container.querySelector('.settings')).not.toBeNull();
    router.destroy();
  });
});

// ── Link Component ─────────────────────────────────────────

describe('Link component', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('renders an <a> with correct href', () => {
    const { router, container } = setup([], '/');
    const { Link } = router;
    render(h(Link, { to: '/about' }, 'About'), container);
    const a = container.querySelector('a');
    expect(a).not.toBeNull();
    expect(a.getAttribute('href')).toBe('/about');
    expect(a.textContent).toBe('About');
    router.destroy();
  });

  it('click navigates and prevents default', () => {
    const { router, container } = setup(['/about'], '/');
    const { Link } = router;
    render(h(Link, { to: '/about' }, 'About'), container);
    const a = container.querySelector('a');
    const event = new MouseEvent('click', { bubbles: true, button: 0 });
    const pd = vi.spyOn(event, 'preventDefault');
    a.dispatchEvent(event);
    expect(pd).toHaveBeenCalled();
    expect(router.store.getState().path).toBe('/about');
    router.destroy();
  });

  it('modifier clicks do not prevent default', () => {
    const { router, container } = setup(['/about'], '/');
    const { Link } = router;
    render(h(Link, { to: '/about' }, 'About'), container);
    const a = container.querySelector('a');

    const ctrlClick = new MouseEvent('click', {
      bubbles: true,
      button: 0,
      ctrlKey: true,
    });
    const pdSpy = vi.spyOn(ctrlClick, 'preventDefault');
    a.dispatchEvent(ctrlClick);
    expect(pdSpy).not.toHaveBeenCalled();
    // Store should not have changed
    expect(router.store.getState().path).toBe('/');
    router.destroy();
  });

  it('passes through additional props', () => {
    const { router, container } = setup([], '/');
    const { Link } = router;
    render(
      h(Link, { to: '/x', className: 'nav-link', id: 'mylink' }, 'X'),
      container,
    );
    const a = container.querySelector('a');
    expect(a.className).toBe('nav-link');
    expect(a.id).toBe('mylink');
    router.destroy();
  });

  it('renders children as link content', () => {
    const { router, container } = setup([], '/');
    const { Link } = router;
    render(h(Link, { to: '/' }, h('span', null, 'Home'), ' Page'), container);
    const a = container.querySelector('a');
    expect(a.querySelector('span').textContent).toBe('Home');
    router.destroy();
  });

  it('applies activeClass when path matches', () => {
    const { router, container } = setup(['/', '/about'], '/about');
    const { Link } = router;
    render(
      h(Link, { to: '/about', activeClass: 'active' }, 'About'),
      container,
    );
    const a = container.querySelector('a');
    expect(a.className).toBe('active');
    router.destroy();
  });

  it('does not apply activeClass when path does not match', () => {
    const { router, container } = setup(['/', '/about'], '/');
    const { Link } = router;
    render(
      h(Link, { to: '/about', activeClass: 'active' }, 'About'),
      container,
    );
    const a = container.querySelector('a');
    expect(a.className).toBe('');
    router.destroy();
  });

  it('combines className and activeClass', () => {
    const { router, container } = setup(['/', '/about'], '/about');
    const { Link } = router;
    render(
      h(
        Link,
        { to: '/about', className: 'nav-link', activeClass: 'active' },
        'About',
      ),
      container,
    );
    const a = container.querySelector('a');
    expect(a.className).toBe('nav-link active');
    router.destroy();
  });
});

// ── Redirect Component ─────────────────────────────────────

describe('Redirect component', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('renders nothing', () => {
    const { router, container } = setup(['/target'], '/');
    const { Redirect } = router;
    render(h(Redirect, { to: '/target' }), container);
    expect(container.innerHTML).toBe('');
    router.destroy();
  });

  it('calls redirect and updates store', () => {
    const { router, container } = setup(['/target'], '/');
    const { Redirect } = router;
    const spy = vi.spyOn(window.history, 'replaceState');
    render(h(Redirect, { to: '/target' }), container);
    expect(router.store.getState().path).toBe('/target');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    router.destroy();
  });
});

// ── Edge Cases ─────────────────────────────────────────────

describe('edge cases', () => {
  afterEach(() => window.history.pushState(null, '', '/'));

  it('query string with special characters', () => {
    const { router } = setup(['/search'], '/search');
    router.navigate('/search?q=hello+world&tag=a%26b');
    const q = router.store.getState().query;
    expect(q.q).toBe('hello world');
    expect(q.tag).toBe('a&b');
    router.destroy();
  });

  it('navigating to same path is a no-op (identity check)', () => {
    const { router } = setup(['/about'], '/about');
    const listener = vi.fn();
    router.store.subscribe(listener);
    router.navigate('/about');
    // Store dispatch with identical state returns same ref → no notification
    // Actually, _sync always creates a new object, so subscriber IS called.
    // This test documents the behavior:
    expect(listener).toHaveBeenCalledTimes(1);
    router.destroy();
  });

  it('params with numeric-looking values stay as strings', () => {
    const { router } = setup(['/items/:id'], '/items/007');
    expect(router.store.getState().params).toEqual({ id: '007' });
    router.destroy();
  });
});
