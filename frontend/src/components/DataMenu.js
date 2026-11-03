import { useEffect, useRef } from "react";
import "../styles/data-menu.css";
import { api, API } from "../api";
import { Icon } from "../icons";

const ImportIcon = () => (
  <Icon size={18}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />
  </Icon>
);

const ExportIcon = () => (
  <Icon size={18}>
    <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14" />
  </Icon>
);

const ChevronIcon = () => (
  <Icon size={16}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

// Unduh file export (JSON atau CSV) dari backend.
async function downloadExport(format) {
  const res = await fetch(`${API}/todos/export?format=${format}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match ? match[1] : `todos.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Kirim isi file JSON atau CSV ke backend untuk diimport.
async function importFile(file) {
  const text = await file.text();
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (!isCsv) {
    try {
      JSON.parse(text);
    } catch {
      throw new Error(`"${file.name}" is not a valid JSON file`);
    }
  }
  return api("/todos/import", {
    method: "POST",
    body: text,
    headers: { "Content-Type": isCsv ? "text/csv" : "application/json" },
  });
}

// Tombol Import dan Export di pojok kanan atas.
export default function DataMenu({ onImported, onError }) {
  const fileRef = useRef(null);
  const menuRef = useRef(null);

  // Tutup menu Export saat klik di luar menu atau menekan Esc.
  useEffect(() => {
    const close = (e) => {
      const menu = menuRef.current;
      if (!menu || !menu.open) return;
      if (e.type === "keydown" ? e.key === "Escape" : !menu.contains(e.target)) menu.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const exportAs = (format) => {
    menuRef.current.open = false;
    downloadExport(format).catch(onError);
  };

  const onFile = (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // supaya file yang sama bisa dipilih lagi
    if (!file) return;
    importFile(file)
      .then((data) => onImported(data.imported, file.name))
      .catch(onError);
  };

  return (
    <div className="data-actions">
      <button
        type="button"
        className="ghost-btn small"
        onClick={() => fileRef.current.click()}
        title="Import a JSON export, or a CSV file with a title column"
      >
        <ImportIcon /> Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        onChange={onFile}
        hidden
        data-testid="import-input"
      />
      <details className="menu" ref={menuRef}>
        <summary className="ghost-btn small">
          <ExportIcon /> Export <ChevronIcon />
        </summary>
        <div className="menu-list" role="menu">
          <button type="button" role="menuitem" onClick={() => exportAs("json")}>
            <span>JSON</span>
            <small>Backup that can be imported again</small>
          </button>
          <button type="button" role="menuitem" onClick={() => exportAs("csv")}>
            <span>CSV</span>
            <small>Open in Excel or Google Sheets</small>
          </button>
        </div>
      </details>
    </div>
  );
}
