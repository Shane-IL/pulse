import { h } from '../../createElement';
import type { VNode } from '../../vnode';
import type { ActionEntry } from '../../middleware';
import * as s from './styles';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function ActionsTab({
  actionLog,
  timeTravelIndex,
  filter,
  onFilterChange,
  onTravelTo,
  onSliderChange,
}: {
  actionLog: ActionEntry[];
  timeTravelIndex: number;
  filter: string;
  onFilterChange: (value: string) => void;
  onTravelTo: (index: number) => void;
  onSliderChange: (index: number) => void;
}): VNode {
  const filtered = filter
    ? actionLog.filter((e) => e.actionName.toLowerCase().includes(filter.toLowerCase()))
    : actionLog;

  return h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } },
    // Filter
    h('input', {
      style: s.filterInput,
      placeholder: 'Filter actions…',
      value: filter,
      onInput: (e: any) => onFilterChange(e.target.value),
    }),
    // Slider
    actionLog.length > 0
      ? h('div', { style: { flexShrink: '0' } },
          h('input', {
            type: 'range',
            style: s.slider,
            min: '0',
            max: String(actionLog.length - 1),
            value: String(timeTravelIndex),
            onInput: (e: any) => onSliderChange(Number(e.target.value)),
          }),
          h('div', { style: { color: s.colors.overlay0, fontSize: '10px', marginBottom: '4px' } },
            `${timeTravelIndex + 1} / ${actionLog.length}`,
          ),
        )
      : null,
    // Action list
    h('div', { style: { flex: '1', overflow: 'auto' } },
      ...filtered.map((entry, idx) => {
        // Map filtered index back to actual index
        const actualIdx = actionLog.indexOf(entry);
        return h('div', {
          key: actualIdx,
          style: s.actionEntry(actualIdx === timeTravelIndex),
          onClick: () => onTravelTo(actualIdx),
        },
          h('span', null,
            h('span', { style: s.actionName }, entry.actionName),
            entry.payload !== undefined
              ? h('span', { style: { color: s.colors.subtext0, marginLeft: '8px' } },
                  typeof entry.payload === 'object'
                    ? JSON.stringify(entry.payload)
                    : String(entry.payload),
                )
              : null,
          ),
          h('span', { style: s.actionTime }, formatTime(entry.timestamp)),
        );
      }),
      filtered.length === 0
        ? h('div', { style: { color: s.colors.overlay0, padding: '8px' } },
            actionLog.length === 0 ? 'No actions yet' : 'No matching actions',
          )
        : null,
    ),
  );
}
