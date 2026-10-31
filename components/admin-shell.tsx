"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { RoleName } from "../src/domain/contracts";
import {
  getBreadcrumbs,
  getVisibleNavItems,
  isRoleAuthorizedForAdmin,
  KEYBOARD_SHORTCUTS,
  ROLE_LABELS,
} from "./admin-navigation";
import styles from "./admin-shell.module.css";

export type AdminShellProps = {
  readonly children?: React.ReactNode;
  readonly initialRole?: RoleName;
  readonly tenantName?: string;
  readonly branches?: readonly { id: string; name: string }[];
};

export function AdminShell({
  children,
  initialRole = "ADMIN",
  tenantName,
  branches,
}: AdminShellProps) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();

  // Role is strictly server-derived; client-side switching is forbidden
  const currentRole = initialRole;
  const [selectedBranch, setSelectedBranch] = useState<string>(branches?.[0]?.id ?? "");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }, [router]);

  const visibleNavItems = getVisibleNavItems(currentRole);
  const isAuthorized = isRoleAuthorizedForAdmin(currentRole);
  const breadcrumbs = getBreadcrumbs(pathname);

  // Keyboard shortcut listener
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // If typing in input, select, or textarea, don't trigger global navigation shortcuts
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        if (isShortcutsOpen) {
          setIsShortcutsOpen(false);
          event.preventDefault();
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false);
          event.preventDefault();
        }
        return;
      }

      if (isInput) return;

      if (event.altKey && (event.key === "h" || event.key === "H")) {
        event.preventDefault();
        router.push("/admin");
      } else if (event.altKey && (event.key === "p" || event.key === "P")) {
        event.preventDefault();
        router.push("/pos");
      } else if (event.altKey && (event.key === "m" || event.key === "M")) {
        event.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if (
        (event.altKey && (event.key === "k" || event.key === "K")) ||
        event.key === "?"
      ) {
        event.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    },
    [isShortcutsOpen, isSidebarOpen, router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={styles.container}>
      {/* Skip to main content link for keyboard users */}
      <a href="#admin-main" className={styles.skipLink}>
        Saltar al contenido principal
      </a>

      {/* Backdrop for tablet/mobile drawer */}
      {isSidebarOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar navigation */}
      <aside
        id="admin-sidebar"
        className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}
        aria-label="Navegación del panel administrativo"
      >
        <div className={styles.sidebarHeader}>
          <Link href="/admin" className={styles.brand} aria-label="Supermercado Admin - Inicio">
            <span>🛒 Supermercado</span>
            <span className={styles.brandBadge}>Admin</span>
          </Link>
          <button
            type="button"
            className={styles.closeDrawerButton}
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar navegación"
          >
            ✕
          </button>
        </div>

        <nav className={styles.navList} aria-label="Menú principal">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <div key={item.href} className={styles.navItem}>
                <Link
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <span className={styles.navLinkText}>
                    <span>{item.label}</span>
                  </span>
                  {item.shortcut && (
                    <kbd className={styles.shortcutKbd}>{item.shortcut}</kbd>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.roleInfo}>
            <div className={styles.roleLabel}>
              {ROLE_LABELS[currentRole]?.title}
            </div>
            <div className={styles.roleDesc}>
              {ROLE_LABELS[currentRole]?.description}
            </div>
          </div>
          <button type="button" className={styles.logoutButton} onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className={styles.mainWrapper}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuToggleButton}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-expanded={isSidebarOpen}
              aria-controls="admin-sidebar"
              aria-label="Alternar menú de navegación"
            >
              ☰ Menú
            </button>
            {tenantName && (
              <span className={styles.brandBadge} title={`Organización: ${tenantName}`}>
                {tenantName}
              </span>
            )}
          </div>

          <div className={styles.headerRight}>
            {/* Branch selector or neutral empty state */}
            <div className={styles.branchSelectorGroup}>
              <span className={styles.branchLabel}>Sucursal:</span>
              {branches && branches.length > 0 ? (
                <select
                  id="branch-select"
                  aria-label="Sucursal activa"
                  className={styles.branchSelect}
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={styles.emptyBranchText} role="status">
                  Sin sucursales asignadas
                </span>
              )}
            </div>

            {/* Non-editable active role indicator */}
            <div className={styles.roleBadgeGroup}>
              <span className={styles.branchLabel}>Rol:</span>
              <span
                className={styles.roleBadge}
                aria-label={`Rol activo: ${ROLE_LABELS[currentRole]?.title ?? currentRole}`}
                title={ROLE_LABELS[currentRole]?.description}
              >
                {currentRole}
              </span>
            </div>

            {/* Keyboard hints button */}
            <button
              type="button"
              className={styles.shortcutHelpButton}
              onClick={() => setIsShortcutsOpen(true)}
              aria-label="Ver atajos de teclado"
              title="Atajos de teclado (Alt+K o ?)"
            >
              ⌨️ <span className="sr-only">Atajos</span>
            </button>
          </div>
        </header>

        {/* Breadcrumb trail */}
        <div className={styles.breadcrumbBar}>
          <nav aria-label="Miga de pan" className={styles.breadcrumbs}>
            <ol className={styles.breadcrumbList}>
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <li key={crumb.href} className={styles.breadcrumbItem}>
                    {idx > 0 && <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>}
                    {isLast ? (
                      <span className={styles.breadcrumbCurrent} aria-current="page">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link href={crumb.href} className={styles.breadcrumbLink}>
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {/* Main page content or restricted banner */}
        <main id="admin-main" className={styles.main} tabIndex={-1}>
          {!isAuthorized ? (
            <div className={styles.restrictedBanner} role="alert">
              <h2 className={styles.restrictedTitle}>Acceso no autorizado</h2>
              <p className={styles.restrictedText}>
                El rol <strong>Cajero / Operador (CASHIER)</strong> no tiene acceso
                al panel administrativo. Su ámbito de trabajo se encuentra en el Punto
                de Venta.
              </p>
              <Link href="/pos" className={styles.posRedirectButton}>
                Ir al Punto de Venta (POS)
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Keyboard shortcuts modal */}
      {isShortcutsOpen && (
        <>
          <div
            className={styles.backdrop}
            onClick={() => setIsShortcutsOpen(false)}
            aria-hidden="true"
          />
          <div
            className={styles.modalDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-dialog-title"
          >
            <div className={styles.modalHeader}>
              <h3 id="shortcuts-dialog-title" className={styles.modalTitle}>
                Atajos de teclado
              </h3>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setIsShortcutsOpen(false)}
                aria-label="Cerrar ayuda de atajos"
              >
                ✕
              </button>
            </div>
            <table className={styles.shortcutTable}>
              <thead>
                <tr>
                  <th scope="col">Atajo</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {KEYBOARD_SHORTCUTS.map((item) => (
                  <tr key={item.key}>
                    <td>
                      <kbd className={styles.shortcutKbd}>{item.key}</kbd>
                    </td>
                    <td>{item.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminShell;
