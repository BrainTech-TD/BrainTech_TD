// Ikon garis sederhana (24x24) yang mengikuti warna teks (currentColor).
// Ikon khusus sebuah fitur ditulis di file komponen fitur itu sendiri.

export function Icon({ children, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true">
      <rect className="logo-bg" width="64" height="64" rx="16" />
      <path d="M17 34l10 10 19-23" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="46" cy="20" r="5.5" fill="#F2C94C" />
    </svg>
  );
}

export const TrashIcon = () => (
  <Icon>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5" />
  </Icon>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
