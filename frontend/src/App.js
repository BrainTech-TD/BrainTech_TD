import { useState, useEffect } from "react";
import "./App.css";
import { api, API } from "./api";
import { Logo, CheckIcon, TrashIcon } from "./icons";
import FilterTabs, { applyFilter } from "./components/FilterTabs";
import { dueInfo, todayISO } from "./utils";
import { Logo } from "./icons";
import FilterTabs, { applyFilter } from "./components/FilterTabs";
import PriorityPicker from "./components/PriorityPicker";
import TodoItem from "./components/TodoItem";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [input, setInput] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");

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
  const today = todayISO();
  const done = todos.filter((t) => t.completed).length;
  const percent = todos.length ? Math.round((done / todos.length) * 100) : 0;
  const overdue = todos.filter((t) => dueInfo(t, today)?.className === "overdue").length;
  const tabCounts = { all: todos.length, active: todos.length - done, done };
  const visible = applyFilter(todos, filter);

  // ---------------------------------------------------------------- Aksi
  const showError = (err) => setError(err.message);

  const addTodo = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    api("/todos", { method: "POST", body: JSON.stringify({ title: input }) })
      .then(() => { setInput(""); fetchTodos(); })
    api("/todos", {
      method: "POST",
      body: JSON.stringify({ title: input, priority, due_date: dueDate || null }),
    })
      .then(() => {
        setInput("");
        setPriority("medium");
        setDueDate("");
        fetchTodos();
      })
      .catch(showError);
  };

  const toggleTodo = (id) => api(`/todos/${id}`, { method: "PUT" }).then(fetchTodos).catch(showError);
  const deleteTodo = (id) => api(`/todos/${id}`, { method: "DELETE" }).then(fetchTodos).catch(showError);

  const saveTodo = (id, draft) =>
    api(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: draft.title, priority: draft.priority, due_date: draft.due_date || null }),
    })
      .then(() => { setEditingId(null); fetchTodos(); })
      .catch(showError);

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
            <span>
              {todos.length ? `${done} of ${todos.length} done` : "Nothing to track yet"}
              {overdue > 0 && <span className="overdue-count"> · {overdue} overdue</span>}
            </span>
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
          <div className="options">
            <PriorityPicker value={priority} onChange={setPriority} />
            <label className="opt-label">
              Due
              <input
                type="date"
                className="date-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
              />
            </label>
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
            <TodoItem
              key={todo.id}
              todo={todo}
              editing={todo.id === editingId}
              onToggle={() => toggleTodo(todo.id)}
              onDelete={() => deleteTodo(todo.id)}
              onEdit={() => setEditingId(todo.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(draft) => saveTodo(todo.id, draft)}
            />
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
