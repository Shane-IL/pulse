/**
 * JSX Automatic Runtime for Pulse.
 *
 * Allows bundlers (Vite, esbuild, TypeScript, Babel) to auto-inject the
 * JSX factory so users never need `import { h } from '@shane_il/pulse'`.
 *
 * Configure with:
 *   "jsx": "react-jsx"
 *   "jsxImportSource": "@shane_il/pulse"
 */
import { FRAGMENT, flattenChildren } from './vnode';
import type { VNode, VNodeType } from './vnode';

export function jsx(
  type: VNodeType,
  props: Record<string, any> | null,
  key?: string | number | null,
): VNode {
  props = props || {};
  const resolvedKey = key ?? props.key ?? null;

  // Strip key and children from props — they're VNode metadata, not component props
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { children: rawChildren, key: _key, ...restProps } = props;

  const children =
    rawChildren != null
      ? flattenChildren(Array.isArray(rawChildren) ? rawChildren : [rawChildren])
      : [];

  return { type, props: restProps, children, key: resolvedKey };
}

// jsxs is identical — React separates them for static-children optimizations,
// but Pulse's VDOM doesn't need the distinction.
export { jsx as jsxs };

export { FRAGMENT as Fragment };
