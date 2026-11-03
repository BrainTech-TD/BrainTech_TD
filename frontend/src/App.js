import { useState, useEffect } from "react";
import "./App.css";
import { api, API } from "./api";
import { dueInfo, todayISO } from "./utils";
import { PAGES, formatLongDate, pageFromHash, sortTodos } from "./pages";
import Sidebar from "./components/Sidebar";
import SortSelect from "./components/SortSelect";
import FilterTabs, { applyFilter } from "./components/FilterTabs";
import PriorityPicker from "./components/PriorityPicker";
import TodoItem from "./components/TodoItem";
import DataMenu from "./components/DataMenu";

const EMPTY_PAGE = {
  today: "Nothing due today. Enjoy the calm.",
  upcoming: "No upcoming deadlines. Add a due date to plan ahead.",
  all: "No tasks yet. Type one above and press Enter.",
};

export default function App() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [page, setPage] = useState(() => pageFromHash(window.location.hash));
  const [filter, setFilter] = useState("all");
  const [sorts, setSorts] = useState(() => Object.fromEntries(PAGES.map((p) => [p.id, p.defaultSort])));
  const [editingId, setEditingId] = useState(null);

  const [input, setInput] = useState("");
  const [priority, setPriority] = useState("medium");
  // Di halaman Today, todo baru otomatis diberi deadline hari ini.
  const [dueDate, setDueDate] = useState(() => (page === "today" ? todayISO() : ""));

  const fetchTodos = () =>
    fetch(`${API}/todos`)
      .then((r) => r.json())
      .then((data) => { setTodos(data); setError(""); })
      .catch(() => setError("Can't reach the server. Check that the backend is running."))
      .finally(() => setLoading(false));

  useEffect(() => { fetchTodos(); }, []);

  // Pindah halaman lewat alamat #today, #upcoming, #all. Deadline hari ini
  // diisi otomatis saat masuk Today dan dikosongkan lagi saat keluar.
  useEffect(() => {
    const onHash = () => {
      const next = pageFromHash(window.location.hash);
      const today = todayISO();
      setPage(next);
      setEditingId(null);
      setDueDate((d) => (next === "today" ? today : d === today ? "" : d));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ---------------------------------------------------------------- Data turunan
  const today = todayISO();
  const pageDef = PAGES.find((p) => p.id === page);
  const pageTodos = todos.filter((t) => pageDef.match(t, today));
  const done = pageTodos.filter((t) => t.completed).length;
  const percent = pageTodos.length ? Math.round((done / pageTodos.length) * 100) : 0;
  const overdue = todos.filter((t) => dueInfo(t, today)?.className === "overdue").length;
  const tabCounts = { all: pageTodos.length, active: pageTodos.length - done, done };
  const navCounts = Object.fromEntries(
    PAGES.map((p) => [p.id, todos.filter((t) => !t.completed && p.match(t, today)).length])
  );
  const sort = sorts[page];
  const visible = sortTodos(applyFilter(pageTodos, filter), sort);

  // ---------------------------------------------------------------- Aksi
  const showError = (err) => setError(err.message);

  const addTodo = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const created = { due_date: dueDate || null, completed: false };
    api("/todos", {
      method: "POST",
      body: JSON.stringify({ title: input, priority, due_date: dueDate || null }),
    })
      .then(() => {
        setInput("");
        setPriority("medium");
        setDueDate(page === "today" ? todayISO() : "");
        // Beri tahu kalau tugas baru masuk ke halaman lain dan tidak terlihat di sini.
        if (!pageDef.match(created, todayISO())) {
          const home = PAGES.find((p) => p.id !== "all" && p.match(created, todayISO())) || PAGES[2];
          setToast(`Task added to ${home.label}`);
        }
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

  const totalDone = todos.filter((t) => t.completed).length;
  const clearCompleted = () => {
    if (!window.confirm(`Delete ${totalDone} completed ${totalDone === 1 ? "task" : "tasks"}?`)) return;
    api("/todos?status=done", { method: "DELETE" }).then(fetchTodos).catch(showError);
  };

  const onImported = (count, fileName) => {
    setToast(`Imported ${count} ${count === 1 ? "task" : "tasks"} from ${fileName}`);
    fetchTodos();
  };

  // ---------------------------------------------------------------- Tampilan
  return (
    <div className="shell">
      <Sidebar page={page} counts={navCounts} alerts={{ today: overdue > 0 }} />

      <main className="main">
        <header className="page-header">
          <div>
            <h1>{pageDef.label}</h1>
            <p className="tagline">{pageDef.description || formatLongDate()}</p>
          </div>
          <DataMenu onImported={onImported} onError={showError} />
        </header>

        <section className="progress" aria-label="Progress">
          <div className="progress-text">
            <span>
              {pageTodos.length ? `${done} of ${pageTodos.length} done` : "Nothing to track yet"}
              {overdue > 0 && page !== "upcoming" && <span className="overdue-count"> · {overdue} overdue</span>}
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
            <SortSelect value={sort} onChange={(value) => setSorts({ ...sorts, [page]: value })} />
          </div>
        )}

        {!error && !loading && pageTodos.length === 0 && <p className="notice">{EMPTY_PAGE[page]}</p>}
        {pageTodos.length > 0 && visible.length === 0 && (
          <p className="notice">{filter === "active" ? "No active tasks here. Nice work." : "Nothing completed yet."}</p>
        )}

        <ul className="list">
          {visible.map((todo) => (
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

        {page === "all" && totalDone > 0 && (
          <div className="list-footer">
            <button type="button" className="link-btn" onClick={clearCompleted}>
              Clear {totalDone} completed
            </button>
          </div>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
