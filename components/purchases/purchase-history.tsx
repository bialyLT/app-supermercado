"use client";

import React, { useState } from "react";
import type { PurchaseReceiptSummary } from "./types";
import { Modal } from "../modal";
import { Button } from "../ui/button";
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
        <span className={styles.emptyIcon}>🧾</span>
        <h3 className={styles.emptyTitle}>No hay comprobantes de compra registrados</h3>
        <p className={styles.emptyText}>
          Complete el formulario de recepción para ingresar la primera compra del proveedor.
        </p>
        {onRefresh && (
          <Button type="button" variant="secondary" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Actualizando…" : "Actualizar historial"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.historyContainer}>
      <div className={styles.historyToolbar}>
        <span className={styles.subtitle}>
          Se muestran los últimos {receipts.length} comprobantes de compra registrados en el sistema.
        </span>
        {onRefresh && (
          <Button type="button" variant="secondary" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Actualizando…" : "↻ Actualizar"}
          </Button>
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
              <th className={styles.actionHeader}>Acción</th>
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
                  <td className={styles.nowrapCell}>{dateStr}</td>
                  <td>
                    <strong>{receipt.receiptNumber || receipt.id.slice(0, 8)}</strong>
                  </td>
                  <td>
                    {receipt.supplier ? (
                      <span>
                        {receipt.supplier.name}{" "}
                        <span className={styles.supplierCode}>({receipt.supplier.code})</span>
                      </span>
                    ) : (
                      receipt.supplierId.slice(0, 8)
                    )}
                  </td>
                  <td>
                    <code className={styles.idCode}>{receipt.branchId.slice(0, 8)}…</code>
                  </td>
                  <td>{receipt.lines ? receipt.lines.length : "-"}</td>
                  <td className={styles.numberCell}>
                    {receipt.subtotal.toString()} {receipt.currency}
                  </td>
                  <td className={styles.numberCell}>
                    {receipt.taxTotal.toString()} {receipt.currency}
                  </td>
                  <td className={`${styles.numberCell} ${styles.numberCellStrong}`}>
                    {receipt.total.toString()} {receipt.currency}
                  </td>
                  <td className={styles.actionHeader}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedReceipt(receipt)}
                    >
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedReceipt && (
        <Modal ariaLabelledBy="receipt-detail-title" onRequestClose={() => setSelectedReceipt(null)}>
          <div className={`${styles.modalContent} ${styles.modalContentWide}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="receipt-detail-title" className={`${styles.title} ${styles.modalTitle}`}>
                  Comprobante: {selectedReceipt.receiptNumber || selectedReceipt.id}
                </h2>
                <span className={styles.subtitle}>
                  ID: <code className={styles.idCode}>{selectedReceipt.id}</code>
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Cerrar detalle"
              >
                ✕
              </Button>
            </div>

            <div className={`${styles.grid2} ${styles.detailGrid}`}>
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
                <code className={styles.idCodeSmall}>{selectedReceipt.idempotencyKey}</code>
              </div>
              {selectedReceipt.notes && (
                <div className={styles.gridFullWidth}>
                  <strong>Notas:</strong> {selectedReceipt.notes}
                </div>
              )}
            </div>

            <h3 className={styles.modalSubtitle}>
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
                        <code className={styles.idCode}>{line.variantId}</code>
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
                      <td className={`${styles.numberCell} ${styles.numberCellSemibold}`}>
                        {line.total.toString()} {selectedReceipt.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`${styles.totalsCard} ${styles.totalsCardModal}`}>
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

            <div className={styles.modalFooter}>
              <Button type="button" variant="secondary" onClick={() => setSelectedReceipt(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
