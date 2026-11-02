import "../styles/filter.css";

export const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "done", label: "Done" },
];

// Saring daftar tugas sesuai tab yang dipilih.
export function applyFilter(todos, filter) {
  if (filter === "active") return todos.filter((t) => !t.completed);
  if (filter === "done") return todos.filter((t) => t.completed);
  return todos;
}

// Tab All / Active / Done, masing-masing dengan jumlah tugasnya.
export default function FilterTabs({ value, counts, onChange }) {
  return (
    <div className="tabs" role="group" aria-label="Filter tasks">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          className="tab"
          aria-pressed={value === f.value}
          onClick={() => onChange(f.value)}
        >
          {f.label}
          <span className="count">{counts[f.value]}</span>
        </button>
      ))}
    </div>
  );
}
