import React from "react";
import styles from "./loading.module.css";

export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className={styles.loading}>
      <div aria-hidden="true" className={styles.spinner} />
      <span className={styles.message}>Cargando panel de administración…</span>
    </div>
  );
}
