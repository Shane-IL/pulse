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

export interface Store<S> {
  readonly name?: string;
  getState(): S;
  dispatch(actionName: string, payload?: any): void;
  subscribe(listener: (state: S) => void): () => void;
  select<R>(selectorFn: (state: S) => R): SelectorBinding<S, R>;
}

export function createStore<S>(config: StoreConfig<S>): Store<S> {
  let state: S = config.state;
  const actions = config.actions;
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
    const action = actions[actionName];
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

    const action = actions[actionName];
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

  const dispatch = mw && mw.length > 0 ? dispatchWithMiddleware : dispatchSimple;

  function subscribe(listener: (state: S) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  function select<R>(selectorFn: (state: S) => R): SelectorBinding<S, R> {
    return { store: storeObj, selector: selectorFn };
  }

  const storeObj: Store<S> = {
    getState,
    dispatch,
    subscribe,
    select,
  };

  if (config.name) {
    (storeObj as any).name = config.name;
  }

  return storeObj;
}
