import "../styles/priority.css";
import { PRIORITIES } from "../utils";

// Pilihan prioritas Low / Medium / High.
export default function PriorityPicker({ value, onChange }) {
  return (
    <div className="prio-picker" role="group" aria-label="Priority">
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          type="button"
          className={`prio-${p.value}`}
          aria-pressed={value === p.value}
          onClick={() => onChange(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
