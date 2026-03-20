import { scheduleUpdate } from './scheduler.js';

export const CONNECTED = Symbol('PULSE_CONNECTED');

export function connect(bindings, lifecycle) {
  return function wrapComponent(Component) {
    const b = bindings || {};

    function ConnectedComponent(props) {
      const selectedProps = {};
      for (const propName in b) {
        const { store, selector } = b[propName];
        selectedProps[propName] = selector(store.getState());
      }
      return Component({ ...selectedProps, ...props });
    }

    ConnectedComponent[CONNECTED] = true;
    ConnectedComponent._bindings = b;
    ConnectedComponent._innerComponent = Component;
    if (lifecycle) ConnectedComponent._lifecycle = lifecycle;
    ConnectedComponent.displayName =
      `Connected(${Component.displayName || Component.name || 'Anonymous'})`;

    return ConnectedComponent;
  };
}

export class ComponentInstance {
  constructor(connectedFn, props) {
    this.connectedFn = connectedFn;
    this.props = props;
    this.prevSelected = {};
    this.unsubscribers = [];
    this.lastVTree = null;
    this.parentDom = null;
    this._renderCallback = null;
    this._mountCleanup = null;
  }

  mount(parentDom, renderCallback) {
    this.parentDom = parentDom;
    this._renderCallback = renderCallback;

    const bindings = this.connectedFn._bindings;

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
    const lifecycle = this.connectedFn._lifecycle;
    if (lifecycle?.onMount) {
      const cleanup = lifecycle.onMount({
        dom: this.lastVTree?._dom,
        props: this.props,
      });
      if (typeof cleanup === 'function') {
        this._mountCleanup = cleanup;
      }
    }
  }

  _onStoreChange() {
    const bindings = this.connectedFn._bindings;
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
      scheduleUpdate(this._renderCallback);
    }
  }

  updateSelected() {
    const bindings = this.connectedFn._bindings;
    for (const propName in bindings) {
      const { store, selector } = bindings[propName];
      this.prevSelected[propName] = selector(store.getState());
    }
  }

  unmount() {
    // Lifecycle: cleanup from onMount, then onDestroy
    if (this._mountCleanup) {
      this._mountCleanup();
      this._mountCleanup = null;
    }
    const lifecycle = this.connectedFn._lifecycle;
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

export function shallowEqual(a, b) {
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
