import { describe, it, expect, vi } from 'vitest';
import { createDOMNode, applyProps, applyPatches } from '../src/patch';
import { h } from '../src/createElement';
import { createTextVNode } from '../src/vnode';
import { PATCH } from '../src/diff';

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
    const vnode = h('div', null,
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
