"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  OperationalContext,
  TransferFormState,
  TransferSummary,
} from "./types";
import { formatTransferPayload, mapTransferErrorMessage } from "./types";
import { TransferForm } from "./transfer-form";
import { TransferHistory } from "./transfer-history";
import styles from "./transfers.module.css";

export type TransferManagerProps = {
  initialTransfers?: TransferSummary[];
  initialContext?: OperationalContext | null;
};

export function TransferManager({
  initialTransfers = [],
  initialContext = null,
}: TransferManagerProps) {
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [transfers, setTransfers] = useState<TransferSummary[]>(initialTransfers);
  const [context, setContext] = useState<OperationalContext | null>(initialContext);
  const [contextLoading, setContextLoading] = useState<boolean>(!initialContext);
  const [contextError, setContextError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastSubmittedTransfer, setLastSubmittedTransfer] = useState<TransferSummary | null>(null);

  // Load operational context (branches and active locations) from /api/admin/context if not preloaded
  useEffect(() => {
    if (!initialContext) {
      fetch("/api/admin/context")
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Error al cargar contexto de sucursales");
          }
          return res.json() as Promise<OperationalContext>;
        })
        .then((ctx) => {
          setContext(ctx);
          setContextLoading(false);
        })
        .catch((err) => {
          setContextError(err instanceof Error ? err.message : "Error al cargar contexto operativo");
          setContextLoading(false);
        });
    }
  }, [initialContext]);

  const handleSubmitTransfer = useCallback(
    async (formData: TransferFormState): Promise<boolean> => {
      setIsSubmitting(true);
      setServerError(null);

      try {
        const payload = formatTransferPayload(formData);

        const res = await fetch("/api/admin/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.issues && Array.isArray(data.issues)) {
            const issueMsgs = data.issues.map((i: { message: string }) => i.message).join(", ");
            setServerError(`Error de validación: ${issueMsgs}`);
          } else {
            setServerError(mapTransferErrorMessage(res.status, data.detail || data.error));
          }
          return false;
        }

        // Enrich transfer with readable branch/location names from context
        const originBranch = context?.branches.find((b) => b.id === data.originBranchId);
        const destBranch = context?.branches.find((b) => b.id === data.destinationBranchId);
        const originLoc = originBranch?.locations.find((l) => l.id === data.originLocationId);
        const destLoc = destBranch?.locations.find((l) => l.id === data.destinationLocationId);

        const createdTransfer: TransferSummary = {
          id: data.id,
          originBranchId: data.originBranchId,
          destinationBranchId: data.destinationBranchId,
          originLocationId: data.originLocationId,
          destinationLocationId: data.destinationLocationId,
          originBranchName: originBranch ? `${originBranch.name} (${originBranch.code})` : data.originBranchId,
          destinationBranchName: destBranch ? `${destBranch.name} (${destBranch.code})` : data.destinationBranchId,
          originLocationName: originLoc ? `${originLoc.name} (${originLoc.code})` : data.originLocationId,
          destinationLocationName: destLoc ? `${destLoc.name} (${destLoc.code})` : data.destinationLocationId,
          reason: data.reason,
          status: data.status || "COMPLETED",
          createdAt: data.createdAt || new Date().toISOString(),
          idempotencyKey: data.idempotencyKey,
          lines: (data.lines || []).map((l: { id?: string; variantId: string; lotId?: string | null; quantity: string | { toString(): string } }, idx: number) => {
            const matchedFormLine = formData.lines[idx];
            return {
              id: l.id,
              variantId: l.variantId,
              variantName: matchedFormLine?.variantName || l.variantId,
              sku: matchedFormLine?.sku,
              lotId: l.lotId,
              quantity: typeof l.quantity === "object" ? l.quantity.toString() : String(l.quantity),
            };
          }),
        };

        setLastSubmittedTransfer(createdTransfer);
        setTransfers((prev) => [createdTransfer, ...prev]);
        return true;
      } catch (err) {
        setServerError(err instanceof Error ? err.message : "Error de red al procesar la transferencia");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [context]
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Transferencias entre Sucursales</h1>
          <p className={styles.subtitle}>
            Movimientos de stock entre sucursales y depósitos con validación atómica e idempotencia.
          </p>
        </div>

        <div className={styles.shortcutsBar} aria-label="Atajos de teclado">
          <span>⚡ Atajos:</span>
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Alt+N</kbd> Nueva línea
          </span>
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Alt+D</kbd> Despachar
          </span>
        </div>
      </header>

      {contextError && (
        <div className={`${styles.alertBanner} ${styles.alertError}`} role="alert" aria-live="assertive">
          <span className={styles.alertTitle}>Error de contexto operativo</span>
          <span>{contextError}</span>
        </div>
      )}

      {lastSubmittedTransfer && (
        <aside
          className={`${styles.alertBanner} ${styles.alertSuccess}`}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <span className={styles.alertTitle}>
              ✓ ¡Transferencia despachada con éxito!
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => {
                  setActiveTab("history");
                  setLastSubmittedTransfer(null);
                }}
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
              >
                Ver en historial
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setLastSubmittedTransfer(null)}
                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          </div>
          <div>
            Movimiento registrado: <strong>{lastSubmittedTransfer.originBranchName}</strong> →{" "}
            <strong>{lastSubmittedTransfer.destinationBranchName}</strong> (ID: {lastSubmittedTransfer.id}).
            Stock debitado y acreditado automáticamente.
          </div>
        </aside>
      )}

      <nav className={styles.tabs} aria-label="Pestañas de transferencias">
        <button
          type="button"
          className={`${styles.tab} ${activeTab === "form" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("form")}
          aria-selected={activeTab === "form"}
          role="tab"
        >
          Nueva Transferencia
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === "history" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("history")}
          aria-selected={activeTab === "history"}
          role="tab"
        >
          Transferencias Recientes
          {transfers.length > 0 && (
            <span className={styles.tabBadge}>{transfers.length}</span>
          )}
        </button>
      </nav>

      <main>
        {activeTab === "form" ? (
          <TransferForm
            branches={context?.branches ?? []}
            onSubmit={handleSubmitTransfer}
            isSubmitting={isSubmitting}
            serverError={serverError}
            onClearServerError={() => setServerError(null)}
            contextLoading={contextLoading}
          />
        ) : (
          <TransferHistory transfers={transfers} />
        )}
      </main>
    </div>
  );
}
