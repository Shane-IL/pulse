import { h } from '@shane_il/pulse';
import { todoStore } from '../stores/todos';

export function TodoItem({ item }) {
  return (
    <li className={item.done ? 'todo-item done' : 'todo-item'}>
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => todoStore.dispatch('toggle', item.id)}
      />
      <span>{item.text}</span>
      <button
        className="delete"
        onClick={() => todoStore.dispatch('remove', item.id)}
      >
        ×
      </button>
    </li>
  );
}
