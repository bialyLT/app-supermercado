"use client";

import React from "react";
import type { TransferSummary } from "./types";
import styles from "./transfers.module.css";
import { formatDateTime, formatQuantity } from "../../src/client/presentation";

export type TransferHistoryProps = {
  transfers: TransferSummary[];
};

export function TransferHistory({ transfers }: TransferHistoryProps) {
  if (transfers.length === 0) {
    return (
      <div className={styles.linesSection} role="region" aria-label="Historial de transferencias">
        <div className={styles.emptyHistory}>
          <p className={styles.emptyHistoryTitle}>
            No hay transferencias registradas
          </p>
          <p className={styles.emptyHistoryText}>
            Las transferencias despachadas aparecerán aquí con el detalle de sus movimientos entre depósitos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.historyContainer} role="region" aria-label="Historial de transferencias recientes">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          Transferencias Recientes ({transfers.length})
        </h2>
      </div>

      <div className={styles.historyList}>
        {transfers.map((t) => {
          const originName = t.originBranchName || t.originBranchId;
          const destName = t.destinationBranchName || t.destinationBranchId;
          const originLoc = t.originLocationName || t.originLocationId;
          const destLoc = t.destinationLocationName || t.destinationLocationId;
          const dateStr = t.createdAt ? formatDateTime(t.createdAt) : "Reciente";

          return (
            <article
              key={t.id}
              className={styles.historyCard}
              aria-label={`Transferencia ${t.id} de ${originName} a ${destName}`}
              tabIndex={0}
            >
              <div className={styles.historyCardHeader}>
                <div className={styles.historyMeta}>
                  <div className={styles.historyRoute}>
                    {originName} → {destName}
                  </div>
                  <div className={styles.helperText}>
                    <span>Depósitos: {originLoc} → {destLoc}</span>
                    <span className={styles.separator}>•</span>
                    <time dateTime={t.createdAt}>{dateStr}</time>
                  </div>
                </div>

                <div className={styles.historyStatus}>
                  <span className={styles.badge}>
                    {t.status === "COMPLETED" ? "COMPLETADA" : t.status}
                  </span>
                </div>
              </div>

              {t.reason && (
                <div className={styles.reason}>
                  <strong>Motivo:</strong> {t.reason}
                </div>
              )}

              <div className={styles.tableContainer}>
                <table className={styles.table} aria-label={`Líneas de transferencia ${t.id}`}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Variante / Producto</th>
                      <th className={styles.th}>Lote</th>
                      <th className={`${styles.th} ${styles.alignRight}`}>Cantidad Despachada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.lines.map((l, idx) => (
                      <tr key={l.id || `hist-line-${idx}`}>
                        <td className={styles.td}>
                          <div className={styles.variantName}>
                            {l.variantName || l.sku || l.variantId}
                          </div>
                          {l.sku && l.variantName && (
                            <div className={styles.sku}>
                              SKU: {l.sku}
                            </div>
                          )}
                        </td>
                        <td className={styles.td}>
                          {l.lotId ? (
                            <span className={styles.lot}>{l.lotId}</span>
                          ) : (
                            <span className={styles.muted}>Sin lote</span>
                          )}
                        </td>
                        <td className={`${styles.td} ${styles.alignRight} ${styles.quantity}`}>
                          {formatQuantity(l.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.historyFooter}>
                <span>ID: {t.id}</span>
                <span>Clave de Idempotencia: {t.idempotencyKey}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
