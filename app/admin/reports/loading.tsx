import React from "react";
import styles from "../../../components/reports/reports.module.css";

export default function ReportsLoading() {
  return (
    <div className={styles.container} role="status" aria-busy="true">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div
            style={{
              width: "260px",
              height: "32px",
              backgroundColor: "var(--color-surface-subtle, #e2e8f0)",
              borderRadius: "4px",
            }}
          />
          <div
            style={{
              width: "380px",
              height: "16px",
              backgroundColor: "var(--color-surface-subtle, #f1f5f9)",
              borderRadius: "4px",
              marginTop: "8px",
            }}
          />
        </div>
      </div>

      <div className={styles.loadingSkeleton}>
        <div className={styles.spinner} />
        <span>Cargando interfaz de reportes operativos…</span>
      </div>
    </div>
  );
}
