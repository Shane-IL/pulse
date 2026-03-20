import { diff, PATCH } from './diff';
import { createDOMNode, applyPatches } from './patch';
import { CONNECTED, ComponentInstance } from './connect';
import { TEXT_NODE, FRAGMENT } from './vnode';
import type { VNode, Lifecycle } from './vnode';
import type { Patch } from './diff';

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

        if (expanded) {
          expanded._instance = instance;
          instance.lastVTree = expanded;
        }

        return expanded;
      } catch (error) {
        if (lifecycle?.onError) {
          const fallbackVNode = lifecycle.onError({ error, props: vnode.props });
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
      .map(child => expand(child, parentDom))
      .filter((c): c is VNode => c != null);
  }

  return vnode;
}

function reRenderInstance(instance: ComponentInstance, parentDom: Node): void {
  const connectedFn = instance.connectedFn;
  const lifecycle: Lifecycle | undefined = (connectedFn as any)._lifecycle;

  try {
    const newVNode = connectedFn(instance.props);
    const newExpanded = expand(newVNode, parentDom);

    if (instance.lastVTree && newExpanded) {
      const patches = diff(instance.lastVTree, newExpanded);

      // Find the actual parent DOM node to patch against
      const domParent = instance.lastVTree._dom?.parentNode || parentDom;
      applyPatches(domParent, patches);

      // Unmount child instances in removed/replaced subtrees
      // (skip our own instance — it drives this re-render and must stay alive)
      for (const patch of patches) {
        if (patch.type === PATCH.REMOVE) {
          unmountSubtree(patch.target, instance);
        } else if (patch.type === PATCH.REPLACE) {
          unmountSubtree(patch.oldVNode, instance);
        }
      }

      // Transfer the _dom reference from old to new
      if (!newExpanded._dom) {
        newExpanded._dom = instance.lastVTree._dom;
      }
    }

    if (newExpanded) {
      newExpanded._instance = instance;
    }
    instance.lastVTree = newExpanded;

    // Lifecycle: onUpdate fires after every re-render (not on initial mount)
    if (lifecycle?.onUpdate) {
      lifecycle.onUpdate({
        dom: newExpanded?._dom,
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
        const patches = diff(instance.lastVTree, fallbackExpanded);
        const domParent = instance.lastVTree._dom?.parentNode || parentDom;
        applyPatches(domParent, patches);

        // Unmount child instances but skip our own — it stays subscribed for recovery
        for (const patch of patches) {
          if (patch.type === PATCH.REMOVE) {
            unmountSubtree(patch.target, instance);
          } else if (patch.type === PATCH.REPLACE) {
            unmountSubtree(patch.oldVNode, instance);
          }
        }

        if (!fallbackExpanded._dom) {
          fallbackExpanded._dom = instance.lastVTree._dom;
        }
      }

      instance.lastVTree = fallbackExpanded;
      instance.updateSelected();
    } else {
      throw error;
    }
  }
}

function unmountSubtree(vnode: VNode | null, skip?: ComponentInstance): void {
  if (!vnode) return;
  if (vnode._instance && vnode._instance !== skip) vnode._instance.unmount();
  if (vnode.children) {
    for (const child of vnode.children) {
      unmountSubtree(child, skip);
    }
  }
}

function collectInstances(vnode: VNode | null, result: ComponentInstance[]): void {
  if (!vnode) return;
  if (vnode._instance) result.push(vnode._instance);
  if (vnode.children) {
    for (const child of vnode.children) {
      collectInstances(child, result);
    }
  }
}
