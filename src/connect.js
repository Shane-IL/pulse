import { scheduleUpdate } from './scheduler.js';

export const CONNECTED = Symbol('PULSE_CONNECTED');

export function connect(bindings) {
  return function wrapComponent(Component) {
    function ConnectedComponent(props) {
      const selectedProps = {};
      for (const propName in bindings) {
        const { store, selector } = bindings[propName];
        selectedProps[propName] = selector(store.getState());
      }
      return Component({ ...selectedProps, ...props });
    }

    ConnectedComponent[CONNECTED] = true;
    ConnectedComponent._bindings = bindings;
    ConnectedComponent._innerComponent = Component;
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
