import { __setComponentHooks, ComponentInstance } from '../connect';
import { PulseDevtools } from './core';
import { createPanel } from './panel/panel';

// Singleton devtools instance
const devtools = new PulseDevtools();

// Stores that belong to the devtools panel itself (excluded from tracking)
const internalStores = new WeakSet<any>();

export function _markInternalStore(store: any): void {
  internalStores.add(store);
}

// Wire component tracking hooks
__setComponentHooks(
  (instance: ComponentInstance) => {
    const bindings = (instance.connectedFn as any)._bindings || {};
    const boundStores = Object.values(bindings).map((b: any) => b.store);

    // Skip components only bound to internal (panel) stores
    if (
      boundStores.length > 0 &&
      boundStores.every((s) => internalStores.has(s))
    ) {
      return;
    }

    const storeNames = boundStores.map((s) => s.name || 'unnamed');
    const displayName = (instance.connectedFn as any).displayName || 'Unknown';
    const id = devtools.trackComponent(displayName, storeNames);
    (instance as any)._devtoolsId = id;
  },
  (instance: ComponentInstance) => {
    const id = (instance as any)._devtoolsId;
    if (id != null) {
      devtools.untrackComponent(id);
    }
  },
);

// Panel (lazy — only created when opened)
let panel: ReturnType<typeof createPanel> | null = null;

function ensurePanel() {
  if (!panel) {
    panel = createPanel(devtools, _markInternalStore);
  }
  return panel;
}

export function openPanel(): void {
  ensurePanel().openPanel();
}

export function closePanel(): void {
  if (panel) panel.closePanel();
}

export function togglePanel(): void {
  ensurePanel().togglePanel();
}

// Keyboard shortcut: Ctrl+Shift+P
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      togglePanel();
    }
  });

  // Expose on window for console access
  (window as any).__PULSE_DEVTOOLS__ = devtools;
}

// Re-exports
export { PulseDevtools, instrumentStore } from './core';
export { travelTo, replayFrom } from './time-travel';
export { devtools };
