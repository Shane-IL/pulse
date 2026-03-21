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
