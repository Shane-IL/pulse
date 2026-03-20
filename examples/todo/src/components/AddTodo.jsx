import { h, connect } from '@shane_il/pulse';
import { todoStore } from '../stores/todos';

function AddTodoView() {
  return (
    <form
      className="add-todo"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.target.elements.text;
        const value = input.value.trim();
        if (!value) return;
        todoStore.dispatch('add', value);
        input.value = '';
      }}
    >
      <input name="text" placeholder="What needs to be done?" />
      <button type="submit">Add</button>
    </form>
  );
}

export const AddTodo = connect({}, {
  onMount: ({ dom }) => {
    const input = dom.querySelector('input');
    if (input) input.focus();
  },
})(AddTodoView);
