import { render, connect, createRouter } from '@shane_il/pulse';
import { togglePanel } from '@shane_il/pulse/devtools';
import { AddTodo } from './AddTodo';
import { Footer } from './Footer';
import { createTodoList } from './TodoList';

// Router setup
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const router = createRouter({
  routes: [
    { path: '/' },
    { path: '/active' },
    { path: '/completed' },
  ],
  basePath: base || undefined,
});

const { Route, Link } = router;

// Connected todo lists for each filter
const TodoAll = createTodoList('all');
const TodoActive = createTodoList('active');
const TodoCompleted = createTodoList('completed');

function App({ path }) {
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

const ConnectedApp = connect({
  path: router.store.select((s) => s.path),
})(App);

render(<ConnectedApp />);
