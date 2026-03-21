import { TEXT_NODE, FRAGMENT } from './vnode';
import { PATCH } from './diff';
import type { VNode } from './vnode';
import type { Patch } from './diff';

export function createDOMNode(vnode: VNode): Node {
  if (vnode.type === TEXT_NODE) {
    const textNode = document.createTextNode(vnode.props.nodeValue);
    vnode._dom = textNode;
    return textNode;
  }

  if (vnode.type === FRAGMENT) {
    const frag = document.createDocumentFragment();
    for (const child of vnode.children) {
      frag.appendChild(createDOMNode(child));
    }
    // For fragments, store ref to first child for positioning
    vnode._dom = frag;
    return frag;
  }

  const el = document.createElement(vnode.type as string);
  applyProps(el, {}, vnode.props);

  for (const child of vnode.children) {
    el.appendChild(createDOMNode(child));
  }

  vnode._dom = el;
  return el;
}

export function applyProps(
  el: HTMLElement,
  oldProps: Record<string, any>,
  newProps: Record<string, any>,
): void {
  for (const key in oldProps) {
    if (key === 'children' || key === 'key') continue;
    if (!(key in newProps)) {
      removeProp(el, key, oldProps[key]);
    }
  }
  for (const key in newProps) {
    if (key === 'children' || key === 'key') continue;
    if (oldProps[key] !== newProps[key]) {
      setProp(el, key, newProps[key], oldProps[key]);
    }
  }
}

function setProp(
  el: HTMLElement,
  key: string,
  value: any,
  oldValue: any,
): void {
  if (key.startsWith('on')) {
    const eventName = key.slice(2).toLowerCase();
    if (oldValue) el.removeEventListener(eventName, oldValue);
    if (value) el.addEventListener(eventName, value);
  } else if (key === 'className') {
    el.className = value || '';
  } else if (key === 'style' && typeof value === 'object') {
    if (typeof oldValue === 'object' && oldValue) {
      for (const prop in oldValue) {
        if (!(prop in value)) (el.style as any)[prop] = '';
      }
    }
    Object.assign(el.style, value);
  } else if (key === 'ref') {
    if (typeof value === 'function') value(el);
  } else if (value === true) {
    el.setAttribute(key, '');
  } else if (value === false || value == null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

function removeProp(el: HTMLElement, key: string, oldValue: any): void {
  if (key.startsWith('on')) {
    el.removeEventListener(key.slice(2).toLowerCase(), oldValue);
  } else if (key === 'className') {
    el.className = '';
  } else {
    el.removeAttribute(key);
  }
}

export function applyPatches(parentDom: Node, patches: Patch[]): void {
  for (const patch of patches) {
    switch (patch.type) {
      case PATCH.CREATE: {
        const dom = createDOMNode(patch.newVNode);
        if (patch.anchor?._dom) {
          parentDom.insertBefore(dom, patch.anchor._dom);
        } else {
          parentDom.appendChild(dom);
        }
        break;
      }

      case PATCH.REMOVE: {
        const dom = patch.target._dom;
        if (dom?.parentNode) {
          dom.parentNode.removeChild(dom);
        }
        break;
      }

      case PATCH.REPLACE: {
        const newDom = createDOMNode(patch.newVNode);
        const oldDom = patch.oldVNode._dom;
        if (oldDom?.parentNode) {
          oldDom.parentNode.replaceChild(newDom, oldDom);
        }
        break;
      }

      case PATCH.UPDATE: {
        const dom = patch.target._dom as HTMLElement;
        const { set, remove } = patch.propPatches;
        for (const key of remove) {
          removeProp(dom, key, patch.target.props[key]);
        }
        for (const key in set) {
          setProp(dom, key, set[key], patch.target.props[key]);
        }
        break;
      }

      case PATCH.TEXT: {
        const dom = patch.oldVNode._dom;
        if (dom) dom.nodeValue = patch.newVNode.props.nodeValue;
        break;
      }

      case PATCH.MOVE: {
        const dom = patch.vnode._dom;
        if (dom) {
          if (patch.anchor?._dom) {
            parentDom.insertBefore(dom, patch.anchor._dom);
          } else {
            parentDom.appendChild(dom);
          }
        }
        if (patch.childPatches?.length && dom) {
          applyPatches(dom, patch.childPatches);
        }
        break;
      }

      case PATCH.CHILDREN: {
        const dom = patch.parent._dom;
        if (dom && patch.childPatches.length) {
          applyPatches(dom, patch.childPatches);
        }
        break;
      }
    }
  }
}
