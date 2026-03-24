/**
 * Structural-sharing proxy for immutable state updates.
 *
 * Usage:
 *   const next = produce(prev, draft => { draft.x.y = 42 });
 *
 * - Only objects along the mutation path are cloned (structural sharing).
 * - If nothing was mutated, returns the original reference (no-op).
 * - Arrays: push, pop, splice, sort, reverse, shift, unshift all work.
 */

const DRAFT = Symbol('pulse_draft');

interface DraftMeta {
  base: any;
  copy: any | null;
  modified: boolean;
  children: Map<string | symbol, DraftMeta>;
  parent: DraftMeta | null;
  prop: string | symbol | null;
}

function createDraftMeta(
  base: any,
  parent: DraftMeta | null,
  prop: string | symbol | null,
): DraftMeta {
  return {
    base,
    copy: null,
    modified: false,
    children: new Map(),
    parent,
    prop,
  };
}

function markChanged(meta: DraftMeta): void {
  if (meta.modified) return;
  meta.modified = true;
  if (meta.copy === null) {
    meta.copy = Array.isArray(meta.base)
      ? meta.base.slice()
      : Object.assign(Object.create(Object.getPrototypeOf(meta.base)), meta.base);
  }
  if (meta.parent) {
    markChanged(meta.parent);
    meta.parent.copy![meta.prop as any] = meta.copy;
  }
}

function latest(meta: DraftMeta): any {
  return meta.modified ? meta.copy : meta.base;
}

function createProxy(meta: DraftMeta): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop, receiver) {
      if (prop === DRAFT) return meta;

      const source = latest(meta);
      const value = Reflect.get(source, prop, receiver);

      // Only proxy plain objects and arrays, not built-ins
      if (
        value !== null &&
        typeof value === 'object' &&
        !meta.children.has(prop)
      ) {
        // Only proxy own enumerable properties (not prototype methods)
        const desc = Object.getOwnPropertyDescriptor(source, prop);
        if (desc && desc.enumerable) {
          const childMeta = createDraftMeta(value, meta, prop);
          meta.children.set(prop, childMeta);
          const childProxy = createProxy(childMeta);
          return childProxy;
        }
      }

      if (meta.children.has(prop)) {
        const childMeta = meta.children.get(prop)!;
        return createProxy(childMeta);
      }

      return value;
    },

    set(_target, prop, value) {
      const source = latest(meta);

      // Skip if same value
      if (Object.is(source[prop], value)) return true;

      // If setting a proxy, unwrap it to its finalized value
      if (value !== null && typeof value === 'object' && value[DRAFT]) {
        value = finalize(value[DRAFT]);
      }

      markChanged(meta);
      meta.copy![prop] = value;
      // Remove child draft if overwritten
      meta.children.delete(prop);
      return true;
    },

    deleteProperty(_target, prop) {
      markChanged(meta);
      delete meta.copy![prop];
      meta.children.delete(prop);
      return true;
    },

    has(_target, prop) {
      if (prop === DRAFT) return true;
      return prop in latest(meta);
    },

    ownKeys() {
      return Reflect.ownKeys(latest(meta));
    },

    getOwnPropertyDescriptor(_target, prop) {
      const source = latest(meta);
      const desc = Object.getOwnPropertyDescriptor(source, prop);
      if (desc) {
        // Proxy invariant: if the target property is non-configurable,
        // the trap must return a non-configurable descriptor too.
        // For other properties, mark configurable so the proxy stays flexible.
        const targetDesc = Object.getOwnPropertyDescriptor(target, prop);
        if (!targetDesc || targetDesc.configurable) {
          desc.configurable = true;
        }
      }
      return desc;
    },
  };

  // Use an array target for arrays so Array.isArray works on the proxy
  const target = Array.isArray(meta.base) ? [] : {};
  return new Proxy(target, handler);
}

function finalize(meta: DraftMeta): any {
  if (!meta.modified) return meta.base;

  // Finalize children
  for (const [prop, childMeta] of meta.children) {
    const finalChild = finalize(childMeta);
    if (finalChild !== childMeta.base) {
      if (!meta.copy) {
        meta.copy = Array.isArray(meta.base)
          ? meta.base.slice()
          : { ...meta.base };
      }
      meta.copy[prop as any] = finalChild;
    }
  }

  return meta.copy ?? meta.base;
}

export function produce<S extends object>(
  base: S,
  recipe: (draft: S) => void,
): S {
  const meta = createDraftMeta(base, null, null);
  const proxy = createProxy(meta);
  recipe(proxy);
  return finalize(meta) as S;
}

/**
 * Run an action that may either return new state or mutate a draft.
 * - If the action returns a non-undefined value → use that (classic style).
 * - If the action returns undefined → use the draft result (mutation style).
 * - If nothing changed in mutation style → returns original base (no-op).
 *
 * The action is called exactly once.
 */
export function produceAction<S extends object>(
  base: S,
  action: (state: S, payload?: any) => S | void,
  payload?: any,
): S {
  const meta = createDraftMeta(base, null, null);
  const proxy = createProxy(meta);
  const returned = action(proxy as S, payload);
  if (returned !== undefined && returned !== proxy) {
    // Classic return-style — use the returned value directly
    return returned as S;
  }
  // Mutation-style or void return — finalize the draft
  return finalize(meta) as S;
}
