import { describe, it, expect } from 'vitest';
import { TEXT_NODE, FRAGMENT, createTextVNode, normalizeChild, flattenChildren } from '../src/vnode.js';

describe('createTextVNode', () => {
  it('creates a text vnode from a string', () => {
    const vnode = createTextVNode('hello');
    expect(vnode.type).toBe(TEXT_NODE);
    expect(vnode.props.nodeValue).toBe('hello');
    expect(vnode.children).toEqual([]);
    expect(vnode.key).toBeNull();
  });

  it('stringifies numbers', () => {
    const vnode = createTextVNode(42);
    expect(vnode.props.nodeValue).toBe('42');
  });
});

describe('normalizeChild', () => {
  it('returns null for null/undefined/boolean', () => {
    expect(normalizeChild(null)).toBeNull();
    expect(normalizeChild(undefined)).toBeNull();
    expect(normalizeChild(true)).toBeNull();
    expect(normalizeChild(false)).toBeNull();
  });

  it('wraps strings as text vnodes', () => {
    const result = normalizeChild('hello');
    expect(result.type).toBe(TEXT_NODE);
    expect(result.props.nodeValue).toBe('hello');
  });

  it('wraps numbers as text vnodes', () => {
    const result = normalizeChild(42);
    expect(result.type).toBe(TEXT_NODE);
    expect(result.props.nodeValue).toBe('42');
  });

  it('passes vnode objects through', () => {
    const vnode = { type: 'div', props: {}, children: [], key: null };
    expect(normalizeChild(vnode)).toBe(vnode);
  });
});

describe('flattenChildren', () => {
  it('flattens nested arrays', () => {
    const a = { type: 'span', props: {}, children: [], key: null };
    const b = { type: 'p', props: {}, children: [], key: null };
    const result = flattenChildren([[a, [b]]]);
    expect(result).toEqual([a, b]);
  });

  it('filters out null/undefined/boolean', () => {
    const result = flattenChildren([null, 'hello', false, undefined]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(TEXT_NODE);
    expect(result[0].props.nodeValue).toBe('hello');
  });

  it('converts strings and numbers to text vnodes', () => {
    const result = flattenChildren(['foo', 42]);
    expect(result).toHaveLength(2);
    expect(result[0].props.nodeValue).toBe('foo');
    expect(result[1].props.nodeValue).toBe('42');
  });

  it('returns empty array for empty input', () => {
    expect(flattenChildren([])).toEqual([]);
  });
});
