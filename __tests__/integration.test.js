import { describe, it, expect, vi } from 'vitest';
import { h, createStore, connect, render, flushSync } from '../src/index';

describe('integration: store -> connect -> render', () => {
  it('counter example works end to end', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (s) => ({ ...s, count: s.count + 1 }),
      },
    });

    function Counter({ count }) {
      return h('div', null, h('span', { className: 'count' }, String(count)));
    }

    const ConnectedCounter = connect({
      count: store.select((s) => s.count),
    })(Counter);

    const container = document.createElement('div');
    render(h(ConnectedCounter, null), container);

    expect(container.querySelector('.count').textContent).toBe('0');

    store.dispatch('increment');
    flushSync();

    expect(container.querySelector('.count').textContent).toBe('1');
  });

  it('multiple dispatches are batched', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (s) => ({ ...s, count: s.count + 1 }),
      },
    });

    let renderCount = 0;
    function Counter({ count }) {
      renderCount++;
      return h('span', null, String(count));
    }

    const Connected = connect({
      count: store.select((s) => s.count),
    })(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);
    renderCount = 0; // reset after initial render

    store.dispatch('increment');
    store.dispatch('increment');
    store.dispatch('increment');
    flushSync();

    expect(container.textContent).toBe('3');
    // Should have rendered only once due to batching (scheduler deduplicates)
    expect(renderCount).toBe(1);
  });

  it('multiple connected components from same store', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (s) => ({ ...s, count: s.count + 1 }),
      },
    });

    function Display({ count }) {
      return h('span', { className: 'display' }, String(count));
    }
    function Double({ count }) {
      return h('span', { className: 'double' }, String(count * 2));
    }

    const ConnectedDisplay = connect({ count: store.select((s) => s.count) })(
      Display,
    );
    const ConnectedDouble = connect({ count: store.select((s) => s.count) })(
      Double,
    );

    const container = document.createElement('div');
    render(
      h('div', null, h(ConnectedDisplay, null), h(ConnectedDouble, null)),
      container,
    );

    expect(container.querySelector('.display').textContent).toBe('0');
    expect(container.querySelector('.double').textContent).toBe('0');

    store.dispatch('increment');
    flushSync();

    expect(container.querySelector('.display').textContent).toBe('1');
    expect(container.querySelector('.double').textContent).toBe('2');
  });

  it('connected component with multiple stores', () => {
    const nameStore = createStore({
      state: { name: 'World' },
      actions: { set: (_, name) => ({ name }) },
    });
    const countStore = createStore({
      state: { count: 0 },
      actions: { increment: (s) => ({ ...s, count: s.count + 1 }) },
    });

    function Greeting({ name, count }) {
      return h('p', null, `${name}: ${count}`);
    }

    const Connected = connect({
      name: nameStore.select((s) => s.name),
      count: countStore.select((s) => s.count),
    })(Greeting);

    const container = document.createElement('div');
    render(h(Connected, null), container);
    expect(container.textContent).toBe('World: 0');

    countStore.dispatch('increment');
    flushSync();
    expect(container.textContent).toBe('World: 1');

    nameStore.dispatch('set', 'Pulse');
    flushSync();
    expect(container.textContent).toBe('Pulse: 1');
  });

  it('plain function components render correctly', () => {
    function Header({ title }) {
      return h('h1', null, title);
    }
    function App() {
      return h('div', null, h(Header, { title: 'Pulse' }));
    }

    const container = document.createElement('div');
    render(h(App, null), container);
    expect(container.innerHTML).toBe('<div><h1>Pulse</h1></div>');
  });
});

