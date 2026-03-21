import { diff } from './diff';
import { createDOMNode, applyPatches } from './patch';
import { CONNECTED, ComponentInstance } from './connect';
import { createTextVNode } from './vnode';
import type { VNode, Lifecycle } from './vnode';

interface RootEntry {
  vTree: VNode;
}

const roots = new WeakMap<Node, RootEntry>();

export function render(vnode: VNode, container: Node): void {
  const prev = roots.get(container);

  if (!prev) {
    // First mount
    const expanded = expand(vnode, container);
    if (!expanded) return;

    const dom = createDOMNode(expanded);
    container.appendChild(dom);

    const instances: ComponentInstance[] = [];
    collectInstances(expanded, instances);
    for (const inst of instances) {
      inst.mount(container, () => reRenderInstance(inst, container));
    }

    roots.set(container, { vTree: expanded });
  } else {
    // Update
    const expanded = expand(vnode, container);

    const oldInstances: ComponentInstance[] = [];
    collectInstances(prev.vTree, oldInstances);

    const patches = diff(prev.vTree, expanded);
    applyPatches(container, patches);

    const newInstances: ComponentInstance[] = [];
    if (expanded) collectInstances(expanded, newInstances);

    // Unmount removed instances
    const newSet = new Set(newInstances);
    for (const inst of oldInstances) {
      if (!newSet.has(inst)) {
        inst.unmount();
      }
    }

    // Mount new instances
    const oldSet = new Set(oldInstances);
    for (const inst of newInstances) {
      if (!oldSet.has(inst)) {
        inst.mount(container, () => reRenderInstance(inst, container));
      }
    }

    roots.set(container, { vTree: expanded! });
  }
}

function expand(vnode: VNode | null, parentDom: Node): VNode | null {
  if (vnode == null) return null;

  if (typeof vnode.type === 'function') {
    if ((vnode.type as any)[CONNECTED]) {
      // Connected component — with error boundary support
      const lifecycle: Lifecycle | undefined = (vnode.type as any)._lifecycle;

      try {
        const instance = new ComponentInstance(vnode.type, vnode.props);
        const childVNode = vnode.type(vnode.props);
        const expanded = expand(childVNode, parentDom);

        // Use placeholder for null returns so instance stays in tree (subscribes)
        const result = expanded ?? createTextVNode('');

        if (result._instance) {
          // Nested connected component: wrap outer in a boundary element
          // so each instance has its own VNode (no _instance collision).
          const boundary: VNode = {
            type: 'div',
            props: { style: { display: 'contents' } },
            children: [result],
            key: vnode.key,
          };
          boundary._instance = instance;
          instance.lastVTree = boundary;
          return boundary;
        }

        result._instance = instance;
        instance.lastVTree = result;

        return result;
      } catch (error) {
        if (lifecycle?.onError) {
          const fallbackVNode = lifecycle.onError({
            error,
            props: vnode.props,
          });
          return expand(fallbackVNode, parentDom);
        }
        throw error;
      }
    }

    // Plain function component
    const childVNode = vnode.type({ ...vnode.props, children: vnode.children });
    return expand(childVNode, parentDom);
  }

  // Element, text, or fragment: recursively expand children
  if (vnode.children?.length) {
    vnode.children = vnode.children
      .map((child) => expand(child, parentDom))
      .filter((c): c is VNode => c != null);
  }

  return vnode;
}

