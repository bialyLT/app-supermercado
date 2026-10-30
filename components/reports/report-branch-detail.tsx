import React from "react";
import type { BranchReport, OperationalBranch } from "./types";
import { formatCurrencyAmount, resolveBranchName } from "./types";
import styles from "./reports.module.css";

export type ReportBranchDetailProps = {
  branches: BranchReport[];
  operationalBranches?: OperationalBranch[];
  currency?: string | null;
};

export function ReportBranchDetail({
  branches,
  operationalBranches = [],
  currency,
}: ReportBranchDetailProps) {
  if (branches.length === 0) {
    return (
      <div className={styles.emptyState} role="status">
        <p>No se registraron movimientos en las sucursales para el período seleccionado.</p>
      </div>
    );
  }

  return (
    <section className={styles.summarySection} aria-labelledby="branch-detail-heading">
      <div className={styles.sectionHeader}>
        <h2 id="branch-detail-heading" className={styles.sectionTitle}>
          Detalle Operativo por Sucursal
        </h2>
      </div>

      <div className={styles.tableWrapper}>
        <table
          className={styles.table}
          aria-label="Detalle operativo desagregado por sucursal"
        >
          <thead>
            <tr>
              <th scope="col" className={styles.th}>Sucursal</th>
              <th scope="col" className={`${styles.th} ${styles.numericCell}`}>Ventas (Cant.)</th>
              <th scope="col" className={`${styles.th} ${styles.numericCell}`}>Ventas (Total)</th>
              <th scope="col" className={`${styles.th} ${styles.numericCell}`}>Compras (Cant.)</th>
              <th scope="col" className={`${styles.th} ${styles.numericCell}`}>Compras (Total)</th>
              <th scope="col" className={`${styles.th} ${styles.numericCell}`}>Stock On-Hand</th>
              <th scope="col" className={`${styles.th} ${styles.numericCell}`}>Transf. Salientes</th>
              <th scope="col" className={`${styles.th} ${styles.numericCell}`}>Transf. Entrantes</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => {
              const displayName = resolveBranchName(b.branchId, operationalBranches);
              return (
                <tr key={b.branchId} className={styles.tr}>
                  <td className={styles.td}>
                    <strong>{displayName}</strong>
                  </td>
                  <td className={`${styles.td} ${styles.numericCell}`}>{b.salesCount}</td>
                  <td className={`${styles.td} ${styles.numericCell}`}>
                    {formatCurrencyAmount(b.salesTotal, currency)}
                  </td>
                  <td className={`${styles.td} ${styles.numericCell}`}>{b.purchaseCount}</td>
                  <td className={`${styles.td} ${styles.numericCell}`}>
                    {formatCurrencyAmount(b.purchaseTotal, currency)}
                  </td>
                  <td className={`${styles.td} ${styles.numericCell}`}>{b.stockQuantity}</td>
                  <td className={`${styles.td} ${styles.numericCell}`}>{b.transferOutQuantity}</td>
                  <td className={`${styles.td} ${styles.numericCell}`}>{b.transferInQuantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
