import React from "react";
import styles from "../../../components/purchases/purchases.module.css";

export default function PurchasesLoading() {
  return (
    <div className={styles.container} role="status" aria-busy="true">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.skeletonTitle} />
          <div className={styles.skeletonSubtitle} />
        </div>
      </div>

      <div className={styles.skeletonPanel}>
        <span>Cargando interfaz de compras y recepción…</span>
      </div>
    </div>
  );
}
