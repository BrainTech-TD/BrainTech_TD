import "../styles/sidebar.css";
import { PAGES } from "../pages";
import { Icon, Logo } from "../icons";
import ThemeToggle from "./ThemeToggle";

const TodayIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Icon>
);

const UpcomingIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" />
  </Icon>
);

const AllIcon = () => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </Icon>
);

const PAGE_ICONS = { today: TodayIcon, upcoming: UpcomingIcon, all: AllIcon };

// Navigasi samping. Setiap halaman memakai alamat #today, #upcoming, #all
// sehingga halaman yang sedang dibuka tetap sama setelah refresh.
export default function Sidebar({ page, counts, alerts }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#all">
        <Logo />
        <span>
          <span className="brand-name">Todo</span>
          <span className="brand-tag">React · Node.js · MySQL</span>
        </span>
      </a>

      <nav className="nav" aria-label="Pages">
        {PAGES.map((p) => {
          const PageIcon = PAGE_ICONS[p.id];
          return (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="nav-item"
              aria-current={page === p.id ? "page" : undefined}
            >
              <PageIcon />
              <span className="nav-label">{p.label}</span>
              {counts[p.id] > 0 && (
                <span className={`nav-count ${alerts[p.id] ? "alert" : ""}`}>{counts[p.id]}</span>
              )}
            </a>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle />
      </div>
    </aside>
  );
}
