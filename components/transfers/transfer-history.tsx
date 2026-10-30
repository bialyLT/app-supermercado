"use client";

import React from "react";
import type { TransferSummary } from "./types";
import styles from "./transfers.module.css";

export type TransferHistoryProps = {
  transfers: TransferSummary[];
};

export function TransferHistory({ transfers }: TransferHistoryProps) {
  if (transfers.length === 0) {
    return (
      <div className={styles.linesSection} role="region" aria-label="Historial de transferencias">
        <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--color-text-muted, #64748b)" }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem 0" }}>
            No hay transferencias registradas
          </p>
          <p style={{ fontSize: "0.875rem", margin: 0 }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {transfers.map((t) => {
          const originName = t.originBranchName || t.originBranchId;
          const destName = t.destinationBranchName || t.destinationBranchId;
          const originLoc = t.originLocationName || t.originLocationId;
          const destLoc = t.destinationLocationName || t.destinationLocationId;
          const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleString("es-AR") : "Reciente";

          return (
            <article
              key={t.id}
              className={styles.historyCard}
              aria-label={`Transferencia ${t.id} de ${originName} a ${destName}`}
              tabIndex={0}
            >
              <div className={styles.historyCardHeader}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <div className={styles.historyRoute}>
                    {originName} → {destName}
                  </div>
                  <div className={styles.helperText}>
                    <span>Depósitos: {originLoc} → {destLoc}</span>
                    <span style={{ margin: "0 0.5rem" }}>•</span>
                    <time dateTime={t.createdAt}>{dateStr}</time>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className={styles.badge}>
                    {t.status === "COMPLETED" ? "COMPLETADA" : t.status}
                  </span>
                </div>
              </div>

              {t.reason && (
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text, #334155)" }}>
                  <strong>Motivo:</strong> {t.reason}
                </div>
              )}

              <div className={styles.tableContainer}>
                <table className={styles.table} aria-label={`Líneas de transferencia ${t.id}`}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Variante / Producto</th>
                      <th className={styles.th}>Lote</th>
                      <th className={styles.th} style={{ textAlign: "right" }}>Cantidad Despachada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.lines.map((l, idx) => (
                      <tr key={l.id || `hist-line-${idx}`}>
                        <td className={styles.td}>
                          <div style={{ fontWeight: 600 }}>
                            {l.variantName || l.sku || l.variantId}
                          </div>
                          {l.sku && l.variantName && (
                            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted, #64748b)" }}>
                              SKU: {l.sku}
                            </div>
                          )}
                        </td>
                        <td className={styles.td}>
                          {l.lotId ? (
                            <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{l.lotId}</span>
                          ) : (
                            <span style={{ color: "var(--color-text-muted, #94a3b8)" }}>Sin lote</span>
                          )}
                        </td>
                        <td className={styles.td} style={{ textAlign: "right", fontWeight: 700 }}>
                          {l.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--color-text-muted, #94a3b8)" }}>
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
