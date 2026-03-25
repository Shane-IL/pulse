import { connect } from '@shane_il/pulse';
import { todoStore } from '../stores/todos';
import { TodoItem } from './TodoItem';

function TodoListView({ items }) {
  if (items.length === 0) {
    return <p className="empty">Nothing to show.</p>;
  }

  return (
    <ul className="todo-list">
      {items.map((item) => (
        <TodoItem key={item.id} item={item} />
      ))}
    </ul>
  );
}

export function createTodoList(filter) {
  const selector = (s) => {
    if (filter === 'active') return s.items.filter((i) => !i.done);
    if (filter === 'completed') return s.items.filter((i) => i.done);
    return s.items;
  };

  return connect({
    items: todoStore.select(selector),
  })(TodoListView);
}
