import { scheduleUpdate } from './scheduler';
import type { VNode, Bindings, Lifecycle, ComponentFunction } from './vnode';

export const CONNECTED: unique symbol = Symbol('PULSE_CONNECTED');

// Pluggable devtools hooks — stored on globalThis so separate bundles
// (pulse core vs devtools) share the same hook storage.
interface ComponentHooks {
  onMount: ((instance: any) => void) | null;
  onUnmount: ((instance: any) => void) | null;
}

const G = globalThis as any;
if (!G.__PULSE_HOOKS__) {
  G.__PULSE_HOOKS__ = { onMount: null, onUnmount: null };
}
const hooks: ComponentHooks = G.__PULSE_HOOKS__;

export function __setComponentHooks(
  onMount: ((instance: ComponentInstance) => void) | null,
  onUnmount: ((instance: ComponentInstance) => void) | null,
): void {
  hooks.onMount = onMount;
  hooks.onUnmount = onUnmount;
}

export function connect(
  bindings: Bindings | null | undefined,
  lifecycle?: Lifecycle,
) {
  return function wrapComponent(Component: ComponentFunction) {
    const b = bindings || {};

    function ConnectedComponent(props: Record<string, any>): VNode | null {
      const selectedProps: Record<string, any> = {};
      for (const propName in b) {
        const { store, selector } = b[propName];
        selectedProps[propName] = selector(store.getState());
      }
      return Component({ ...selectedProps, ...props });
    }

    (ConnectedComponent as any)[CONNECTED] = true;
    (ConnectedComponent as any)._bindings = b;
    (ConnectedComponent as any)._innerComponent = Component;
    if (lifecycle) (ConnectedComponent as any)._lifecycle = lifecycle;
    ConnectedComponent.displayName =
      `Connected(${(Component as any).displayName || Component.name || 'Anonymous'})`;

    return ConnectedComponent;
  };
}

export class ComponentInstance {
  connectedFn: ComponentFunction;
  props: Record<string, any>;
  prevSelected: Record<string, any>;
  unsubscribers: (() => void)[];
  lastVTree: VNode | null;
  parentDom: Node | null;
  _renderCallback: (() => void) | null;
  _mountCleanup: (() => void) | null;

  constructor(connectedFn: ComponentFunction, props: Record<string, any>) {
    this.connectedFn = connectedFn;
    this.props = props;
    this.prevSelected = {};
    this.unsubscribers = [];
    this.lastVTree = null;
    this.parentDom = null;
    this._renderCallback = null;
    this._mountCleanup = null;
  }

  mount(parentDom: Node, renderCallback: () => void): void {
    this.parentDom = parentDom;
    this._renderCallback = renderCallback;

    const bindings: Bindings = (this.connectedFn as any)._bindings;

    for (const propName in bindings) {
      const { store, selector } = bindings[propName];
      this.prevSelected[propName] = selector(store.getState());
    }

    for (const propName in bindings) {
      const { store } = bindings[propName];
      const unsub = store.subscribe(() => {
        this._onStoreChange();
      });
      this.unsubscribers.push(unsub);
    }

    // Lifecycle: call onMount after subscriptions are live
    const lifecycle: Lifecycle | undefined = (this.connectedFn as any)._lifecycle;
    if (lifecycle?.onMount) {
      const cleanup = lifecycle.onMount({
        dom: this.lastVTree?._dom,
        props: this.props,
      });
      if (typeof cleanup === 'function') {
        this._mountCleanup = cleanup;
      }
    }

    // Devtools hook
    if (hooks.onMount) hooks.onMount(this);
  }

  _onStoreChange(): void {
    const bindings: Bindings = (this.connectedFn as any)._bindings;
    let changed = false;

    for (const propName in bindings) {
      const { store, selector } = bindings[propName];
      const newValue = selector(store.getState());
      if (!shallowEqual(newValue, this.prevSelected[propName])) {
        changed = true;
        break;
      }
    }

    if (changed) {
      scheduleUpdate(this._renderCallback!);
    }
  }

  updateSelected(): void {
    const bindings: Bindings = (this.connectedFn as any)._bindings;
    for (const propName in bindings) {
      const { store, selector } = bindings[propName];
      this.prevSelected[propName] = selector(store.getState());
    }
  }

  unmount(): void {
    // Devtools hook
    if (hooks.onUnmount) hooks.onUnmount(this);

    // Lifecycle: cleanup from onMount, then onDestroy
    if (this._mountCleanup) {
      this._mountCleanup();
      this._mountCleanup = null;
    }
    const lifecycle: Lifecycle | undefined = (this.connectedFn as any)._lifecycle;
    if (lifecycle?.onDestroy) {
      lifecycle.onDestroy({ props: this.props });
    }

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this._renderCallback = null;
  }
}

export function shallowEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}
