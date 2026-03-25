import { createStore } from '@shane_il/pulse';
import { devtools, instrumentStore } from '@shane_il/pulse/devtools';

const { store: todoStore } = instrumentStore(devtools, {
  name: 'todos',
  state: {
    items: [],
    nextId: 1,
  },
  actions: {
    add: (s, text) => {
      s.items.push({ id: s.nextId, text, done: false });
      s.nextId++;
    },
    toggle: (s, id) => {
      const item = s.items.find((i) => i.id === id);
      item.done = !item.done;
    },
    remove: (s, id) => {
      const idx = s.items.findIndex((i) => i.id === id);
      s.items.splice(idx, 1);
    },
  },
});

export { todoStore };
