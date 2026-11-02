import { SORTS } from "../pages";

// Pilihan urutan: terbaru, deadline, atau prioritas.
export default function SortSelect({ value, onChange }) {
  return (
    <label className="sort">
      <span>Sort</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Sort tasks">
        {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </label>
  );
}
