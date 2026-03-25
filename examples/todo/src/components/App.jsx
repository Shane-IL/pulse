import { h } from '@shane_il/pulse';
import { togglePanel } from '@shane_il/pulse/devtools';
import { AddTodo } from './AddTodo';
import { Footer } from './Footer';

export function App({ path, Route, Link, TodoAll, TodoActive, TodoCompleted }) {
  const filter = path === '/active' ? 'active'
    : path === '/completed' ? 'completed'
    : 'all';

  return (
    <div>
      <h1>Pulse Todos</h1>
      <div className="todo-app">
        <AddTodo />
        <Route path="/" component={TodoAll} />
        <Route path="/active" component={TodoActive} />
        <Route path="/completed" component={TodoCompleted} />
        <Footer Link={Link} filter={filter} />
      </div>
      <button className="devtools-toggle" onClick={() => togglePanel()}>
        Devtools
      </button>
    </div>
  );
}
