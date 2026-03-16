export function createStore({ state: initialState, actions }) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function dispatch(actionName, payload) {
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

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function select(selectorFn) {
    return { store: storeObj, selector: selectorFn };
  }

  const storeObj = { getState, dispatch, subscribe, select };
  return storeObj;
}
