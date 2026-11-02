// Halaman di sidebar dan pilihan urutan. `match` menentukan todo mana yang tampil di halaman itu.
import { PRIORITY_RANK } from "./utils";

export const PAGES = [
  {
    id: "today",
    label: "Today",
    description: null, // diisi tanggal hari ini
    defaultSort: "priority",
    match: (t, today) => Boolean(t.due_date) && (t.due_date === today || (t.due_date < today && !t.completed)),
  },
  {
    id: "upcoming",
    label: "Upcoming",
    description: "Tasks with a deadline after today",
    defaultSort: "due",
    match: (t, today) => Boolean(t.due_date) && t.due_date > today,
  },
  {
    id: "all",
    label: "All tasks",
    description: "Everything in one place",
    defaultSort: "newest",
    match: () => true,
  },
];

export const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
];

// Halaman dibaca dari alamat #today, #upcoming, #all supaya tetap sama setelah refresh.
export function pageFromHash(hash) {
  const id = (hash || "").replace(/^#/, "");
  return PAGES.some((p) => p.id === id) ? id : "all";
}

export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// "newest" memakai urutan dari server (terbaru dulu). Urutan lain menaruh todo yang
// belum selesai di atas, lalu mengurutkan berdasarkan deadline atau prioritas.
export function sortTodos(list, sort) {
  if (sort === "newest") return list;
  const due = (t) => t.due_date || "9999-12-31";
  const rank = (t) => PRIORITY_RANK[t.priority] ?? 1;
  const byDue = (a, b) => due(a).localeCompare(due(b));
  const byPriority = (a, b) => rank(a) - rank(b);
  return [...list].sort(
    (a, b) =>
      Number(Boolean(a.completed)) - Number(Boolean(b.completed)) ||
      (sort === "due" ? byDue(a, b) || byPriority(a, b) : byPriority(a, b) || byDue(a, b))
  );
}
