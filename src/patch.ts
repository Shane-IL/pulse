import { TEXT_NODE, FRAGMENT } from './vnode';
import { PATCH } from './diff';
import type { VNode } from './vnode';
import type { Patch } from './diff';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createDOMNode(vnode: VNode, namespace?: string): Node {
  if (vnode.type === TEXT_NODE) {
    const textNode = document.createTextNode(vnode.props.nodeValue);
    vnode._dom = textNode;
    return textNode;
  }

  if (vnode.type === FRAGMENT) {
    const frag = document.createDocumentFragment();
    for (const child of vnode.children) {
      frag.appendChild(createDOMNode(child, namespace));
    }
    // For fragments, store ref to first child for positioning
    vnode._dom = frag;
    return frag;
  }

  // SVG namespace: 'svg' enters, 'foreignObject' exits back to HTML
  if (vnode.type === 'svg') {
    namespace = SVG_NS;
  } else if (vnode.type === 'foreignObject') {
    namespace = undefined;
  }

  const el = namespace
    ? document.createElementNS(namespace, vnode.type as string)
    : document.createElement(vnode.type as string);
  applyProps(el, {}, vnode.props);

  for (const child of vnode.children) {
    el.appendChild(createDOMNode(child, namespace));
  }

  vnode._dom = el;
  return el;
}

export function applyProps(
  el: Element,
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
  el: Element,
  key: string,
  value: any,
  oldValue: any,
): void {
  if (key.startsWith('on')) {
    const eventName = key.slice(2).toLowerCase();
    if (oldValue) el.removeEventListener(eventName, oldValue);
    if (value) el.addEventListener(eventName, value);
  } else if (key === 'className' || key === 'class') {
    // SVG className is an SVGAnimatedString — use setAttribute instead
    if (el instanceof SVGElement) {
      el.setAttribute('class', value || '');
    } else {
      (el as HTMLElement).className = value || '';
    }
  } else if (key === 'style' && typeof value === 'object') {
    if (typeof oldValue === 'object' && oldValue) {
      for (const prop in oldValue) {
        if (!(prop in value)) ((el as HTMLElement).style as any)[prop] = '';
      }
    }
    Object.assign((el as HTMLElement).style, value);
  } else if (key === 'dangerouslySetInnerHTML') {
    if (value && typeof value.__html === 'string') {
      el.innerHTML = value.__html;
    }
  } else if (key === 'ref') {
    if (typeof value === 'function') value(el);
  } else if (key in el && !(el instanceof SVGElement)) {
    // DOM property — set directly for properties like value, checked, selected
    try {
      (el as any)[key] = value ?? '';
    } catch {
      el.setAttribute(key, value);
    }
  } else if (value === true) {
    el.setAttribute(key, '');
  } else if (value === false || value == null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value);
  }
}

function removeProp(el: Element, key: string, oldValue: any): void {
  if (key.startsWith('on')) {
    el.removeEventListener(key.slice(2).toLowerCase(), oldValue);
  } else if (key === 'dangerouslySetInnerHTML') {
    el.innerHTML = '';
  } else if (key === 'className' || key === 'class') {
    if (el instanceof SVGElement) {
      el.removeAttribute('class');
    } else {
      (el as HTMLElement).className = '';
    }
  } else if (key in el && !(el instanceof SVGElement)) {
    try {
      (el as any)[key] = '';
    } catch {
      el.removeAttribute(key);
    }
  } else {
    el.removeAttribute(key);
  }
}

function inferNamespace(node: Node): string | undefined {
  return node instanceof SVGElement ? SVG_NS : undefined;
}

export function applyPatches(parentDom: Node, patches: Patch[]): void {
  for (const patch of patches) {
    switch (patch.type) {
      case PATCH.CREATE: {
        const dom = createDOMNode(patch.newVNode, inferNamespace(parentDom));
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
        const oldDom = patch.oldVNode._dom;
        const parent = oldDom?.parentNode;
        const newDom = createDOMNode(
          patch.newVNode,
          parent ? inferNamespace(parent) : undefined,
        );
        if (parent) {
          parent.replaceChild(newDom, oldDom!);
        }
        break;
      }

      case PATCH.UPDATE: {
        const dom = patch.target._dom as Element;
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
