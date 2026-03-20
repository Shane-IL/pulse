import { describe, it, expect } from 'vitest';
import { h, Fragment } from '../src/createElement';
import { TEXT_NODE, FRAGMENT } from '../src/vnode';

describe('h (createElement)', () => {
  it('creates an element vnode', () => {
    const vnode = h('div', null);
    expect(vnode.type).toBe('div');
    expect(vnode.props).toEqual({});
    expect(vnode.children).toEqual([]);
    expect(vnode.key).toBeNull();
  });

  it('preserves props', () => {
    const vnode = h('div', { className: 'foo', id: 'bar' });
    expect(vnode.props.className).toBe('foo');
    expect(vnode.props.id).toBe('bar');
  });

  it('extracts key from props', () => {
    const vnode = h('div', { key: 'k1', className: 'x' });
    expect(vnode.key).toBe('k1');
    expect(vnode.props.key).toBeUndefined();
    expect(vnode.props.className).toBe('x');
  });

  it('normalizes string children', () => {
    const vnode = h('div', null, 'hello');
    expect(vnode.children).toHaveLength(1);
    expect(vnode.children[0].type).toBe(TEXT_NODE);
    expect(vnode.children[0].props.nodeValue).toBe('hello');
  });

  it('handles multiple children', () => {
    const child = h('span', null);
    const vnode = h('div', null, child, 'text');
    expect(vnode.children).toHaveLength(2);
    expect(vnode.children[0]).toBe(child);
    expect(vnode.children[1].type).toBe(TEXT_NODE);
  });

  it('flattens array children', () => {
    const items = [h('li', { key: '1' }), h('li', { key: '2' })];
    const vnode = h('ul', null, items);
    expect(vnode.children).toHaveLength(2);
  });

  it('filters null/boolean children', () => {
    const vnode = h('div', null, null, false, 'keep', true);
    expect(vnode.children).toHaveLength(1);
    expect(vnode.children[0].props.nodeValue).toBe('keep');
  });

  it('creates fragment vnode', () => {
    const vnode = h(Fragment, null, h('span', null), h('p', null));
    expect(vnode.type).toBe(FRAGMENT);
    expect(vnode.children).toHaveLength(2);
  });

  it('handles function component type', () => {
    function MyComp() {}
    const vnode = h(MyComp, { count: 1 });
    expect(vnode.type).toBe(MyComp);
    expect(vnode.props.count).toBe(1);
  });
});
