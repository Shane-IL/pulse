import { FRAGMENT, flattenChildren } from './vnode.js';

export function h(type, props, ...rawChildren) {
  props = props || {};
  const key = props.key ?? null;

  if (props.key !== undefined) {
    props = { ...props };
    delete props.key;
  }

  const children = flattenChildren(rawChildren);

  return { type, props, children, key };
}

export { FRAGMENT as Fragment };
