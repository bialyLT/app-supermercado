import React from "react";
import styles from "../../../components/purchases/purchases.module.css";

export default function PurchasesLoading() {
  return (
    <div className={styles.container} role="status" aria-busy="true">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div
            style={{
              width: "280px",
              height: "32px",
              backgroundColor: "var(--color-surface-subtle, #e2e8f0)",
              borderRadius: "4px",
            }}
          />
          <div
            style={{
              width: "400px",
              height: "16px",
              backgroundColor: "var(--color-surface-subtle, #f1f5f9)",
              borderRadius: "4px",
              marginTop: "8px",
            }}
          />
        </div>
      </div>

      <div
        style={{
          width: "100%",
          height: "400px",
          backgroundColor: "#ffffff",
          border: "1px solid var(--color-border, #cbd5e1)",
          borderRadius: "8px",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted, #64748b)",
        }}
      >
        <span>Cargando interfaz de compras y recepción…</span>
      </div>
    </div>
  );
}
