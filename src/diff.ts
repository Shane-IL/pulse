import { TEXT_NODE } from './vnode';
import type { VNode } from './vnode';

export const PATCH = {
  CREATE:   'CREATE',
  REMOVE:   'REMOVE',
  REPLACE:  'REPLACE',
  UPDATE:   'UPDATE',
  TEXT:     'TEXT',
  MOVE:     'MOVE',
  CHILDREN: 'CHILDREN',
} as const;

export type PatchType = typeof PATCH[keyof typeof PATCH];

export interface PropPatches {
  set: Record<string, any>;
  remove: string[];
}

export type Patch =
  | { type: typeof PATCH.CREATE; newVNode: VNode; anchor?: VNode | null }
  | { type: typeof PATCH.REMOVE; target: VNode }
  | { type: typeof PATCH.REPLACE; oldVNode: VNode; newVNode: VNode }
  | { type: typeof PATCH.UPDATE; target: VNode; propPatches: PropPatches }
  | { type: typeof PATCH.TEXT; oldVNode: VNode; newVNode: VNode }
  | { type: typeof PATCH.MOVE; vnode: VNode; anchor: VNode | null; childPatches: Patch[] }
  | { type: typeof PATCH.CHILDREN; parent: VNode; childPatches: Patch[] };

export function diff(oldVNode: VNode | null, newVNode: VNode | null): Patch[] {
  if (newVNode == null && oldVNode == null) return [];
  if (newVNode == null) return [{ type: PATCH.REMOVE, target: oldVNode! }];
  if (oldVNode == null) return [{ type: PATCH.CREATE, newVNode }];

  if (oldVNode.type !== newVNode.type) {
    return [{ type: PATCH.REPLACE, oldVNode, newVNode }];
  }

  // Transfer _dom reference: the new vnode represents the same DOM node
  newVNode._dom = oldVNode._dom;

  if (oldVNode.type === TEXT_NODE) {
    if (oldVNode.props.nodeValue !== newVNode.props.nodeValue) {
      return [{ type: PATCH.TEXT, oldVNode, newVNode }];
    }
    return [];
  }

  const patches: Patch[] = [];

  const propPatches = diffProps(oldVNode.props, newVNode.props);
  if (propPatches) {
    patches.push({ type: PATCH.UPDATE, target: oldVNode, propPatches });
  }

  const childPatches = diffChildren(oldVNode.children, newVNode.children);
  if (childPatches.length) {
    patches.push({ type: PATCH.CHILDREN, parent: oldVNode, childPatches });
  }

  return patches;
}

function diffProps(
  oldProps: Record<string, any>,
  newProps: Record<string, any>,
): PropPatches | null {
  const set: Record<string, any> = {};
  const remove: string[] = [];
  let hasChanges = false;

  for (const key in newProps) {
    if (key === 'children') continue;
    if (oldProps[key] !== newProps[key]) {
      set[key] = newProps[key];
      hasChanges = true;
    }
  }

  for (const key in oldProps) {
    if (key === 'children') continue;
    if (!(key in newProps)) {
      remove.push(key);
      hasChanges = true;
    }
  }

  return hasChanges ? { set, remove } : null;
}

function sameVNode(a: VNode | null, b: VNode | null): boolean {
  if (a == null || b == null) return false;
  return a.type === b.type && a.key === b.key;
}

function warnChildKeys(children: (VNode | null)[], label: string): void {
  const seen = new Set<string | number>();
  let keyedCount = 0;
  let unkeyedCount = 0;

  for (const child of children) {
    if (child == null) continue;
    if (child.key != null) {
      keyedCount++;
      if (seen.has(child.key)) {
        console.warn(
          `[pulse] Duplicate key "${String(child.key)}" in ${label} children. ` +
          `Keys must be unique among siblings.`,
        );
      }
      seen.add(child.key);
    } else {
      unkeyedCount++;
    }
  }

  if (keyedCount > 0 && unkeyedCount > 0) {
    console.warn(
      `[pulse] Mixed keyed and unkeyed children in ${label} list ` +
      `(${keyedCount} keyed, ${unkeyedCount} unkeyed). ` +
      `Either all children should have keys or none should.`,
    );
  }
}

