import { h, connect } from '@shane_il/pulse';
import { todoStore } from '../stores/todos';

function FooterView({ count, Link, filter }) {
  return (
    <div className="footer">
      <span>{count} {count === 1 ? 'item' : 'items'} left</span>
      <div className="filters">
        <Link to="/" className={filter === 'all' ? 'active' : ''}>All</Link>
        <Link to="/active" className={filter === 'active' ? 'active' : ''}>Active</Link>
        <Link to="/completed" className={filter === 'completed' ? 'active' : ''}>Completed</Link>
      </div>
    </div>
  );
}

export const Footer = connect({
  count: todoStore.select((s) => s.items.filter((i) => !i.done).length),
})(FooterView);
