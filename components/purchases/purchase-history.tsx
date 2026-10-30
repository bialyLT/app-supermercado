"use client";

import React, { useState } from "react";
import type { PurchaseReceiptSummary } from "./types";
import styles from "./purchases.module.css";

export type PurchaseHistoryProps = {
  receipts: PurchaseReceiptSummary[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export function PurchaseHistory({
  receipts,
  onRefresh,
  isRefreshing = false,
}: PurchaseHistoryProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceiptSummary | null>(null);

  if (receipts.length === 0) {
    return (
      <div className={styles.emptyCard} role="status">
        <span style={{ fontSize: "2rem" }}>🧾</span>
        <h3 style={{ margin: 0, color: "var(--color-text)" }}>
          No hay comprobantes de compra registrados
        </h3>
        <p style={{ margin: 0 }}>
          Complete el formulario de recepción para ingresar la primera compra del proveedor.
        </p>
        {onRefresh && (
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{ marginTop: "12px" }}
          >
            {isRefreshing ? "Actualizando…" : "Actualizar historial"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className={styles.subtitle}>
          Se muestran los últimos {receipts.length} comprobantes de compra registrados en el sistema.
        </span>
        {onRefresh && (
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{ minHeight: "36px", padding: "6px 14px", fontSize: "0.85rem" }}
          >
            {isRefreshing ? "Actualizando…" : "↻ Actualizar"}
          </button>
        )}
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.historyTable} aria-label="Historial de comprobantes de compra">
          <thead>
            <tr>
              <th>Fecha Recepción</th>
              <th>N° Comprobante</th>
              <th>Proveedor</th>
              <th>Sucursal</th>
              <th>Líneas</th>
              <th>Subtotal</th>
              <th>Impuestos</th>
              <th>Total</th>
              <th style={{ textAlign: "center" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => {
              const dateStr = receipt.receivedAt
                ? new Date(receipt.receivedAt).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "-";

              return (
                <tr key={receipt.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{dateStr}</td>
                  <td>
                    <strong>{receipt.receiptNumber || receipt.id.slice(0, 8)}</strong>
                  </td>
                  <td>
                    {receipt.supplier ? (
                      <span>
                        {receipt.supplier.name}{" "}
                        <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                          ({receipt.supplier.code})
                        </span>
                      </span>
                    ) : (
                      receipt.supplierId.slice(0, 8)
                    )}
                  </td>
                  <td>
                    <code style={{ fontSize: "0.8rem" }}>{receipt.branchId.slice(0, 8)}…</code>
                  </td>
                  <td>{receipt.lines ? receipt.lines.length : "-"}</td>
                  <td className={styles.numberCell}>
                    {receipt.subtotal.toString()} {receipt.currency}
                  </td>
                  <td className={styles.numberCell}>
                    {receipt.taxTotal.toString()} {receipt.currency}
                  </td>
                  <td className={styles.numberCell} style={{ fontWeight: 700, color: "var(--color-text)" }}>
                    {receipt.total.toString()} {receipt.currency}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => setSelectedReceipt(receipt)}
                      style={{ minHeight: "32px", padding: "4px 10px", fontSize: "0.8rem" }}
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedReceipt && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-detail-title"
        >
          <div className={styles.modalContent} style={{ maxWidth: "800px" }}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="receipt-detail-title" className={styles.title} style={{ fontSize: "1.25rem" }}>
                  Comprobante: {selectedReceipt.receiptNumber || selectedReceipt.id}
                </h2>
                <span className={styles.subtitle}>
                  ID: <code style={{ fontSize: "0.8rem" }}>{selectedReceipt.id}</code>
                </span>
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedReceipt(null)}
                aria-label="Cerrar detalle"
                style={{ minHeight: "32px", padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div className={styles.grid2} style={{ fontSize: "0.9rem" }}>
              <div>
                <strong>Proveedor:</strong>{" "}
                {selectedReceipt.supplier
                  ? `${selectedReceipt.supplier.name} (${selectedReceipt.supplier.code})`
                  : selectedReceipt.supplierId}
              </div>
              <div>
                <strong>Moneda:</strong> {selectedReceipt.currency}
              </div>
              <div>
                <strong>Sucursal:</strong> <code>{selectedReceipt.branchId}</code>
              </div>
              <div>
                <strong>Ubicación:</strong> <code>{selectedReceipt.locationId}</code>
              </div>
              <div>
                <strong>Fecha Recepción:</strong>{" "}
                {new Date(selectedReceipt.receivedAt).toLocaleString("es-AR")}
              </div>
              <div>
                <strong>Clave Idempotencia:</strong>{" "}
                <code style={{ fontSize: "0.75rem" }}>{selectedReceipt.idempotencyKey}</code>
              </div>
              {selectedReceipt.notes && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <strong>Notas:</strong> {selectedReceipt.notes}
                </div>
              )}
            </div>

            <h3 style={{ fontSize: "1rem", margin: "12px 0 6px 0", color: "var(--color-text)" }}>
              Líneas del comprobante ({selectedReceipt.lines?.length ?? 0})
            </h3>

            <div className={styles.tableWrapper}>
              <table className={styles.linesTable} aria-label="Líneas del comprobante seleccionado">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Variante UUID</th>
                    <th>Cantidad</th>
                    <th>Costo Unit.</th>
                    <th>Subtotal</th>
                    <th>IVA</th>
                    <th>Total Línea</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipt.lines?.map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <code style={{ fontSize: "0.8rem" }}>{line.variantId}</code>
                      </td>
                      <td className={styles.numberCell}>{line.quantity.toString()}</td>
                      <td className={styles.numberCell}>
                        {line.unitCost.toString()} {selectedReceipt.currency}
                      </td>
                      <td className={styles.numberCell}>
                        {line.subtotal.toString()} {selectedReceipt.currency}
                      </td>
                      <td className={styles.numberCell}>
                        {line.taxAmount.toString()} {selectedReceipt.currency}
                      </td>
                      <td className={styles.numberCell} style={{ fontWeight: 600 }}>
                        {line.total.toString()} {selectedReceipt.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.totalsCard} style={{ alignSelf: "flex-end", minWidth: "260px" }}>
              <div className={styles.totalsRow}>
                <span>Subtotal:</span>
                <span className={styles.numberCell}>
                  {selectedReceipt.subtotal.toString()} {selectedReceipt.currency}
                </span>
              </div>
              <div className={styles.totalsRow}>
                <span>Descuento:</span>
                <span className={styles.numberCell}>
                  -{selectedReceipt.discountTotal.toString()} {selectedReceipt.currency}
                </span>
              </div>
              <div className={styles.totalsRow}>
                <span>Impuestos:</span>
                <span className={styles.numberCell}>
                  +{selectedReceipt.taxTotal.toString()} {selectedReceipt.currency}
                </span>
              </div>
              <div className={styles.totalsRowFinal}>
                <span>Total:</span>
                <span>
                  {selectedReceipt.total.toString()} {selectedReceipt.currency}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedReceipt(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
