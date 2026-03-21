import type { PulseDevtools } from './core';

/**
 * Jump to a specific point in a store's action history.
 * Uses __devtools_replace__ to force-set the store's state.
 */
export function travelTo(
  devtools: PulseDevtools,
  storeName: string,
  entryIndex: number,
): void {
  const tracked = devtools.getTrackedStore(storeName);
  if (!tracked) {
    throw new Error(`[pulse-devtools] Unknown store: "${storeName}"`);
  }

  const { store, history } = tracked;

  if (entryIndex < 0 || entryIndex >= history.length) {
    throw new Error(
      `[pulse-devtools] Index ${entryIndex} out of range (0..${history.length - 1})`,
    );
  }

  const targetState = history[entryIndex].nextState;
  store.dispatch('__devtools_replace__', targetState);
  devtools.emit({ type: 'time-travel', storeName, data: { entryIndex } });
}

/**
 * Replay actions from a given index forward, starting from that entry's prevState.
 * Useful for re-executing the action chain after modifying an earlier action.
 */
export function replayFrom(
  devtools: PulseDevtools,
  storeName: string,
  fromIndex: number,
): void {
  const tracked = devtools.getTrackedStore(storeName);
  if (!tracked) {
    throw new Error(`[pulse-devtools] Unknown store: "${storeName}"`);
  }

  const { store, history } = tracked;

  if (fromIndex < 0 || fromIndex >= history.length) {
    throw new Error(
      `[pulse-devtools] Index ${fromIndex} out of range (0..${history.length - 1})`,
    );
  }

  // Snapshot the entries to replay before we start (dispatching adds new entries)
  const entriesToReplay = history.slice(fromIndex);

  // Reset to the state before the fromIndex action
  const baseState = history[fromIndex].prevState;
  store.dispatch('__devtools_replace__', baseState);

  // Replay each action
  for (const entry of entriesToReplay) {
    store.dispatch(entry.actionName, entry.payload);
  }

  devtools.emit({
    type: 'time-travel',
    storeName,
    data: { replayFrom: fromIndex },
  });
}
