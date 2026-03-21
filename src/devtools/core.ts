import { createStore } from '../store';
import { actionHistory } from '../middleware';
import type { Store } from '../store';
import type { ActionEntry, Middleware } from '../middleware';

export type DevtoolsEventType =
  | 'store-registered'
  | 'action-dispatched'
  | 'state-replaced'
  | 'component-mounted'
  | 'component-unmounted'
  | 'time-travel';

export interface DevtoolsEvent {
  type: DevtoolsEventType;
  storeName?: string;
  data?: any;
}

export interface TrackedStore {
  store: Store<any>;
  history: ActionEntry[];
  name: string;
}

export interface TrackedComponent {
  id: number;
  displayName: string;
  storeNames: string[];
}

type DevtoolsListener = (event: DevtoolsEvent) => void;

let nextComponentId = 1;

export class PulseDevtools {
  private stores = new Map<string, TrackedStore>();
  private components = new Map<number, TrackedComponent>();
  private listeners = new Set<DevtoolsListener>();

  registerStore(
    store: Store<any>,
    history: ActionEntry[],
    name?: string,
  ): void {
    const storeName = name || store.name || `store_${this.stores.size}`;
    this.stores.set(storeName, { store, history, name: storeName });

    // Subscribe to track dispatches in real-time
    store.subscribe(() => {
      this.emit({ type: 'action-dispatched', storeName });
    });

    this.emit({ type: 'store-registered', storeName });
  }

  getStoreNames(): string[] {
    return Array.from(this.stores.keys());
  }

  getStoreState(name: string): any {
    return this.stores.get(name)?.store.getState();
  }

  getTrackedStore(name: string): TrackedStore | undefined {
    return this.stores.get(name);
  }

  getHistory(name?: string): ActionEntry[] {
    if (name) {
      return this.stores.get(name)?.history ?? [];
    }
    // All histories merged, sorted by timestamp
    const all: ActionEntry[] = [];
    for (const tracked of this.stores.values()) {
      all.push(...tracked.history);
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  trackComponent(displayName: string, storeNames: string[]): number {
    const id = nextComponentId++;
    this.components.set(id, { id, displayName, storeNames });
    this.emit({
      type: 'component-mounted',
      data: { id, displayName, storeNames },
    });
    return id;
  }

  untrackComponent(id: number): void {
    const comp = this.components.get(id);
    if (comp) {
      this.components.delete(id);
      this.emit({
        type: 'component-unmounted',
        data: { id, displayName: comp.displayName },
      });
    }
  }

  getComponents(): TrackedComponent[] {
    return Array.from(this.components.values());
  }

  on(listener: DevtoolsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: DevtoolsEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

/**
 * Convenience: wraps createStore with actionHistory middleware and registers with devtools.
 */
export function instrumentStore<S>(
  devtools: PulseDevtools,
  config: {
    state: S;
    actions: Record<string, (state: S, payload?: any) => S>;
    name?: string;
    middleware?: Middleware<S>[];
  },
): { store: Store<S>; history: ActionEntry[] } {
  const history: ActionEntry[] = [];
  const historyMw = actionHistory(history) as Middleware<S>;

  const store = createStore<S>({
    ...config,
    middleware: [historyMw, ...(config.middleware || [])],
  });

  devtools.registerStore(store, history, config.name);

  return { store, history };
}
