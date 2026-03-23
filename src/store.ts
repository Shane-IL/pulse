import { shallowEqual } from './shallowEqual';
import type { Middleware, DispatchContext } from './middleware';

export interface StoreActions<S> {
  [actionName: string]: (state: S, payload?: any) => S;
}

export interface StoreConfig<S> {
  state: S;
  actions: StoreActions<S>;
  name?: string;
  middleware?: Middleware<S>[];
}

export interface SelectorBinding<S, R> {
  store: Store<S>;
  selector: (state: S) => R;
}

export interface ActionDispatchers {
  [name: string]: (payload?: any) => void;
}

export interface Store<S> {
  readonly name?: string;
  readonly actions: ActionDispatchers;
  getState(): S;
  dispatch(actionName: string, payload?: any): void;
  subscribe(listener: (state: S) => void): () => void;
  select<R>(selectorFn: (state: S) => R): SelectorBinding<S, R>;
  pick(
    ...keys: (string | string[])[]
  ): { [k: string]: SelectorBinding<S, any> };
  watch<R>(
    selector: (state: S) => R,
    callback: (value: R, prevValue: R) => void,
  ): () => void;
}

export function createStore<S>(config: StoreConfig<S>): Store<S> {
  let state: S = config.state;
  const actionDefs = config.actions;
  const listeners = new Set<(state: S) => void>();
  const mw = config.middleware;

  function getState(): S {
    return state;
  }

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  // Fast path: no middleware — same hot path as before
  function dispatchSimple(actionName: string, payload?: any): void {
    const action = actionDefs[actionName];
    if (!action) {
      throw new Error(`[pulse] Unknown action: "${actionName}"`);
    }
    const nextState = action(state, payload);
    if (nextState === state) return;
    state = nextState;
    notify();
  }

  // Middleware path: build onion chain per dispatch
  function dispatchWithMiddleware(actionName: string, payload?: any): void {
    // __devtools_replace__ is a reserved action for time-travel
    if (actionName === '__devtools_replace__') {
      state = payload as S;
      notify();
      return;
    }

    const action = actionDefs[actionName];
    if (!action) {
      throw new Error(`[pulse] Unknown action: "${actionName}"`);
    }

    const ctx: DispatchContext<S> = {
      store: storeObj,
      actionName,
      payload,
      prevState: state,
      nextState: undefined,
    };

    let idx = 0;
    function next(): void {
      if (idx < mw!.length) {
        const fn = mw![idx++];
        fn(ctx, next);
      } else {
        // Core action at the center of the onion
        const nextState = action(ctx.prevState, ctx.payload);
        ctx.nextState = nextState;
        if (nextState !== state) {
          state = nextState;
          notify();
        }
      }
    }

    next();
  }

  const dispatch =
    mw && mw.length > 0 ? dispatchWithMiddleware : dispatchSimple;

  function subscribe(listener: (state: S) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function select<R>(selectorFn: (state: S) => R): SelectorBinding<S, R> {
    return { store: storeObj, selector: selectorFn };
  }

  function pick(
    ...keysOrArray: (string | string[])[]
  ): { [k: string]: SelectorBinding<S, any> } {
    const keys: string[] = Array.isArray(keysOrArray[0])
      ? keysOrArray[0]
      : (keysOrArray as string[]);
    const result: { [k: string]: SelectorBinding<S, any> } = {};
    for (const key of keys) {
      result[key] = select((s: any) => s[key]);
    }
    return result;
  }

  function watch<R>(
    selectorFn: (state: S) => R,
    callback: (value: R, prevValue: R) => void,
  ): () => void {
    let prev = selectorFn(state);
    return subscribe(() => {
      const next = selectorFn(state);
      if (!shallowEqual(next, prev)) {
        const old = prev;
        prev = next;
        callback(next, old);
      }
    });
  }

  // Build action dispatchers: store.actions.increment(payload)
  const actionDispatchers: ActionDispatchers = {};
  for (const name of Object.keys(actionDefs)) {
    actionDispatchers[name] = (payload?: any) => dispatch(name, payload);
  }

  const storeObj: Store<S> = {
    getState,
    dispatch,
    subscribe,
    select,
    pick,
    watch,
    actions: actionDispatchers,
  };

  if (config.name) {
    (storeObj as any).name = config.name;
  }

  return storeObj;
}
