import "../styles/search.css";
import { Icon } from "../icons";

const SearchIcon = () => (
  <Icon size={18}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Icon>
);

// Cocokkan judul todo dengan kata pencarian (tidak membedakan huruf besar dan kecil).
export function matchesQuery(todo, query) {
  const q = query.trim().toLowerCase();
  return !q || todo.title.toLowerCase().includes(q);
}

// Tandai bagian judul yang cocok dengan kata pencarian.
export function Highlight({ text, query }) {
  const q = query.trim();
  if (!q) return text;
  const start = text.toLowerCase().indexOf(q.toLowerCase());
  if (start === -1) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark className="hl">{text.slice(start, start + q.length)}</mark>
      {text.slice(start + q.length)}
    </>
  );
}

// Kolom pencarian di samping tab filter. Tekan Esc untuk mengosongkan.
export default function SearchBox({ value, onChange }) {
  return (
    <label className="search">
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder="Search tasks"
        aria-label="Search tasks"
      />
    </label>
  );
}
