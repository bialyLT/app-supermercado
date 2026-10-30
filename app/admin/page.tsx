import React from "react";
import Link from "next/link";
import styles from "./admin-dashboard.module.css";
import { ADMIN_NAV_ITEMS } from "../../components/admin-navigation";

export default function AdminPage() {
  const adminModules = ADMIN_NAV_ITEMS.filter((item) => item.href !== "/admin");

  return (
    <div className={styles.dashboard}>
      <section className={styles.welcomeSection}>
        <h1 className={styles.title}>Panel Operativo y Administrativo</h1>
        <p className={styles.subtitle}>
          Seleccione un módulo para gestionar las operaciones del tenant o utilice
          los atajos de teclado para una navegación rápida.
        </p>
      </section>

      <section className={styles.hintsBox} aria-label="Consejo de accesibilidad">
        <div className={styles.hintsTitle}>⚡ Navegación rápida por teclado</div>
        <div>
          Presione <kbd>Alt+K</kbd> o <kbd>?</kbd> en cualquier momento para ver la
          lista de atajos disponibles. Para ir directamente al Punto de Venta use{" "}
          <kbd>Alt+P</kbd>.
        </div>
      </section>

      <div className={styles.grid}>
        {adminModules.map((mod) => (
          <Link key={mod.href} href={mod.href} className={styles.card}>
            <div>
              <h2 className={styles.cardTitle}>
                <span>{mod.label}</span>
              </h2>
              <p className={styles.cardDescription}>{mod.description}</p>
            </div>
            {mod.shortcut && (
              <div className={styles.cardFooter}>
                <span className={styles.shortcutBadge}>{mod.shortcut}</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
