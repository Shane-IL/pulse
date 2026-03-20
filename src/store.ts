export interface StoreActions<S> {
  [actionName: string]: (state: S, payload?: any) => S;
}

export interface StoreConfig<S> {
  state: S;
  actions: StoreActions<S>;
}

export interface SelectorBinding<S, R> {
  store: Store<S>;
  selector: (state: S) => R;
}

export interface Store<S> {
  getState(): S;
  dispatch(actionName: string, payload?: any): void;
  subscribe(listener: (state: S) => void): () => void;
  select<R>(selectorFn: (state: S) => R): SelectorBinding<S, R>;
}

export function createStore<S>(config: StoreConfig<S>): Store<S> {
  let state: S = config.state;
  const actions = config.actions;
  const listeners = new Set<(state: S) => void>();

  function getState(): S {
    return state;
  }

  function dispatch(actionName: string, payload?: any): void {
    const action = actions[actionName];
    if (!action) {
      throw new Error(`[pulse] Unknown action: "${actionName}"`);
    }
    const nextState = action(state, payload);
    if (nextState === state) return;
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
  }

  function subscribe(listener: (state: S) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  function select<R>(selectorFn: (state: S) => R): SelectorBinding<S, R> {
    return { store: storeObj, selector: selectorFn };
  }

  const storeObj: Store<S> = { getState, dispatch, subscribe, select };
  return storeObj;
}
