import { describe, it, expect } from 'vitest';
import { render } from '../src/render';
import { h, Fragment } from '../src/createElement';

describe('render', () => {
  it('defaults to #app when no container given', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
    try {
      render(h('p', null, 'auto'));
      expect(app.innerHTML).toBe('<p>auto</p>');
    } finally {
      document.body.removeChild(app);
    }
  });

  it('accepts a CSS selector string', () => {
    const el = document.createElement('div');
    el.id = 'custom-root';
    document.body.appendChild(el);
    try {
      render(h('p', null, 'selector'), '#custom-root');
      expect(el.innerHTML).toBe('<p>selector</p>');
    } finally {
      document.body.removeChild(el);
    }
  });

  it('throws when no mount target found', () => {
    expect(() => render(h('p', null, 'fail'))).toThrow('no mount target');
  });

  it('mounts an element to container', () => {
    const container = document.createElement('div');
    render(h('p', null, 'hello'), container);
    expect(container.innerHTML).toBe('<p>hello</p>');
  });

  it('mounts nested tree', () => {
    const container = document.createElement('div');
    render(
      h(
        'div',
        { className: 'app' },
        h('h1', null, 'Title'),
        h('p', null, 'Body'),
      ),
      container,
    );
    expect(container.innerHTML).toBe(
      '<div class="app"><h1>Title</h1><p>Body</p></div>',
    );
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
      h(Fragment, null, h('span', null, 'a'), h('span', null, 'b')),
      container,
    );
    expect(container.innerHTML).toBe('<span>a</span><span>b</span>');
  });

  it('handles conditional children', () => {
    const container = document.createElement('div');
    const show = true;
    render(h('div', null, show && h('span', null, 'yes')), container);
    expect(container.innerHTML).toBe('<div><span>yes</span></div>');
  });
});
