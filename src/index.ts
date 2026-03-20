export { h, h as createElement, Fragment } from './createElement';
export { createStore } from './store';
export { connect } from './connect';
export { render } from './render';
export { flushSync } from './scheduler';

// Re-export types for consumers
export type { VNode, ComponentFunction, Bindings, Lifecycle } from './vnode';
export type { Store, StoreConfig, StoreActions, SelectorBinding } from './store';
