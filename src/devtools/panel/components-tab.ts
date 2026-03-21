import { h } from '../../createElement';
import type { VNode } from '../../vnode';
import type { TrackedComponent } from '../core';
import * as s from './styles';

export function ComponentsTab({
  components,
}: {
  components: TrackedComponent[];
}): VNode {
  if (components.length === 0) {
    return h('div', { style: { color: s.colors.overlay0, padding: '8px' } },
      'No connected components mounted',
    );
  }

  return h('div', null,
    ...components.map((comp) =>
      h('div', { key: comp.id, style: s.componentItem },
        h('span', { style: s.componentName }, comp.displayName),
        comp.storeNames.length > 0
          ? h('span', { style: s.componentStores },
              comp.storeNames.map((name) =>
                h('span', { key: name, style: s.badge }, name),
              ),
            )
          : null,
      ),
    ),
  );
}
