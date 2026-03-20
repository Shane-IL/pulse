# Pulse Todo Example

A simple todo app built with [Pulse](https://github.com/Shane-IL/pulse) — demonstrating stores, connected components, lifecycle callbacks, and the router.

## Run It

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## What It Shows

| Feature | File |
|---------|------|
| `createStore` with actions | `src/stores/todos.js` |
| `connect()` with selectors | `src/components/TodoList.jsx` |
| `connect()` with `onMount` lifecycle | `src/components/AddTodo.jsx` |
| Pure function components | `src/components/TodoItem.jsx` |
| `createRouter` / `Route` / `Link` | `src/main.jsx`, `src/components/Footer.jsx` |
| Keyed lists | `src/components/TodoList.jsx` |
