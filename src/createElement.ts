import { FRAGMENT, flattenChildren } from './vnode';
import type { VNode, VNodeType } from './vnode';

export function h(
  type: VNodeType,
  props: Record<string, any> | null,
  ...rawChildren: any[]
): VNode {
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