describe('lifecycle integration', () => {
  it('onMount fires after first render with real DOM', () => {
    const onMount = vi.fn();

    function View({ count }) {
      return h('span', { className: 'val' }, String(count));
    }

    const store = createStore({
      state: { count: 7 },
      actions: {},
    });

    const Connected = connect(
      { count: store.select((s) => s.count) },
      { onMount },
    )(View);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(onMount).toHaveBeenCalledTimes(1);
    // The dom argument should be the actual rendered DOM element
    const { dom } = onMount.mock.calls[0][0];
    expect(dom).toBeInstanceOf(HTMLElement);
    expect(dom.textContent).toBe('7');
  });

  it('onDestroy fires when component is conditionally removed', () => {
    const onDestroy = vi.fn();

    function Child() {
      return h('span', null, 'child');
    }

    const Connected = connect({}, { onDestroy })(Child);

    const store = createStore({
      state: { show: true },
      actions: { hide: () => ({ show: false }) },
    });

    function App({ show }) {
      return h('div', null, show ? h(Connected, null) : null);
    }

    const ConnectedApp = connect({
      show: store.select((s) => s.show),
    })(App);

    const container = document.createElement('div');
    render(h(ConnectedApp, null), container);

    expect(container.textContent).toBe('child');
    expect(onDestroy).not.toHaveBeenCalled();

    store.dispatch('hide');
    flushSync();

    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it('re-renders do not re-trigger onMount', () => {
    const onMount = vi.fn();

    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      { onMount },
    )(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(onMount).toHaveBeenCalledTimes(1);

    store.dispatch('inc');
    flushSync();
    store.dispatch('inc');
    flushSync();

    // Still only called once — on initial mount
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('2');
  });

  it('lifecycle-only component (no store bindings)', () => {
    const onMount = vi.fn();
    const onDestroy = vi.fn();

    function Static() {
      return h('div', null, 'hello');
    }

    const Connected = connect({}, { onMount, onDestroy })(Static);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(container.textContent).toBe('hello');
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it('onMount cleanup is called when component is removed', () => {
    const cleanup = vi.fn();
    const onMount = vi.fn(() => cleanup);

    function Timer() {
      return h('span', null, 'tick');
    }

    const ConnectedTimer = connect({}, { onMount })(Timer);

    const store = createStore({
      state: { show: true },
      actions: { hide: () => ({ show: false }) },
    });

    function App({ show }) {
      return h('div', null, show ? h(ConnectedTimer, null) : null);
    }

    const ConnectedApp = connect({
      show: store.select((s) => s.show),
    })(App);

    const container = document.createElement('div');
    render(h(ConnectedApp, null), container);

    expect(cleanup).not.toHaveBeenCalled();

    store.dispatch('hide');
    flushSync();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('onUpdate lifecycle', () => {
  it('fires on re-render, not on initial mount', () => {
    const onUpdate = vi.fn();
    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      { onUpdate },
    )(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);
    expect(onUpdate).not.toHaveBeenCalled();

    store.dispatch('inc');
    flushSync();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      dom: expect.any(Node),
      props: {},
    });
  });

  it('fires on every re-render', () => {
    const onUpdate = vi.fn();
    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      { onUpdate },
    )(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    store.dispatch('inc');
    flushSync();
    store.dispatch('inc');
    flushSync();

    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('receives updated DOM', () => {
    const doms = [];
    const onUpdate = vi.fn(({ dom }) => {
      doms.push(dom?.textContent);
    });
    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      { onUpdate },
    )(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    store.dispatch('inc');
    flushSync();

    expect(doms[0]).toBe('1');
  });

  it('works alongside onMount and onDestroy', () => {
    const order = [];
    const onMount = vi.fn(() => order.push('mount'));
    const onUpdate = vi.fn(() => order.push('update'));
    const onDestroy = vi.fn(() => order.push('destroy'));

    const store = createStore({
      state: { count: 0, show: true },
      actions: {
        inc: (s) => ({ ...s, count: s.count + 1 }),
        hide: (s) => ({ ...s, show: false }),
      },
    });

    function Counter({ count }) {
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      { onMount, onUpdate, onDestroy },
    )(Counter);

    function App({ show }) {
      return h('div', null, show ? h(Connected, null) : null);
    }

    const ConnectedApp = connect({
      show: store.select((s) => s.show),
    })(App);

    const container = document.createElement('div');
    render(h(ConnectedApp, null), container);
    expect(order).toEqual(['mount']);

    store.dispatch('inc');
    flushSync();
    expect(order).toEqual(['mount', 'update']);

    store.dispatch('hide');
    flushSync();
    expect(order).toEqual(['mount', 'update', 'destroy']);
  });

  it('does not fire when no lifecycle is provided', () => {
    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      return h('span', null, String(count));
    }

    const Connected = connect({
      count: store.select((s) => s.count),
    })(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    store.dispatch('inc');
    flushSync();

    expect(container.textContent).toBe('1');
  });
});

describe('error boundaries', () => {
  it('catches error in component render and shows fallback', () => {
    function Broken() {
      throw new Error('render failed');
    }

    const Connected = connect(
      {},
      {
        onError: ({ error }) => h('div', { className: 'error' }, error.message),
      },
    )(Broken);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(container.querySelector('.error').textContent).toBe('render failed');
  });

  it('re-throws when no onError is provided', () => {
    function Broken() {
      throw new Error('boom');
    }

    const Connected = connect({})(Broken);
    const container = document.createElement('div');

    expect(() => render(h(Connected, null), container)).toThrow('boom');
  });

  it('catches child component errors (error bubbles to parent boundary)', () => {
    function BrokenChild() {
      throw new Error('child error');
    }

    function Parent() {
      return h('div', null, h(BrokenChild, null));
    }

    const Connected = connect(
      {},
      {
        onError: ({ error }) => h('p', null, `Caught: ${error.message}`),
      },
    )(Parent);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(container.textContent).toBe('Caught: child error');
  });

  it('catches error during re-render and shows fallback', () => {
    let shouldThrow = false;

    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      if (shouldThrow) throw new Error('re-render failed');
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      {
        onError: ({ error }) =>
          h('div', { className: 'fallback' }, error.message),
      },
    )(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);
    expect(container.textContent).toBe('0');

    shouldThrow = true;
    store.dispatch('inc');
    flushSync();

    expect(container.querySelector('.fallback').textContent).toBe(
      're-render failed',
    );
  });

  it('recovers on next re-render if error is transient', () => {
    let shouldThrow = false;

    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      if (shouldThrow) throw new Error('transient');
      return h('span', { className: 'val' }, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      { onError: () => h('div', { className: 'fallback' }, 'error') },
    )(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    shouldThrow = true;
    store.dispatch('inc');
    flushSync();
    expect(container.querySelector('.fallback')).not.toBeNull();

    shouldThrow = false;
    store.dispatch('inc');
    flushSync();
    expect(container.querySelector('.val').textContent).toBe('2');
    expect(container.querySelector('.fallback')).toBeNull();
  });

  it('onError receives props', () => {
    const onError = vi.fn(() => h('div', null, 'fallback'));

    function Broken() {
      throw new Error('test');
    }

    const Connected = connect({}, { onError })(Broken);
    const container = document.createElement('div');
    render(h(Connected, { myProp: 42 }), container);

    expect(onError).toHaveBeenCalledWith({
      error: expect.any(Error),
      props: { myProp: 42 },
    });
  });

  it('onError returning null renders nothing', () => {
    function Broken() {
      throw new Error('fail');
    }

    const Connected = connect(
      {},
      {
        onError: () => null,
      },
    )(Broken);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(container.innerHTML).toBe('');
  });

  it('error in fallback propagates (no infinite loop)', () => {
    function Broken() {
      throw new Error('original');
    }

    const Connected = connect(
      {},
      {
        onError: () => {
          throw new Error('fallback also broken');
        },
      },
    )(Broken);

    const container = document.createElement('div');
    expect(() => render(h(Connected, null), container)).toThrow(
      'fallback also broken',
    );
  });

  it('local store renders and updates via actions', () => {
    function Toggle({ open, toggle }) {
      return h(
        'div',
        null,
        h('span', { className: 'status' }, open ? 'open' : 'closed'),
        h('button', { onClick: () => toggle() }, 'toggle'),
      );
    }

    const Connected = connect(null, {
      store: {
        state: { open: false },
        actions: { toggle: (s) => ({ ...s, open: !s.open }) },
      },
    })(Toggle);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(container.querySelector('.status').textContent).toBe('closed');

    // Simulate click
    container.querySelector('button').click();
    flushSync();

    expect(container.querySelector('.status').textContent).toBe('open');
  });

  it('local store works alongside global bindings', () => {
    const globalStore = createStore({
      state: { theme: 'dark' },
      actions: { setTheme: (s, theme) => ({ ...s, theme }) },
    });

    function Panel({ theme, expanded, toggleExpanded }) {
      return h(
        'div',
        { className: theme },
        h(
          'span',
          { className: 'state' },
          expanded ? 'expanded' : 'collapsed',
        ),
        h('button', { onClick: () => toggleExpanded() }, 'toggle'),
      );
    }

    const Connected = connect(
      { theme: globalStore.select((s) => s.theme) },
      {
        store: {
          state: { expanded: false },
          actions: {
            toggleExpanded: (s) => ({ ...s, expanded: !s.expanded }),
          },
        },
      },
    )(Panel);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    expect(container.querySelector('.dark')).not.toBeNull();
    expect(container.querySelector('.state').textContent).toBe('collapsed');

    // Toggle local state
    container.querySelector('button').click();
    flushSync();
    expect(container.querySelector('.state').textContent).toBe('expanded');

    // Update global store
    globalStore.dispatch('setTheme', 'light');
    flushSync();
    expect(container.querySelector('.light')).not.toBeNull();
    // Local state preserved across global re-render
    expect(container.querySelector('.state').textContent).toBe('expanded');
  });

  it('each local store instance has independent state', () => {
    function Counter({ count, increment }) {
      return h(
        'div',
        { className: 'counter' },
        h('span', { className: 'val' }, String(count)),
        h('button', { onClick: () => increment() }, '+'),
      );
    }

    const Connected = connect(null, {
      store: {
        state: { count: 0 },
        actions: { increment: (s) => ({ ...s, count: s.count + 1 }) },
      },
    })(Counter);

    function App() {
      return h('div', null, h(Connected, { key: 'a' }), h(Connected, { key: 'b' }));
    }

    const container = document.createElement('div');
    render(h(App, null), container);

    const vals = container.querySelectorAll('.val');
    const buttons = container.querySelectorAll('button');
    expect(vals[0].textContent).toBe('0');
    expect(vals[1].textContent).toBe('0');

    // Click first counter only
    buttons[0].click();
    flushSync();

    const valsAfter = container.querySelectorAll('.val');
    expect(valsAfter[0].textContent).toBe('1');
    expect(valsAfter[1].textContent).toBe('0'); // independent
  });

  it('does not fire onUpdate when error is caught during re-render', () => {
    const onUpdate = vi.fn();
    let shouldThrow = false;

    const store = createStore({
      state: { count: 0 },
      actions: { inc: (s) => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      if (shouldThrow) throw new Error('err');
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select((s) => s.count) },
      {
        onUpdate,
        onError: () => h('div', null, 'fallback'),
      },
    )(Counter);

    const container = document.createElement('div');
    render(h(Connected, null), container);

    shouldThrow = true;
    store.dispatch('inc');
    flushSync();

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
