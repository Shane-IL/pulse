import { h } from '../../createElement';
import type { VNode } from '../../vnode';
import * as s from './styles';

function renderValue(value: any, depth: number): VNode {
  if (value === null) {
    return h('span', { style: s.treeNull }, 'null');
  }
  if (value === undefined) {
    return h('span', { style: s.treeNull }, 'undefined');
  }
  if (typeof value === 'string') {
    return h('span', { style: s.treeString }, `"${value}"`);
  }
  if (typeof value === 'boolean') {
    return h('span', { style: s.treeBool }, String(value));
  }
  if (typeof value === 'number') {
    return h('span', { style: s.treeValue }, String(value));
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return h('span', { style: s.treeValue }, '[]');
    if (depth > 4) return h('span', { style: s.treeNull }, '[…]');
    return h('div', { style: { paddingLeft: '12px' } },
      ...value.map((item, i) =>
        h('div', { key: i },
          h('span', { style: s.treeKey }, `${i}: `),
          renderValue(item, depth + 1),
        ),
      ),
    );
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return h('span', { style: s.treeValue }, '{}');
    if (depth > 4) return h('span', { style: s.treeNull }, '{…}');
    return h('div', { style: { paddingLeft: '12px' } },
      ...keys.map((key) =>
        h('div', { key },
          h('span', { style: s.treeKey }, `${key}: `),
          renderValue(value[key], depth + 1),
        ),
      ),
    );
  }
  return h('span', { style: s.treeValue }, String(value));
}

export function StoresTab({
  storeNames,
  selectedStore,
  storeStates,
  onSelectStore,
}: {
  storeNames: string[];
  selectedStore: string | null;
  storeStates: Record<string, any>;
  onSelectStore: (name: string) => void;
}): VNode {
  const currentState = selectedStore ? storeStates[selectedStore] : null;

  return h('div', { style: s.splitPane },
    h('div', { style: s.paneLeft },
      ...storeNames.map((name) =>
        h('div', {
          key: name,
          style: s.storeItem(name === selectedStore),
          onClick: () => onSelectStore(name),
        }, name),
      ),
    ),
    h('div', { style: s.paneRight },
      selectedStore
        ? h('div', null,
            h('div', { style: { marginBottom: '8px', color: s.colors.subtext0 } },
              `State of `, h('span', { style: s.actionName }, selectedStore),
            ),
            currentState != null
              ? renderValue(currentState, 0)
              : h('span', { style: s.treeNull }, 'No state'),
          )
        : h('span', { style: s.treeNull }, 'Select a store'),
    ),
  );
}
