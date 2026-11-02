// Fungsi bantu yang tidak bergantung pada React: prioritas dan tanggal.

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label]));
export const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

// Tanggal hari ini (zona waktu lokal) dalam format YYYY-MM-DD.
export function todayISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const opts = { month: "short", day: "numeric" };
  if (y !== new Date().getFullYear()) opts.year = "numeric";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
}

// Label deadline untuk satu todo: Overdue, Due today, atau Due <tanggal>.
export function dueInfo(todo, today = todayISO()) {
  if (!todo.due_date) return null;
  if (!todo.completed && todo.due_date < today) {
    return { className: "overdue", text: `Overdue · ${formatDate(todo.due_date)}` };
  }
  if (todo.due_date === today) return { className: "today", text: "Due today" };
  return { className: "", text: `Due ${formatDate(todo.due_date)}` };
}
