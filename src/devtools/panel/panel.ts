import { h } from '../../createElement';
import { createStore } from '../../store';
import { connect } from '../../connect';
import { render } from '../../render';
import type { VNode } from '../../vnode';
import type { PulseDevtools } from '../core';
import type { ActionEntry } from '../../middleware';
import { travelTo } from '../time-travel';
import { StoresTab } from './stores-tab';
import { ActionsTab } from './actions-tab';
import { ComponentsTab } from './components-tab';
import * as s from './styles';

// --- Internal panel store (no devtools middleware on itself) ---

interface PanelState {
  open: boolean;
  activeTab: 'stores' | 'actions' | 'components';
  selectedStore: string | null;
  timeTravelIndex: number;
  storeNames: string[];
  storeStates: Record<string, any>;
  actionLog: ActionEntry[];
  filter: string;
  components: { id: number; displayName: string; storeNames: string[] }[];
}

function createPanelStore() {
  return createStore<PanelState>({
    state: {
      open: false,
      activeTab: 'stores',
      selectedStore: null,
      timeTravelIndex: -1,
      storeNames: [],
      storeStates: {},
      actionLog: [],
      filter: '',
      components: [],
    },
    actions: {
      toggle: (state) => ({ ...state, open: !state.open }),
      open: (state) => ({ ...state, open: true }),
      close: (state) => ({ ...state, open: false }),
      setTab: (state, tab) => ({ ...state, activeTab: tab }),
      selectStore: (state, name) => ({ ...state, selectedStore: name }),
      setFilter: (state, filter) => ({ ...state, filter }),
      setTimeTravelIndex: (state, index) => ({
        ...state,
        timeTravelIndex: index,
      }),
      sync: (state, data) => ({ ...state, ...data }),
    },
  });
}

// --- Panel root component ---

function PanelRootView({
  open,
  activeTab,
  selectedStore,
  timeTravelIndex,
  storeNames,
  storeStates,
  actionLog,
  filter,
  components,
  panelActions,
}: PanelState & { panelActions: any }): VNode | null {
  if (!open) return null;

  const tabs: Array<{ id: PanelState['activeTab']; label: string }> = [
    { id: 'stores', label: 'Stores' },
    { id: 'actions', label: 'Actions' },
    { id: 'components', label: 'Components' },
  ];

  let tabContent: VNode;
  if (activeTab === 'stores') {
    tabContent = StoresTab({
      storeNames,
      selectedStore,
      storeStates,
      onSelectStore: panelActions.selectStore,
    });
  } else if (activeTab === 'actions') {
    tabContent = ActionsTab({
      actionLog,
      timeTravelIndex,
      filter,
      onFilterChange: panelActions.setFilter,
      onTravelTo: panelActions.travelTo,
      onSliderChange: panelActions.sliderChange,
    });
  } else {
    tabContent = ComponentsTab({ components });
  }

  return h(
    'div',
    { style: s.panelRoot },
    // Tab bar (all children keyed to avoid mixed key warnings)
    h(
      'div',
      { style: s.tabBar },
      h('span', { key: 'title', style: s.title }, 'Pulse'),
      ...tabs.map((tab) =>
        h(
          'button',
          {
            key: tab.id,
            style: s.tabButton(tab.id === activeTab),
            onClick: () => panelActions.setTab(tab.id),
          },
          tab.label,
        ),
      ),
      h(
        'span',
        { key: 'badge', style: s.badge },
        `${storeNames.length} stores`,
      ),
      h(
        'button',
        {
          key: 'close',
          style: s.closeButton,
          onClick: panelActions.close,
        },
        '\u00d7',
      ),
    ),
    // Content
    h('div', { style: s.tabContent }, tabContent),
  );
}

// --- Wire everything up ---

export function createPanel(
  devtools: PulseDevtools,
  markInternal?: (store: any) => void,
) {
  const panelStore = createPanelStore();
  if (markInternal) markInternal(panelStore);

  // Sync devtools state into panel store (with re-entrancy guard)
  let syncing = false;
  function syncState() {
    if (syncing) return;
    syncing = true;
    try {
      const storeNames = devtools.getStoreNames();
      const storeStates: Record<string, any> = {};
      for (const name of storeNames) {
        storeStates[name] = devtools.getStoreState(name);
      }

      const selectedStore = panelStore.getState().selectedStore;
      const storeName = selectedStore || storeNames[0] || null;
      const history = storeName ? devtools.getHistory(storeName) : [];

      panelStore.dispatch('sync', {
        storeNames,
        storeStates,
        actionLog: history,
        timeTravelIndex: history.length > 0 ? history.length - 1 : -1,
        selectedStore: storeName,
        components: devtools.getComponents(),
      });
    } finally {
      syncing = false;
    }
  }

  // Listen to devtools events (skip component events to avoid feedback loop)
  devtools.on((event) => {
    if (
      event.type === 'component-mounted' ||
      event.type === 'component-unmounted'
    )
      return;
    syncState();
  });

  // Panel action helpers
  const panelActions = {
    selectStore: (name: string) => {
      panelStore.dispatch('selectStore', name);
      // Re-sync to load that store's history
      const history = devtools.getHistory(name);
      panelStore.dispatch('sync', {
        actionLog: history,
        timeTravelIndex: history.length > 0 ? history.length - 1 : -1,
      });
    },
    setTab: (tab: string) => panelStore.dispatch('setTab', tab),
    setFilter: (filter: string) => panelStore.dispatch('setFilter', filter),
    close: () => panelStore.dispatch('close'),
    travelTo: (index: number) => {
      const storeName = panelStore.getState().selectedStore;
      if (storeName) {
        travelTo(devtools, storeName, index);
        panelStore.dispatch('setTimeTravelIndex', index);
      }
    },
    sliderChange: (index: number) => {
      const storeName = panelStore.getState().selectedStore;
      if (storeName) {
        travelTo(devtools, storeName, index);
        panelStore.dispatch('setTimeTravelIndex', index);
      }
    },
  };

  // Connected panel root
  const ConnectedPanel = connect({
    open: panelStore.select((s) => s.open),
    activeTab: panelStore.select((s) => s.activeTab),
    selectedStore: panelStore.select((s) => s.selectedStore),
    timeTravelIndex: panelStore.select((s) => s.timeTravelIndex),
    storeNames: panelStore.select((s) => s.storeNames),
    storeStates: panelStore.select((s) => s.storeStates),
    actionLog: panelStore.select((s) => s.actionLog),
    filter: panelStore.select((s) => s.filter),
    components: panelStore.select((s) => s.components),
  })((props: any) => PanelRootView({ ...props, panelActions }));

  let container: HTMLElement | null = null;

  function mount() {
    if (container) return;
    container = document.createElement('div');
    container.id = 'pulse-devtools-root';
    document.body.appendChild(container);
    render(h(ConnectedPanel, null), container);
    syncState();
  }

  function openPanel() {
    mount();
    panelStore.dispatch('open');
  }

  function closePanel() {
    panelStore.dispatch('close');
  }

  function togglePanel() {
    mount();
    panelStore.dispatch('toggle');
  }

  return { openPanel, closePanel, togglePanel, panelStore };
}
