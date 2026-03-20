import { h, render, connect, createRouter } from '@shane_il/pulse';
import { App } from './components/App';
import { createTodoList } from './components/TodoList';

// Create router
const router = createRouter({
  routes: [
    { path: '/' },
    { path: '/active' },
    { path: '/completed' },
  ],
});

const { Route, Link } = router;

// Create a connected TodoList for each filter
const TodoAll = createTodoList('all');
const TodoActive = createTodoList('active');
const TodoCompleted = createTodoList('completed');

// Connect App to router store so it knows the current path
const ConnectedApp = connect({
  path: router.store.select((s) => s.path),
})(function AppWrapper({ path }) {
  return (
    <App
      path={path}
      Route={Route}
      Link={Link}
      TodoAll={TodoAll}
      TodoActive={TodoActive}
      TodoCompleted={TodoCompleted}
    />
  );
});

render(<ConnectedApp />, document.getElementById('app'));
