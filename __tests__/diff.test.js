import { describe, it, expect, vi } from 'vitest';
import { diff, PATCH } from '../src/diff';
import { h } from '../src/createElement';
import { createTextVNode } from '../src/vnode';

/** Recursively collect all patches of a given type, including inside CHILDREN. */
function collectPatches(patches, type) {
  const result = [];
  for (const p of patches) {
    if (p.type === type) result.push(p);
    if (p.type === PATCH.CHILDREN)
      result.push(...collectPatches(p.childPatches, type));
  }
  return result;
}

describe('diff', () => {
  it('null -> vnode produces CREATE', () => {
    const vnode = h('div', null);
    const patches = diff(null, vnode);
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe(PATCH.CREATE);
    expect(patches[0].newVNode).toBe(vnode);
  });

  it('vnode -> null produces REMOVE', () => {
    const vnode = h('div', null);
    const patches = diff(vnode, null);
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe(PATCH.REMOVE);
  });

  it('different types produce REPLACE', () => {
    const old = h('div', null);
    const next = h('span', null);
    const patches = diff(old, next);
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe(PATCH.REPLACE);
  });

  it('same type, different props produce UPDATE', () => {
    const old = h('div', { className: 'a' });
    const next = h('div', { className: 'b' });
    const patches = diff(old, next);
    expect(patches.some((p) => p.type === PATCH.UPDATE)).toBe(true);
  });

  it('identical vnodes produce no patches', () => {
    const old = h('div', { className: 'a' });
    const next = h('div', { className: 'a' });
    const patches = diff(old, next);
    expect(patches).toHaveLength(0);
  });

  it('text node change produces TEXT patch', () => {
    const old = createTextVNode('hello');
    const next = createTextVNode('world');
    const patches = diff(old, next);
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe(PATCH.TEXT);
  });

  it('identical text produces no patches', () => {
    const old = createTextVNode('same');
    const next = createTextVNode('same');
    expect(diff(old, next)).toHaveLength(0);
  });

  it('both null produces no patches', () => {
    expect(diff(null, null)).toHaveLength(0);
  });
});

describe('diff children', () => {
  it('append: [a,b] -> [a,b,c]', () => {
    const old = h(
      'div',
      null,
      h('span', { key: 'a' }),
      h('span', { key: 'b' }),
    );
    const next = h(
      'div',
      null,
      h('span', { key: 'a' }),
      h('span', { key: 'b' }),
      h('span', { key: 'c' }),
    );
    const patches = diff(old, next);
    const creates = collectPatches(patches, PATCH.CREATE);
    expect(creates).toHaveLength(1);
  });

  it('remove from end: [a,b,c] -> [a,b]', () => {
    const a = h('span', { key: 'a' });
    const b = h('span', { key: 'b' });
    const c = h('span', { key: 'c' });
    const old = h('div', null, a, b, c);
    const next = h(
      'div',
      null,
      h('span', { key: 'a' }),
      h('span', { key: 'b' }),
    );
    const patches = diff(old, next);
    const removes = collectPatches(patches, PATCH.REMOVE);
    expect(removes).toHaveLength(1);
  });

  it('empty -> populated', () => {
    const old = h('div', null);
    const next = h('div', null, h('span', null), h('p', null));
    const patches = diff(old, next);
    const creates = collectPatches(patches, PATCH.CREATE);
    expect(creates).toHaveLength(2);
  });

  it('populated -> empty', () => {
    const old = h('div', null, h('span', null), h('p', null));
    const next = h('div', null);
    const patches = diff(old, next);
    const removes = collectPatches(patches, PATCH.REMOVE);
    expect(removes).toHaveLength(2);
  });

  it('keyed swap produces MOVE patches', () => {
    const old = h(
      'div',
      null,
      h('span', { key: 'a' }),
      h('span', { key: 'b' }),
    );
    const next = h(
      'div',
      null,
      h('span', { key: 'b' }),
      h('span', { key: 'a' }),
    );
    const patches = diff(old, next);
    const moves = collectPatches(patches, PATCH.MOVE);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('keyed remove middle', () => {
    const old = h(
      'div',
      null,
      h('span', { key: '1' }),
      h('span', { key: '2' }),
      h('span', { key: '3' }),
    );
    const next = h(
      'div',
      null,
      h('span', { key: '1' }),
      h('span', { key: '3' }),
    );
    const patches = diff(old, next);
    const removes = collectPatches(patches, PATCH.REMOVE);
    expect(removes).toHaveLength(1);
  });
});

describe('child key warnings', () => {
  it('warns on duplicate keys in new children', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = h('div', null);
    const next = h(
      'div',
      null,
      h('span', { key: 'a' }),
      h('span', { key: 'a' }),
    );
    diff(old, next);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate key "a"'),
    );
    spy.mockRestore();
  });

  it('warns on duplicate keys in old children', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = h(
      'div',
      null,
      h('span', { key: 'x' }),
      h('span', { key: 'x' }),
    );
    const next = h('div', null, h('span', { key: 'x' }));
    diff(old, next);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate key "x"'),
    );
    spy.mockRestore();
  });

  it('warns on mixed keyed and unkeyed children', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = h('div', null);
    const next = h('div', null, h('span', { key: 'a' }), h('span', null));
    diff(old, next);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Mixed keyed and unkeyed'),
    );
    spy.mockRestore();
  });

  it('does not warn when all children are keyed', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = h('div', null, h('span', { key: 'a' }));
    const next = h(
      'div',
      null,
      h('span', { key: 'a' }),
      h('span', { key: 'b' }),
    );
    diff(old, next);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not warn when all children are unkeyed', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const old = h('div', null, h('span', null));
    const next = h('div', null, h('span', null), h('p', null));
    diff(old, next);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not warn for empty children', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    diff(h('div', null), h('div', null));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('handles numeric key 0 correctly (not treated as null)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const next = h('div', null, h('span', { key: 0 }), h('span', { key: 1 }));
    diff(h('div', null), next);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
