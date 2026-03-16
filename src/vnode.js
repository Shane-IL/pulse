export const TEXT_NODE = Symbol('TEXT_NODE');
export const FRAGMENT = Symbol('FRAGMENT');

export function createTextVNode(text) {
  return {
    type: TEXT_NODE,
    props: { nodeValue: String(text) },
    children: [],
    key: null,
  };
}

export function normalizeChild(child) {
  if (child == null || typeof child === 'boolean') return null;
  if (typeof child === 'string' || typeof child === 'number') {
    return createTextVNode(child);
  }
  return child;
}

export function flattenChildren(rawChildren) {
  const result = [];
  for (const child of rawChildren) {
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else {
      const normalized = normalizeChild(child);
      if (normalized !== null) result.push(normalized);
    }
  }
  return result;
}
