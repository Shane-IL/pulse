import { describe, it, expect, vi } from 'vitest';
import { createDOMNode, applyProps, applyPatches } from '../src/patch';
import { h } from '../src/createElement';
import { createTextVNode } from '../src/vnode';
import { PATCH } from '../src/diff';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('createDOMNode', () => {
  it('creates a DOM element from element vnode', () => {
    const vnode = h('div', { className: 'test' });
    const dom = createDOMNode(vnode);
    expect(dom.tagName).toBe('DIV');
    expect(dom.className).toBe('test');
    expect(vnode._dom).toBe(dom);
  });

  it('creates a text node', () => {
    const vnode = createTextVNode('hello');
    const dom = createDOMNode(vnode);
    expect(dom.nodeType).toBe(3); // TEXT_NODE
    expect(dom.textContent).toBe('hello');
    expect(vnode._dom).toBe(dom);
  });

  it('creates nested tree', () => {
    const vnode = h(
      'div',
      null,
      h('span', null, 'child1'),
      h('p', null, 'child2'),
    );
    const dom = createDOMNode(vnode);
    expect(dom.innerHTML).toBe('<span>child1</span><p>child2</p>');
  });
});

describe('applyProps', () => {
  it('sets className', () => {
    const el = document.createElement('div');
    applyProps(el, {}, { className: 'foo' });
    expect(el.className).toBe('foo');
  });

  it('adds event listener', () => {
    const el = document.createElement('button');
    const handler = vi.fn();
    applyProps(el, {}, { onClick: handler });
    el.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('removes old event listener', () => {
    const el = document.createElement('button');
    const oldHandler = vi.fn();
    const newHandler = vi.fn();
    applyProps(el, {}, { onClick: oldHandler });
    applyProps(el, { onClick: oldHandler }, { onClick: newHandler });
    el.click();
    expect(oldHandler).not.toHaveBeenCalled();
    expect(newHandler).toHaveBeenCalledOnce();
  });

  it('handles style objects', () => {
    const el = document.createElement('div');
    applyProps(el, {}, { style: { color: 'red', fontSize: '14px' } });
    expect(el.style.color).toBe('red');
    expect(el.style.fontSize).toBe('14px');
  });

  it('sets boolean attributes', () => {
    const el = document.createElement('input');
    applyProps(el, {}, { disabled: true });
    expect(el.hasAttribute('disabled')).toBe(true);
  });

  it('removes attributes set to false', () => {
    const el = document.createElement('input');
    applyProps(el, {}, { disabled: true });
    applyProps(el, { disabled: true }, { disabled: false });
    expect(el.hasAttribute('disabled')).toBe(false);
  });

  it('sets string attributes', () => {
    const el = document.createElement('div');
    applyProps(el, {}, { 'data-id': '123' });
    expect(el.getAttribute('data-id')).toBe('123');
  });
});

describe('applyPatches', () => {
  it('CREATE appends child', () => {
    const container = document.createElement('div');
    const vnode = h('span', null, 'new');
    applyPatches(container, [{ type: PATCH.CREATE, newVNode: vnode }]);
    expect(container.innerHTML).toBe('<span>new</span>');
  });

  it('REMOVE deletes child', () => {
    const container = document.createElement('div');
    const vnode = h('span', null);
    const dom = createDOMNode(vnode);
    container.appendChild(dom);
    applyPatches(container, [{ type: PATCH.REMOVE, target: vnode }]);
    expect(container.innerHTML).toBe('');
  });

  it('REPLACE swaps node', () => {
    const container = document.createElement('div');
    const oldVNode = h('span', null, 'old');
    const dom = createDOMNode(oldVNode);
    container.appendChild(dom);
    const newVNode = h('p', null, 'new');
    applyPatches(container, [{ type: PATCH.REPLACE, oldVNode, newVNode }]);
    expect(container.innerHTML).toBe('<p>new</p>');
  });

  it('TEXT updates content', () => {
    const container = document.createElement('div');
    const oldVNode = createTextVNode('old');
    const dom = createDOMNode(oldVNode);
    container.appendChild(dom);
    const newVNode = createTextVNode('new');
    applyPatches(container, [{ type: PATCH.TEXT, oldVNode, newVNode }]);
    expect(container.textContent).toBe('new');
  });
});

describe('dangerouslySetInnerHTML', () => {
  it('sets innerHTML from __html property', () => {
    const el = document.createElement('div');
    applyProps(el, {}, { dangerouslySetInnerHTML: { __html: '<b>bold</b>' } });
    expect(el.innerHTML).toBe('<b>bold</b>');
  });

  it('updates innerHTML when value changes', () => {
    const el = document.createElement('div');
    applyProps(el, {}, { dangerouslySetInnerHTML: { __html: '<b>old</b>' } });
    applyProps(
      el,
      { dangerouslySetInnerHTML: { __html: '<b>old</b>' } },
      { dangerouslySetInnerHTML: { __html: '<i>new</i>' } },
    );
    expect(el.innerHTML).toBe('<i>new</i>');
  });

  it('clears innerHTML when prop is removed', () => {
    const el = document.createElement('div');
    applyProps(el, {}, { dangerouslySetInnerHTML: { __html: '<b>hi</b>' } });
    applyProps(el, { dangerouslySetInnerHTML: { __html: '<b>hi</b>' } }, {});
    expect(el.innerHTML).toBe('');
  });

  it('ignores if __html is not a string', () => {
    const el = document.createElement('div');
    el.innerHTML = 'original';
    applyProps(el, {}, { dangerouslySetInnerHTML: { __html: null } });
    expect(el.innerHTML).toBe('original');
  });

  it('works with createDOMNode', () => {
    const vnode = h('div', { dangerouslySetInnerHTML: { __html: '<em>hello</em>' } });
    const dom = createDOMNode(vnode);
    expect(dom.innerHTML).toBe('<em>hello</em>');
  });
});

describe('SVG support', () => {
  it('creates SVG element with correct namespace', () => {
    const vnode = h('svg', { viewBox: '0 0 100 100' });
    const dom = createDOMNode(vnode);
    expect(dom.namespaceURI).toBe(SVG_NS);
    expect(dom.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  it('SVG children inherit namespace', () => {
    const vnode = h(
      'svg',
      { viewBox: '0 0 100 100' },
      h('circle', { cx: '50', cy: '50', r: '40' }),
      h('rect', { x: '10', y: '10', width: '80', height: '80' }),
    );
    const dom = createDOMNode(vnode);
    const circle = dom.querySelector('circle');
    const rect = dom.querySelector('rect');
    expect(circle.namespaceURI).toBe(SVG_NS);
    expect(rect.namespaceURI).toBe(SVG_NS);
    expect(circle.getAttribute('cx')).toBe('50');
  });

  it('deeply nested SVG children inherit namespace', () => {
    const vnode = h(
      'svg',
      null,
      h('g', null, h('path', { d: 'M0 0 L10 10' })),
    );
    const dom = createDOMNode(vnode);
    const path = dom.querySelector('path');
    expect(path.namespaceURI).toBe(SVG_NS);
    expect(path.getAttribute('d')).toBe('M0 0 L10 10');
  });

  it('foreignObject children switch back to HTML namespace', () => {
    const vnode = h(
      'svg',
      null,
      h('foreignObject', null, h('div', { className: 'inner' })),
    );
    const dom = createDOMNode(vnode);
    const div = dom.querySelector('div');
    expect(div.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
  });

  it('className on SVG uses class attribute', () => {
    const vnode = h('svg', null, h('g', { className: 'group' }));
    const dom = createDOMNode(vnode);
    const g = dom.querySelector('g');
    expect(g.getAttribute('class')).toBe('group');
  });

  it('className removal on SVG uses removeAttribute', () => {
    const svg = document.createElementNS(SVG_NS, 'g');
    applyProps(svg, { className: 'old' }, {});
    expect(svg.hasAttribute('class')).toBe(false);
  });

  it('non-SVG elements remain HTML', () => {
    const vnode = h('div', null, h('span', null, 'hello'));
    const dom = createDOMNode(vnode);
    expect(dom.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
  });

  it('CREATE patch inside SVG parent uses SVG namespace', () => {
    const svgContainer = document.createElementNS(SVG_NS, 'svg');
    const vnode = h('circle', { cx: '10', cy: '10', r: '5' });
    applyPatches(svgContainer, [{ type: PATCH.CREATE, newVNode: vnode }]);
    const circle = svgContainer.querySelector('circle');
    expect(circle.namespaceURI).toBe(SVG_NS);
  });

  it('REPLACE patch inside SVG parent uses SVG namespace', () => {
    const svgContainer = document.createElementNS(SVG_NS, 'svg');
    const oldVNode = h('circle', { r: '5' });
    const oldDom = createDOMNode(oldVNode, SVG_NS);
    svgContainer.appendChild(oldDom);
    const newVNode = h('rect', { width: '10', height: '10' });
    applyPatches(svgContainer, [
      { type: PATCH.REPLACE, oldVNode, newVNode },
    ]);
    const rect = svgContainer.querySelector('rect');
    expect(rect.namespaceURI).toBe(SVG_NS);
  });

  it('event listeners work on SVG elements', () => {
    const handler = vi.fn();
    const vnode = h('svg', { onclick: handler }, h('circle', { r: '10' }));
    const dom = createDOMNode(vnode);
    dom.dispatchEvent(new MouseEvent('click'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('style works on SVG elements', () => {
    const vnode = h('svg', { style: { display: 'block' } });
    const dom = createDOMNode(vnode);
    expect(dom.style.display).toBe('block');
  });
});
