export { h, h as createElement, Fragment } from './createElement';
export { createStore } from './store';
export { connect } from './connect';
export { render } from './render';
export { flushSync } from './scheduler';
export { createRouter } from './router';
export { logger, actionHistory, createAsyncAction } from './middleware';

// Re-export types for consumers
export type {
  VNode,
  ComponentFunction,
  Bindings,
  Lifecycle,
  LocalStoreConfig,
} from './vnode';
export type {
  Store,
  StoreConfig,
  StoreActions,
  SelectorBinding,
  ActionDispatchers,
} from './store';
export type { RouteState, RouteConfig, RouterOptions, Router } from './router';
export type {
  Middleware,
  DispatchContext,
  ActionEntry,
  AsyncActionConfig,
} from './middleware';
