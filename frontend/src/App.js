import { useState, useEffect } from "react";
import "./App.css";
import { api, API } from "./api";
import { Logo, CheckIcon, TrashIcon } from "./icons";
import FilterTabs, { applyFilter } from "./components/FilterTabs";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [input, setInput] = useState("");

  const fetchTodos = () =>
    fetch(`${API}/todos`)
      .then((r) => r.json())
      .then((data) => { setTodos(data); setError(""); })
      .catch(() => setError("Can't reach the server. Check that the backend is running."))
      .finally(() => setLoading(false));

  useEffect(() => { fetchTodos(); }, []);

  // ---------------------------------------------------------------- Data turunan
  const done = todos.filter((t) => t.completed).length;
  const percent = todos.length ? Math.round((done / todos.length) * 100) : 0;
  const tabCounts = { all: todos.length, active: todos.length - done, done };
  const visible = applyFilter(todos, filter);

  // ---------------------------------------------------------------- Aksi
  const showError = (err) => setError(err.message);

  const addTodo = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    api("/todos", { method: "POST", body: JSON.stringify({ title: input }) })
      .then(() => { setInput(""); fetchTodos(); })
      .catch(showError);
  };

  const toggleTodo = (id) => api(`/todos/${id}`, { method: "PUT" }).then(fetchTodos).catch(showError);
  const deleteTodo = (id) => api(`/todos/${id}`, { method: "DELETE" }).then(fetchTodos).catch(showError);

  const clearCompleted = () => {
    if (!window.confirm(`Delete ${done} completed ${done === 1 ? "task" : "tasks"}?`)) return;
    api("/todos?status=done", { method: "DELETE" }).then(fetchTodos).catch(showError);
  };

  // ---------------------------------------------------------------- Tampilan
  return (
    <div className="shell">
      <main className="main">
        <header className="page-header">
          <div className="heading">
            <Logo />
            <div>
              <h1>Todo</h1>
              <p className="tagline">React · Node.js · MySQL, running in Docker</p>
            </div>
          </div>
        </header>

        <section className="progress" aria-label="Progress">
          <div className="progress-text">
            <span>{todos.length ? `${done} of ${todos.length} done` : "Nothing to track yet"}</span>
            <span>{percent}%</span>
          </div>
          <div className="bar"><div className="bar-fill" style={{ width: `${percent}%` }} /></div>
        </section>

        <form className="composer" onSubmit={addTodo}>
          <div className="add">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What needs doing?"
              aria-label="New task"
              maxLength={255}
            />
            <button type="submit" className="add-btn">Add task</button>
          </div>
        </form>

        {error && <p className="notice error" role="alert">{error}</p>}

        {todos.length > 0 && (
          <div className="toolbar">
            <FilterTabs value={filter} counts={tabCounts} onChange={setFilter} />
          </div>
        )}

        {!error && !loading && todos.length === 0 && (
          <p className="notice">No tasks yet. Type one above and press Enter.</p>
        )}
        {todos.length > 0 && visible.length === 0 && (
          <p className="notice">{filter === "active" ? "No active tasks here. Nice work." : "Nothing completed yet."}</p>
        )}

        <ul className="list">
          {visible.map((todo) => (
            <li key={todo.id} className={`item ${todo.completed ? "is-done" : ""}`}>
              <button
                className="check"
                role="checkbox"
                aria-checked={!!todo.completed}
                aria-label={`Mark "${todo.title}" as ${todo.completed ? "not done" : "done"}`}
                onClick={() => toggleTodo(todo.id)}
              >
                <CheckIcon />
              </button>
              <div className="body">
                <span className="title" onClick={() => toggleTodo(todo.id)}>{todo.title}</span>
              </div>
              <button className="icon-btn delete" onClick={() => deleteTodo(todo.id)} aria-label={`Delete "${todo.title}"`}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>

        {done > 0 && (
          <div className="list-footer">
            <button type="button" className="link-btn" onClick={clearCompleted}>
              Clear {done} completed
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
