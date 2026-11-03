import { useState } from "react";
import "../styles/dark.css";
import { Icon } from "../icons";

const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
);

const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);

// Tema yang sedang aktif: pilihan tersimpan, atau mengikuti pengaturan sistem.
// Pilihan tersimpan dipasang ke <html data-theme> oleh skrip kecil di public/index.html.
function currentTheme() {
  const saved = document.documentElement.dataset.theme;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Tombol mode gelap / terang di bagian bawah sidebar.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  const next = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* penyimpanan browser tidak tersedia */ }
    setTheme(next);
  };

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${next} mode`}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      <span className="theme-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
