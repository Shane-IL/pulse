import { describe, it, expect, vi } from 'vitest';
import { h, createStore, connect, render, flushSync } from '../src/index.js';

describe('integration: store -> connect -> render', () => {
  it('counter example works end to end', () => {
    const store = createStore({
      state: { count: 0 },
      actions: {
        increment: (s) => ({ ...s, count: s.count + 1 }),
      },
    });

    function Counter({ count }) {
      return h('div', null,
        h('span', { className: 'count' }, String(count)),
      );
    }

    const ConnectedCounter = connect({
      count: store.select(s => s.count),
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
      count: store.select(s => s.count),
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

    const ConnectedDisplay = connect({ count: store.select(s => s.count) })(Display);
    const ConnectedDouble = connect({ count: store.select(s => s.count) })(Double);

    const container = document.createElement('div');
    render(
      h('div', null,
        h(ConnectedDisplay, null),
        h(ConnectedDouble, null),
      ),
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
      name: nameStore.select(s => s.name),
      count: countStore.select(s => s.count),
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
      { count: store.select(s => s.count) },
      { onMount }
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
      show: store.select(s => s.show),
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
      actions: { inc: s => ({ count: s.count + 1 }) },
    });

    function Counter({ count }) {
      return h('span', null, String(count));
    }

    const Connected = connect(
      { count: store.select(s => s.count) },
      { onMount }
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
      show: store.select(s => s.show),
    })(App);

    const container = document.createElement('div');
    render(h(ConnectedApp, null), container);

    expect(cleanup).not.toHaveBeenCalled();

    store.dispatch('hide');
    flushSync();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
