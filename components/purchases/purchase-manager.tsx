"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  CalculatedReceiptPreview,
  OperationalContext,
  PurchaseFormState,
  PurchaseReceiptSummary,
  Supplier,
} from "./types";
import { PurchaseForm } from "./purchase-form";
import { PurchaseHistory } from "./purchase-history";
import styles from "./purchases.module.css";

export type PurchaseManagerProps = {
  initialSuppliers?: Supplier[];
  initialReceipts?: PurchaseReceiptSummary[];
  initialContext?: OperationalContext | null;
  defaultBranchId?: string;
  defaultLocationId?: string;
};

export function PurchaseManager({
  initialSuppliers = [],
  initialReceipts = [],
  initialContext = null,
  defaultBranchId = "",
  defaultLocationId = "",
}: PurchaseManagerProps) {
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [receipts, setReceipts] = useState<PurchaseReceiptSummary[]>(initialReceipts);
  const [context, setContext] = useState<OperationalContext | null>(initialContext);
  const [contextLoading, setContextLoading] = useState<boolean>(!initialContext);
  const [contextError, setContextError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<string>(() => {
    if (defaultBranchId) return defaultBranchId;
    if (initialContext?.branches.length === 1) return initialContext.branches[0].id;
    return "";
  });
  const [locationId, setLocationId] = useState<string>(() => {
    if (defaultLocationId) return defaultLocationId;
    if (initialContext?.branches.length === 1) {
      const activeLocs = initialContext.branches[0].locations.filter((l) => l.active);
      if (activeLocs.length === 1) return activeLocs[0].id;
    }
    return "";
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastSubmittedReceipt, setLastSubmittedReceipt] = useState<PurchaseReceiptSummary | null>(null);

  // Load operational context (branches and active locations) from /api/admin/context
  useEffect(() => {
    if (!initialContext) {
      fetch("/api/admin/context")
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Error al cargar contexto operativo");
          }
          return res.json() as Promise<OperationalContext>;
        })
        .then((ctx) => {
          setContext(ctx);
          setContextLoading(false);

          // Auto-select single branch if available and none selected
          if (!branchId && ctx.branches.length === 1) {
            const singleBranch = ctx.branches[0];
            setBranchId(singleBranch.id);
            const activeLocs = singleBranch.locations.filter((l) => l.active);
            if (!locationId && activeLocs.length === 1) {
              setLocationId(activeLocs[0].id);
            }
          }
        })
        .catch((err) => {
          setContextError(err instanceof Error ? err.message : "Error al cargar sucursales");
          setContextLoading(false);
        });
    }
  }, [branchId, initialContext, locationId]);

  // Load suppliers if empty on mount
  useEffect(() => {
    if (suppliers.length === 0) {
      fetch("/api/admin/purchases/suppliers")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.suppliers) {
            setSuppliers(data.suppliers);
          }
        })
        .catch(() => {
          // Keep empty or initial state
        });
    }
  }, [suppliers.length]);

  const loadReceipts = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const url = branchId
        ? `/api/admin/purchases?branchId=${encodeURIComponent(branchId)}`
        : "/api/admin/purchases";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.receipts) {
          setReceipts(data.receipts);
        }
      }
    } catch {
      // Retain existing receipts on network error
    } finally {
      setIsRefreshing(false);
    }
  }, [branchId]);

  const handleSupplierCreated = useCallback((newSupplier: Supplier) => {
    setSuppliers((prev) => [newSupplier, ...prev]);
  }, []);

  const handleSubmitReceipt = useCallback(
    async (formData: PurchaseFormState, preview: CalculatedReceiptPreview): Promise<boolean> => {
      setIsSubmitting(true);
      setServerError(null);

      try {
        const payload = {
          supplierId: formData.supplierId.trim(),
          branchId: formData.branchId.trim(),
          locationId: formData.locationId.trim(),
          receiptNumber: formData.receiptNumber.trim() || undefined,
          issuedAt: formData.issuedAt ? new Date(formData.issuedAt).toISOString() : undefined,
          currency: formData.currency,
          subtotal: preview.subtotal,
          taxTotal: preview.taxTotal,
          discountTotal: preview.discountTotal,
          total: preview.total,
          notes: formData.notes.trim() || undefined,
          idempotencyKey: formData.idempotencyKey.trim(),
          lines: formData.lines.map((l) => ({
            variantId: l.variantId.trim(),
            lotNumber: l.lotNumber?.trim() || undefined,
            expiresAt: l.expiresAt ? new Date(l.expiresAt).toISOString() : undefined,
            quantity: l.quantity.trim(),
            unitCost: l.unitCost.trim(),
            taxRate: l.taxRate?.trim() || undefined,
            taxAmount: l.taxAmount?.trim() || undefined,
            discountAmount: l.discountAmount?.trim() || undefined,
          })),
        };

        const res = await fetch("/api/admin/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            setServerError("Conflicto de idempotencia: el comprobante ya fue registrado con esta clave.");
          } else if (res.status === 403) {
            setServerError("Permisos insuficientes: el usuario no tiene permisos de recepción para esta sucursal.");
          } else if (res.status === 404) {
            setServerError(`Recurso no encontrado: ${data.detail || "verifique los IDs de sucursal, depósito y proveedor."}`);
          } else if (data.issues && Array.isArray(data.issues)) {
            const issueMsgs = data.issues.map((i: { message: string }) => i.message).join(", ");
            setServerError(`Error de validación del servidor: ${issueMsgs}`);
          } else {
            setServerError(data.detail || data.error || "Error al registrar comprobante");
          }
          return false;
        }

        // Successfully created! Attach matching supplier object if available
        const createdReceipt: PurchaseReceiptSummary = {
          ...data,
          supplier: suppliers.find((s) => s.id === data.supplierId) ?? data.supplier,
        };

        setLastSubmittedReceipt(createdReceipt);
        setReceipts((prev) => [createdReceipt, ...prev]);
        return true;
      } catch (err) {
        setServerError(err instanceof Error ? err.message : "Error de red al registrar comprobante");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [suppliers]
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Gestión de Compras y Recepción</h1>
          <p className={styles.subtitle}>
            Recepción operativa de mercadería directa de proveedores con cálculo Decimal exacto e idempotencia estricta.
          </p>
        </div>

        <div className={styles.shortcutsBar} aria-label="Atajos de teclado rápidos">
          <span>⚡ Atajos:</span>
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Alt+N</kbd> Nueva línea
          </span>
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Alt+G</kbd> Registrar
          </span>
        </div>
      </header>

      {contextError && (
        <div className={styles.alertBanner} role="alert" aria-live="assertive">
          <span className={styles.alertTitle}>Error de contexto operativo</span>
          <span>{contextError}</span>
        </div>
      )}

      {/* Post-Submit Success Notification Banner */}
      {lastSubmittedReceipt && (
        <aside
          className={`${styles.alertBanner} ${styles.alertSuccess}`}
          role="status"
          aria-live="polite"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={styles.alertTitle}>
              ✓ ¡Comprobante registrado con éxito!
            </span>
            <button
              type="button"
              onClick={() => setLastSubmittedReceipt(null)}
              style={{
                background: "none",
                border: "none",
                color: "#166534",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "1rem",
              }}
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
          <div>
            Comprobante <strong>{lastSubmittedReceipt.receiptNumber || lastSubmittedReceipt.id}</strong> por un total
            de{" "}
            <strong>
              {lastSubmittedReceipt.total.toString()} {lastSubmittedReceipt.currency}
            </strong>{" "}
            ({lastSubmittedReceipt.lines?.length ?? 1} líneas ingresadas al stock).
          </div>
          <div style={{ marginTop: "6px" }}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setActiveTab("history");
                setLastSubmittedReceipt(null);
              }}
              style={{ minHeight: "30px", padding: "4px 10px", fontSize: "0.8rem" }}
            >
              Ver en Historial
            </button>
          </div>
        </aside>
      )}

      {/* Primary Tab Navigation */}
      <nav className={styles.tabNavigation} aria-label="Secciones de compras">
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "form" ? styles.tabButtonActive : ""}`}
          onClick={() => setActiveTab("form")}
          aria-current={activeTab === "form" ? "page" : undefined}
        >
          <span>Registrar Comprobante</span>
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === "history" ? styles.tabButtonActive : ""}`}
          onClick={() => {
            setActiveTab("history");
            loadReceipts();
          }}
          aria-current={activeTab === "history" ? "page" : undefined}
        >
          <span>Historial de Compras</span>
          <span className={styles.badge}>{receipts.length}</span>
        </button>
      </nav>

      {/* Active Tab View */}
      <main id="purchases-content" role="region" aria-label="Contenido de compras">
        {activeTab === "form" ? (
          <PurchaseForm
            suppliers={suppliers}
            branches={context?.branches ?? []}
            branchId={branchId}
            locationId={locationId}
            onBranchChange={setBranchId}
            onLocationChange={setLocationId}
            onSubmit={handleSubmitReceipt}
            onSupplierCreated={handleSupplierCreated}
            isSubmitting={isSubmitting}
            serverError={serverError}
            onClearServerError={() => setServerError(null)}
            contextLoading={contextLoading}
          />
        ) : (
          <PurchaseHistory
            receipts={receipts}
            onRefresh={loadReceipts}
            isRefreshing={isRefreshing}
          />
        )}
      </main>
    </div>
  );
}
