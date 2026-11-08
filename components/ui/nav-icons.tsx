import React from "react";
import type { NavIconName } from "../admin-navigation";

/**
 * Iconos de línea del rail de navegación (S4). Trazos heredados del artboard
 * `design/admin-experience/01-sidebar-classic.html`: 18 px, stroke
 * `currentColor`, siempre decorativos (`aria-hidden`) porque el nombre
 * accesible lo aporta la etiqueta del destino.
 */
const ICONS: Record<NavIconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  purchases: (
    <>
      <path d="M6 7h12l1.5 13h-15L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </>
  ),
  inventory: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5Z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </>
  ),
  alerts: (
    <>
      <path d="M12 3 2.5 20h19Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  sales: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  suppliers: (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  transfers: (
    <>
      <path d="m5 9-3 9h6M19 9l3 9h-6" />
      <path d="M3 13h18" />
    </>
  ),
  reports: (
    <>
      <path d="M3 21V10l9-6 9 6v11" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  promotions: (
    <>
      <path d="M20.59 13.41 12 22 4 14V4h10l6.59 6.59a2 2 0 0 1 0 2.82Z" />
      <path d="M7 7h.01" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 4h5M18.5 1.5v5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>
  ),
  weighed: (
    <>
      <path d="M4 8V5a2 2 0 0 1 2-2h3M15 3h3a2 2 0 0 1 2 2v3M20 16v3a2 2 0 0 1-2 2h-3M9 21H6a2 2 0 0 1-2-2v-3" />
      <path d="M3 12h18" />
    </>
  ),
  shifts: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pos: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.6 12h10.8l2.2-8H7" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
