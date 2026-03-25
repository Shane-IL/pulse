import { describe, it, expect } from 'vitest';
import { jsx, jsxs, Fragment } from '../src/jsx-runtime';
import { TEXT_NODE, FRAGMENT } from '../src/vnode';

describe('jsx-runtime', () => {
  it('creates an element vnode', () => {
    const vnode = jsx('div', {});
    expect(vnode.type).toBe('div');
    expect(vnode.props).toEqual({});
    expect(vnode.children).toEqual([]);
    expect(vnode.key).toBeNull();
  });

  it('preserves props and strips children/key', () => {
    const vnode = jsx('div', { className: 'foo', key: 'k1', children: 'hi' }, 'k1');
    expect(vnode.key).toBe('k1');
    expect(vnode.props.className).toBe('foo');
    expect(vnode.props.key).toBeUndefined();
    expect(vnode.props.children).toBeUndefined();
  });

  it('uses third argument as key over props.key', () => {
    const vnode = jsx('div', { key: 'from-props' }, 'from-arg');
    expect(vnode.key).toBe('from-arg');
  });

  it('falls back to props.key when no third argument', () => {
    const vnode = jsx('div', { key: 'k2' });
    expect(vnode.key).toBe('k2');
  });

  it('normalizes a single string child', () => {
    const vnode = jsx('p', { children: 'hello' });
    expect(vnode.children).toHaveLength(1);
    expect(vnode.children[0].type).toBe(TEXT_NODE);
    expect(vnode.children[0].props.nodeValue).toBe('hello');
  });

  it('normalizes an array of children (jsxs)', () => {
    const span = jsx('span', {});
    const vnode = jsxs('div', { children: [span, 'text'] });
    expect(vnode.children).toHaveLength(2);
    expect(vnode.children[0]).toBe(span);
    expect(vnode.children[1].type).toBe(TEXT_NODE);
  });

  it('filters null/boolean children', () => {
    const vnode = jsxs('div', { children: [null, false, 'keep', true] });
    expect(vnode.children).toHaveLength(1);
    expect(vnode.children[0].props.nodeValue).toBe('keep');
  });

  it('handles no children', () => {
    const vnode = jsx('br', {});
    expect(vnode.children).toEqual([]);
  });

  it('exports Fragment as FRAGMENT symbol', () => {
    expect(Fragment).toBe(FRAGMENT);
  });

  it('creates fragment with children', () => {
    const vnode = jsxs(Fragment, { children: [jsx('a', {}), jsx('b', {})] });
    expect(vnode.type).toBe(FRAGMENT);
    expect(vnode.children).toHaveLength(2);
  });

  it('handles function component type', () => {
    function MyComp() {}
    const vnode = jsx(MyComp, { count: 1 });
    expect(vnode.type).toBe(MyComp);
    expect(vnode.props.count).toBe(1);
  });
});
