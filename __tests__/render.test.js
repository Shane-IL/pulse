import { describe, it, expect } from 'vitest';
import { render } from '../src/render';
import { h, Fragment } from '../src/createElement';

describe('render', () => {
  it('mounts an element to container', () => {
    const container = document.createElement('div');
    render(h('p', null, 'hello'), container);
    expect(container.innerHTML).toBe('<p>hello</p>');
  });

  it('mounts nested tree', () => {
    const container = document.createElement('div');
    render(
      h('div', { className: 'app' },
        h('h1', null, 'Title'),
        h('p', null, 'Body'),
      ),
      container,
    );
    expect(container.innerHTML).toBe('<div class="app"><h1>Title</h1><p>Body</p></div>');
  });

  it('handles text children', () => {
    const container = document.createElement('div');
    render(h('span', null, 'count: ', 42), container);
    expect(container.textContent).toBe('count: 42');
  });

  it('expands plain function components', () => {
    function Greeting({ name }) {
      return h('p', null, 'Hello, ', name);
    }
    const container = document.createElement('div');
    render(h(Greeting, { name: 'World' }), container);
    expect(container.innerHTML).toBe('<p>Hello, World</p>');
  });

  it('expands nested function components', () => {
    function Inner() {
      return h('span', null, 'inner');
    }
    function Outer() {
      return h('div', null, h(Inner, null));
    }
    const container = document.createElement('div');
    render(h(Outer, null), container);
    expect(container.innerHTML).toBe('<div><span>inner</span></div>');
  });

  it('updates on second render call', () => {
    const container = document.createElement('div');
    render(h('p', null, 'first'), container);
    expect(container.innerHTML).toBe('<p>first</p>');
    render(h('p', null, 'second'), container);
    expect(container.innerHTML).toBe('<p>second</p>');
  });

  it('handles Fragment', () => {
    const container = document.createElement('div');
    render(
      h(Fragment, null,
        h('span', null, 'a'),
        h('span', null, 'b'),
      ),
      container,
    );
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');
  });

  it('handles conditional children', () => {
    const container = document.createElement('div');
    render(h('div', null, true && h('span', null, 'yes')), container);
    expect(container.innerHTML).toBe('<div><span>yes</span></div>');
  });
});