function diffChildren(oldChildren: (VNode | null)[], newChildren: VNode[]): Patch[] {
  if (process.env.NODE_ENV !== 'production') {
    warnChildKeys(oldChildren, 'old');
    warnChildKeys(newChildren, 'new');
  }

  const patches: Patch[] = [];

  let oldStartIdx = 0;
  let oldEndIdx = oldChildren.length - 1;
  let newStartIdx = 0;
  let newEndIdx = newChildren.length - 1;

  let oldStartVNode = oldChildren[oldStartIdx];
  let oldEndVNode = oldChildren[oldEndIdx];
  let newStartVNode = newChildren[newStartIdx];
  let newEndVNode = newChildren[newEndIdx];

  // Phase 1: two-pointer scan
  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    if (oldStartVNode == null) {
      oldStartVNode = oldChildren[++oldStartIdx];
      continue;
    }
    if (oldEndVNode == null) {
      oldEndVNode = oldChildren[--oldEndIdx];
      continue;
    }

    if (sameVNode(oldStartVNode, newStartVNode)) {
      patches.push(...diff(oldStartVNode, newStartVNode));
      oldStartVNode = oldChildren[++oldStartIdx];
      newStartVNode = newChildren[++newStartIdx];
    } else if (sameVNode(oldEndVNode, newEndVNode)) {
      patches.push(...diff(oldEndVNode, newEndVNode));
      oldEndVNode = oldChildren[--oldEndIdx];
      newEndVNode = newChildren[--newEndIdx];
    } else if (sameVNode(oldStartVNode, newEndVNode)) {
      patches.push({
        type: PATCH.MOVE,
        vnode: oldStartVNode!,
        anchor: oldChildren[oldEndIdx + 1] || null,
        childPatches: diff(oldStartVNode, newEndVNode),
      });
      oldStartVNode = oldChildren[++oldStartIdx];
      newEndVNode = newChildren[--newEndIdx];
    } else if (sameVNode(oldEndVNode, newStartVNode)) {
      patches.push({
        type: PATCH.MOVE,
        vnode: oldEndVNode!,
        anchor: oldStartVNode,
        childPatches: diff(oldEndVNode, newStartVNode),
      });
      oldEndVNode = oldChildren[--oldEndIdx];
      newStartVNode = newChildren[++newStartIdx];
    } else {
      // Fall through to key-map phase
      break;
    }
  }

  // Phase 2: key-map fallback for remaining nodes
  if (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    const keyMap = new Map<string | number, number>();
    for (let i = oldStartIdx; i <= oldEndIdx; i++) {
      const key = oldChildren[i]?.key;
      if (key != null) keyMap.set(key, i);
    }

    while (newStartIdx <= newEndIdx) {
      newStartVNode = newChildren[newStartIdx];
      const oldIdx = newStartVNode.key != null
        ? keyMap.get(newStartVNode.key)
        : undefined;

      if (oldIdx !== undefined) {
        const matchedOld = oldChildren[oldIdx]!;
        patches.push({
          type: PATCH.MOVE,
          vnode: matchedOld,
          anchor: oldChildren[oldStartIdx] || null,
          childPatches: diff(matchedOld, newStartVNode),
        });
        oldChildren[oldIdx] = null;
        keyMap.delete(newStartVNode.key!);
      } else {
        patches.push({
          type: PATCH.CREATE,
          newVNode: newStartVNode,
          anchor: oldChildren[oldStartIdx] || null,
        });
      }
      newStartIdx++;
    }

    // Remove unconsumed old children
    for (let i = oldStartIdx; i <= oldEndIdx; i++) {
      if (oldChildren[i] != null) {
        patches.push({ type: PATCH.REMOVE, target: oldChildren[i]! });
      }
    }
  }

  // Phase 3: remaining creates or removes
  if (oldStartIdx > oldEndIdx) {
    const anchor = newChildren[newEndIdx + 1] || null;
    for (let i = newStartIdx; i <= newEndIdx; i++) {
      patches.push({ type: PATCH.CREATE, newVNode: newChildren[i], anchor });
    }
  } else if (newStartIdx > newEndIdx) {
    for (let i = oldStartIdx; i <= oldEndIdx; i++) {
      if (oldChildren[i] != null) {
        patches.push({ type: PATCH.REMOVE, target: oldChildren[i]! });
      }
    }
  }

  return patches;
}
