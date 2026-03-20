import type { ComponentInstance } from './connect';
import type { SelectorBinding } from './store';

export const TEXT_NODE: unique symbol = Symbol('TEXT_NODE');
export const FRAGMENT: unique symbol = Symbol('FRAGMENT');

export type VNodeType = string | typeof TEXT_NODE | typeof FRAGMENT | ComponentFunction;

export interface VNode {
  type: VNodeType;
  props: Record<string, any>;
  children: VNode[];
  key: string | number | null;
  _dom?: Node | null;
  _instance?: ComponentInstance | null;
}

export type ComponentFunction = (props: Record<string, any>) => VNode | null;

export interface Bindings {
  [propName: string]: SelectorBinding<any, any>;
}

export interface Lifecycle {
  onMount?: (ctx: { dom: Node | null | undefined; props: Record<string, any> }) => void | (() => void);
  onDestroy?: (ctx: { props: Record<string, any> }) => void;
}

export function createTextVNode(text: string | number): VNode {
  return {
    type: TEXT_NODE,
    props: { nodeValue: String(text) },
    children: [],
    key: null,
  };
}

export function normalizeChild(child: any): VNode | null {
  if (child == null || typeof child === 'boolean') return null;
  if (typeof child === 'string' || typeof child === 'number') {
    return createTextVNode(child);
  }
  return child as VNode;
}

export function flattenChildren(rawChildren: any[]): VNode[] {
  const result: VNode[] = [];
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
