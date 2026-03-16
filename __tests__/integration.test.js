import { describe, it, expect } from 'vitest';
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
