import { createStore } from '@shane_il/pulse';

export const todoStore = createStore({
  state: {
    items: [],
    nextId: 1,
  },
  actions: {
    add: (state, text) => ({
      ...state,
      items: [...state.items, { id: state.nextId, text, done: false }],
      nextId: state.nextId + 1,
    }),
    toggle: (state, id) => ({
      ...state,
      items: state.items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      ),
    }),
    remove: (state, id) => ({
      ...state,
      items: state.items.filter((item) => item.id !== id),
    }),
  },
});
