import type { Store } from './store';

export interface DispatchContext<S = any> {
  store: Store<S>;
  actionName: string;
  payload: any;
  prevState: S;
  nextState: S | undefined;
}

export type Middleware<S = any> = (ctx: DispatchContext<S>, next: () => void) => void;

export interface ActionEntry {
  actionName: string;
  payload: any;
  prevState: any;
  nextState: any;
  timestamp: number;
}

/**
 * Logger middleware — logs action dispatches with prev/next state.
 */
export function logger(): Middleware {
  return (ctx, next) => {
    const label = `[pulse] ${ctx.actionName}`;
    console.group(label);
    console.log('prev state', ctx.prevState);
    console.log('payload', ctx.payload);
    next();
    console.log('next state', ctx.nextState);
    console.groupEnd();
  };
}

/**
 * Async action helper — wraps an async operation with loading/success/error dispatches.
 */
export interface AsyncActionConfig<S, R, A extends any[] = any[]> {
  start?: string;
  run: (...args: A) => Promise<R>;
  ok: string;
  fail?: string;
}

export function createAsyncAction<S, R, A extends any[] = any[]>(
  store: Store<S>,
  config: AsyncActionConfig<S, R, A>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    if (config.start) store.dispatch(config.start);
    try {
      const result = await config.run(...args);
      store.dispatch(config.ok, result);
      return result;
    } catch (e: any) {
      if (config.fail) {
        store.dispatch(config.fail, e?.message ?? String(e));
      } else {
        throw e;
      }
      return undefined as any;
    }
  };
}

/**
 * Action history middleware — pushes entries to a caller-owned array.
 */
export function actionHistory(
  history: ActionEntry[],
  opts?: { maxEntries?: number },
): Middleware {
  const max = opts?.maxEntries ?? Infinity;
  return (ctx, next) => {
    next();
    history.push({
      actionName: ctx.actionName,
      payload: ctx.payload,
      prevState: ctx.prevState,
      nextState: ctx.nextState ?? ctx.prevState,
      timestamp: Date.now(),
    });
    if (history.length > max) {
      history.splice(0, history.length - max);
    }
  };
}
