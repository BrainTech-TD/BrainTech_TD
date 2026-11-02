import { useState } from "react";
import PriorityPicker from "./PriorityPicker";
import { PRIORITY_LABEL, dueInfo } from "../utils";
import { Icon, CheckIcon, TrashIcon } from "../icons";

const PencilIcon = () => (
  <Icon>
    <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
  </Icon>
);

function EditForm({ todo, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    title: todo.title,
    priority: todo.priority || "medium",
    due_date: todo.due_date || "",
  });

  const submit = (e) => {
    e.preventDefault();
    if (draft.title.trim()) onSave(draft);
  };

  return (
    <li className="item is-editing">
      <form className="edit-form" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
        <input
          className="edit-input"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          aria-label="Task title"
          maxLength={255}
          autoFocus
        />
        <div className="options">
          <PriorityPicker value={draft.priority} onChange={(p) => setDraft({ ...draft, priority: p })} />
          <label className="opt-label">
            Due
            <input
              type="date"
              className="date-input"
              value={draft.due_date}
              onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
              aria-label="Due date"
            />
          </label>
          <div className="edit-actions">
            <button type="button" className="ghost-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="save-btn" disabled={!draft.title.trim()}>Save</button>
          </div>
        </div>
      </form>
    </li>
  );
}

// Satu baris tugas: centang, judul, label prioritas dan deadline, tombol edit dan hapus.
export default function TodoItem({ todo, editing, onToggle, onDelete, onEdit, onCancelEdit, onSave }) {
  if (editing) return <EditForm todo={todo} onSave={onSave} onCancel={onCancelEdit} />;

  const due = dueInfo(todo);
  return (
    <li className={`item ${todo.completed ? "is-done" : ""}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={!!todo.completed}
        aria-label={`Mark "${todo.title}" as ${todo.completed ? "not done" : "done"}`}
        onClick={onToggle}
      >
        <CheckIcon />
      </button>
      <div className="body">
        <span className="title" onClick={onToggle}>{todo.title}</span>
        <div className="meta">
          <span className={`chip prio-${todo.priority || "medium"}`}>{PRIORITY_LABEL[todo.priority] || "Medium"}</span>
          {due && <span className={`chip due ${due.className}`}>{due.text}</span>}
        </div>
      </div>
      <button className="icon-btn edit" onClick={onEdit} aria-label={`Edit "${todo.title}"`}>
        <PencilIcon />
      </button>
      <button className="icon-btn delete" onClick={onDelete} aria-label={`Delete "${todo.title}"`}>
        <TrashIcon />
      </button>
    </li>
  );
}
