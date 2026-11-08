"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  OperationalContext,
  TransferFormState,
  TransferSummary,
} from "./types";
import { formatTransferPayload, mapTransferErrorMessage } from "./types";
import { TransferForm } from "./transfer-form";
import { TransferHistory } from "./transfer-history";
import styles from "./transfers.module.css";
import { apiFetch, errorMessage } from "../../src/client/api-fetch";

export type TransferManagerProps = {
  initialTransfers?: TransferSummary[];
  initialContext?: OperationalContext | null;
};

export function TransferManager({
  initialTransfers = [],
  initialContext = null,
}: TransferManagerProps) {
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
      apiFetch("/api/admin/context")
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

        const res = await apiFetch("/api/admin/transfers", {
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
        setServerError(errorMessage(err));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [context]
  );

  const tabKeys = ["form", "history"] as const;
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabKeys.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabKeys.length) % tabKeys.length;
    const nextTab = tabKeys[nextIndex];
    setActiveTab(nextTab);
    tabRefs.current[nextIndex]?.focus();
  };

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
          <div className={styles.alertHeader}>
            <span className={styles.alertTitle}>
              ✓ ¡Transferencia despachada con éxito!
            </span>
            <div className={styles.alertActions}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("history");
                  setLastSubmittedTransfer(null);
                }}
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnCompact}`}
              >
                Ver en historial
              </button>
              <button
                type="button"
                onClick={() => setLastSubmittedTransfer(null)}
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnIcon}`}
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

      <div className={styles.tabs} role="tablist" aria-label="Pestañas de transferencias">
        <button
          ref={(element) => { tabRefs.current[0] = element; }}
          id="transfer-tab-form"
          type="button"
          className={`${styles.tab} ${activeTab === "form" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("form")}
          onKeyDown={(event) => handleTabKeyDown(event, 0)}
          aria-selected={activeTab === "form"}
          aria-controls="transfer-panel-form"
          tabIndex={activeTab === "form" ? 0 : -1}
          role="tab"
        >
          Nueva Transferencia
        </button>
        <button
          ref={(element) => { tabRefs.current[1] = element; }}
          id="transfer-tab-history"
          type="button"
          className={`${styles.tab} ${activeTab === "history" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("history")}
          onKeyDown={(event) => handleTabKeyDown(event, 1)}
          aria-selected={activeTab === "history"}
          aria-controls="transfer-panel-history"
          tabIndex={activeTab === "history" ? 0 : -1}
          role="tab"
        >
          Transferencias Recientes
          {transfers.length > 0 && (
            <span className={styles.tabBadge}>{transfers.length}</span>
          )}
        </button>
      </div>

      <main>
        {activeTab === "form" ? (
          <section id="transfer-panel-form" role="tabpanel" aria-labelledby="transfer-tab-form" tabIndex={0}>
            <TransferForm
              branches={context?.branches ?? []}
              onSubmit={handleSubmitTransfer}
              isSubmitting={isSubmitting}
              serverError={serverError}
              onClearServerError={() => setServerError(null)}
              contextLoading={contextLoading}
            />
          </section>
        ) : (
          <section id="transfer-panel-history" role="tabpanel" aria-labelledby="transfer-tab-history" tabIndex={0}>
            <TransferHistory transfers={transfers} />
          </section>
        )}
      </main>
    </div>
  );
}