function reRenderInstance(instance: ComponentInstance, parentDom: Node): void {
  // Guard: skip re-render if instance was unmounted (e.g. parent already rebuilt this subtree)
  if (!instance._renderCallback) return;

  const connectedFn = instance.connectedFn;
  const lifecycle: Lifecycle | undefined = (connectedFn as any)._lifecycle;

  try {
    const newVNode = connectedFn(instance.props);
    const rawExpanded = expand(newVNode, parentDom);

    // Use placeholder for null returns so instance stays in tree
    const innerContent = rawExpanded ?? createTextVNode('');

    // Wrap if nested connected component (same logic as expand)
    let newTree: VNode;
    if (innerContent._instance && innerContent._instance !== instance) {
      newTree = {
        type: 'div',
        props: { style: { display: 'contents' } },
        children: [innerContent],
        key: null,
      } as VNode;
      newTree._instance = instance;
    } else {
      innerContent._instance = instance;
      newTree = innerContent;
    }

    if (instance.lastVTree) {
      // Refresh stale inner instance references before diffing
      refreshInnerInstances(instance.lastVTree, instance);

      const patches = diff(instance.lastVTree, newTree);

      // Find the actual parent DOM node to patch against
      const domParent = instance.lastVTree._dom?.parentNode || parentDom;
      applyPatches(domParent, patches);

      // Transfer the _dom reference from old to new
      if (!newTree._dom) {
        newTree._dom = instance.lastVTree._dom;
      }
    }

    // Collect inner instances for lifecycle management
    const oldInner: ComponentInstance[] = [];
    collectInnerInstances(instance.lastVTree, oldInner, instance);
    const newInner: ComponentInstance[] = [];
    collectInnerInstances(newTree, newInner, instance);

    // Unmount removed inner instances
    const newInstSet = new Set(newInner);
    for (const inst of oldInner) {
      if (!newInstSet.has(inst)) inst.unmount();
    }

    instance.lastVTree = newTree;

    // Mount new inner instances
    const oldInstSet = new Set(oldInner);
    for (const inst of newInner) {
      if (!oldInstSet.has(inst)) {
        inst.mount(parentDom, () => reRenderInstance(inst, parentDom));
      }
    }

    // Lifecycle: onUpdate fires after every re-render (not on initial mount)
    if (lifecycle?.onUpdate) {
      lifecycle.onUpdate({
        dom: newTree?._dom,
        props: instance.props,
      });
    }

    instance.updateSelected();
  } catch (error) {
    if (lifecycle?.onError) {
      const fallbackVNode = lifecycle.onError({ error, props: instance.props });
      const fallbackExpanded = expand(fallbackVNode, parentDom);

      // Replace current DOM with fallback
      if (instance.lastVTree && fallbackExpanded) {
        refreshInnerInstances(instance.lastVTree, instance);

        const patches = diff(instance.lastVTree, fallbackExpanded);
        const domParent = instance.lastVTree._dom?.parentNode || parentDom;
        applyPatches(domParent, patches);

        if (!fallbackExpanded._dom) {
          fallbackExpanded._dom = instance.lastVTree._dom;
        }
      }

      // Unmount old inner instances on error fallback
      const oldInner: ComponentInstance[] = [];
      collectInnerInstances(instance.lastVTree, oldInner, instance);
      for (const inst of oldInner) inst.unmount();

      instance.lastVTree = fallbackExpanded;
      instance.updateSelected();
    } else {
      throw error;
    }
  }
}

/**
 * Before diffing a parent's lastVTree, refresh any inner connected components'
 * subtrees to reflect their current state (they may have re-rendered independently).
 */
function refreshInnerInstances(
  vnode: VNode | null,
  skip: ComponentInstance,
): void {
  if (!vnode || !vnode.children) return;
  for (let i = 0; i < vnode.children.length; i++) {
    const child = vnode.children[i];
    if (
      child._instance &&
      child._instance !== skip &&
      child._instance.lastVTree
    ) {
      // Replace stale reference with instance's current lastVTree
      if (child._instance.lastVTree !== child) {
        vnode.children[i] = child._instance.lastVTree;
      }
    }
    refreshInnerInstances(vnode.children[i], skip);
  }
}

function collectInstances(
  vnode: VNode | null,
  result: ComponentInstance[],
): void {
  if (!vnode) return;
  if (vnode._instance) result.push(vnode._instance);
  if (vnode.children) {
    for (const child of vnode.children) {
      collectInstances(child, result);
    }
  }
}

function collectInnerInstances(
  vnode: VNode | null,
  result: ComponentInstance[],
  skip: ComponentInstance,
): void {
  if (!vnode) return;
  if (vnode._instance && vnode._instance !== skip) result.push(vnode._instance);
  if (vnode.children) {
    for (const child of vnode.children) {
      collectInnerInstances(child, result, skip);
    }
  }
}
