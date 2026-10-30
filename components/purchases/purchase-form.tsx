"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  CalculatedReceiptPreview,
  FormValidationErrors,
  OperationalBranch,
  PurchaseFormState,
  PurchaseLineState,
  Supplier,
} from "./types";
import {
  calculateReceiptPreviewTotals,
  createEmptyPurchaseLine,
  createInitialPurchaseFormState,
  generateIdempotencyKey,
  validatePurchaseReceiptForm,
} from "./types";
import { SupplierModal } from "./supplier-modal";
import styles from "./purchases.module.css";

export type PurchaseFormProps = {
  suppliers: Supplier[];
  branches?: OperationalBranch[];
  branchId?: string;
  locationId?: string;
  onBranchChange?: (branchId: string) => void;
  onLocationChange?: (locationId: string) => void;
  onSubmit: (formData: PurchaseFormState, preview: CalculatedReceiptPreview) => Promise<boolean>;
  onSupplierCreated?: (newSupplier: Supplier) => void;
  isSubmitting?: boolean;
  serverError?: string | null;
  onClearServerError?: () => void;
  contextLoading?: boolean;
};

type CatalogSearchResult = {
  id: string;
  sku: string;
  name: string;
  productName: string;
};

export function PurchaseForm({
  suppliers,
  branches = [],
  branchId = "",
  locationId = "",
  onBranchChange,
  onLocationChange,
  onSubmit,
  onSupplierCreated,
  isSubmitting = false,
  serverError = null,
  onClearServerError,
  contextLoading = false,
}: PurchaseFormProps) {
  const [form, setForm] = useState<PurchaseFormState>(() =>
    createInitialPurchaseFormState({ branchId, locationId })
  );
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Variant search state per line
  const [activeSearchLineIndex, setActiveSearchLineIndex] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<CatalogSearchResult[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback to prop values if not overridden locally
  const currentBranchId = form.branchId || branchId;
  const currentLocationId = form.locationId || locationId;

  // Selected branch and its active locations derived from server context
  const selectedBranch = branches.find((b) => b.id === currentBranchId);
  const availableLocations = selectedBranch?.locations?.filter((l) => l.active) ?? [];

  // Decimal preview totals calculated automatically
  const preview = calculateReceiptPreviewTotals(form.lines, form.currency);

  const handleAddLine = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyPurchaseLine()],
    }));
  }, []);

  const handleRemoveLine = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) {
        return { ...prev, lines: [createEmptyPurchaseLine()] };
      }
      return {
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index),
      };
    });
  }, []);

  const handleDuplicateLine = useCallback((index: number) => {
    setForm((prev) => {
      const source = prev.lines[index];
      const duplicated: PurchaseLineState = {
        ...source,
        id: generateIdempotencyKey(),
      };
      const nextLines = [...prev.lines];
      nextLines.splice(index + 1, 0, duplicated);
      return { ...prev, lines: nextLines };
    });
  }, []);

  const handleLineChange = useCallback(
    (index: number, field: keyof PurchaseLineState, value: string) => {
      setForm((prev) => {
        const nextLines = [...prev.lines];
        nextLines[index] = { ...nextLines[index], [field]: value };
        return { ...prev, lines: nextLines };
      });
      if (errors.lineErrors?.[index]) {
        setErrors((prev) => {
          const nextLineErrors = { ...prev.lineErrors };
          delete nextLineErrors[index];
          return { ...prev, lineErrors: nextLineErrors };
        });
      }
      if (onClearServerError) onClearServerError();
    },
    [errors.lineErrors, onClearServerError]
  );

  // Search catalog for variant autocomplete
  const handleVariantQueryChange = useCallback(
    (index: number, query: string) => {
      handleLineChange(index, "variantName", query);

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      if (!query.trim() || query.length < 2) {
        setSearchResults([]);
        setActiveSearchLineIndex(null);
        return;
      }

      setActiveSearchLineIndex(index);
      setIsSearchingCatalog(true);

      searchDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/pos/catalog?q=${encodeURIComponent(query.trim())}`);
          if (res.ok) {
            const data = (await res.json()) as { items?: CatalogSearchResult[] };
            setSearchResults(data.items ?? []);
          } else {
            setSearchResults([]);
          }
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearchingCatalog(false);
        }
      }, 250);
    },
    [handleLineChange]
  );

  const handleSelectVariant = useCallback(
    (index: number, item: CatalogSearchResult) => {
      setForm((prev) => {
        const nextLines = [...prev.lines];
        nextLines[index] = {
          ...nextLines[index],
          variantId: item.id,
          variantName: `${item.sku} - ${item.productName} (${item.name})`,
          sku: item.sku,
        };
        return { ...prev, lines: nextLines };
      });
      setActiveSearchLineIndex(null);
      setSearchResults([]);
    },
    []
  );

  const handleHeaderChange = useCallback(
    (field: keyof PurchaseFormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (field === "branchId" && onBranchChange) onBranchChange(value);
      if (field === "locationId" && onLocationChange) onLocationChange(value);
      if (errors[field as keyof FormValidationErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
      if (onClearServerError) onClearServerError();
    },
    [errors, onBranchChange, onClearServerError, onLocationChange]
  );

  const handleBranchSelect = useCallback(
    (selectedBranchId: string) => {
      handleHeaderChange("branchId", selectedBranchId);

      // Find the active locations for the selected branch
      const branchObj = branches.find((b) => b.id === selectedBranchId);
      const activeLocs = branchObj?.locations?.filter((l) => l.active) ?? [];

      if (activeLocs.length === 1) {
        // Automatically select the single active location
        handleHeaderChange("locationId", activeLocs[0].id);
      } else {
        // If current location does not belong to new branch, reset
        const stillValid = activeLocs.some((l) => l.id === currentLocationId);
        if (!stillValid) {
          handleHeaderChange("locationId", "");
        }
      }
    },
    [branches, currentLocationId, handleHeaderChange]
  );

  const handleRegenerateIdempotency = useCallback(() => {
    setForm((prev) => ({ ...prev, idempotencyKey: generateIdempotencyKey() }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const formToValidate: PurchaseFormState = {
        ...form,
        branchId: currentBranchId,
        locationId: currentLocationId,
      };
      const validationErrors = validatePurchaseReceiptForm(formToValidate, {
        allowedBranches: branches,
      });
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors({});
      const success = await onSubmit(formToValidate, preview);
      if (success) {
        // Reset form for next receipt while preserving context (branch, location, currency)
        setForm(
          createInitialPurchaseFormState({
            branchId: currentBranchId,
            locationId: currentLocationId,
            currency: form.currency,
          })
        );
      }
    },
    [branches, currentBranchId, currentLocationId, form, onSubmit, preview]
  );

  // Keyboard shortcuts within the form
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Alt+N or Alt+A: Add line
      if (e.altKey && (e.key === "n" || e.key === "N" || e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleAddLine();
      }
      // Alt+G or Alt+S: Submit form
      else if (e.altKey && (e.key === "g" || e.key === "G" || e.key === "s" || e.key === "S")) {
        e.preventDefault();
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        handleSubmit(fakeEvent);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAddLine, handleSubmit]);

  const hasNoBranches = !contextLoading && branches.length === 0;

  return (
    <div className={styles.formCard}>
      {hasNoBranches && (
        <div className={styles.alertBanner} role="status" aria-live="polite">
          <span className={styles.alertTitle}>Sin sucursales asignadas</span>
          <span>
            Su usuario no tiene sucursales asignadas con permisos de recepción de mercadería.
            Contacte al administrador del tenant para obtener asignación de sucursal.
          </span>
        </div>
      )}

      {serverError && (
        <div className={styles.alertBanner} role="alert" aria-live="assertive">
          <span className={styles.alertTitle}>Error al registrar comprobante</span>
          <span>{serverError}</span>
        </div>
      )}

      {errors.lines && (
        <div className={styles.alertBanner} role="alert">
          <span className={styles.alertTitle}>Validación de líneas</span>
          <span>{errors.lines}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Context and Supplier Selection */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px 0" }}>
          <legend className={styles.sectionTitle}>1. Datos del Comprobante y Contexto Operativo</legend>

          <div className={styles.grid3} style={{ marginBottom: "16px" }}>
            <div className={styles.fieldGroup}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="purchase-supplier" className={`${styles.label} ${styles.labelRequired}`}>
                  Proveedor
                </label>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-primary, #0284c7)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  + Nuevo
                </button>
              </div>
              <select
                id="purchase-supplier"
                className={`${styles.select} ${errors.supplierId ? styles.inputError : ""}`}
                value={form.supplierId}
                onChange={(e) => handleHeaderChange("supplierId", e.target.value)}
                disabled={isSubmitting}
                aria-required="true"
                aria-invalid={!!errors.supplierId}
              >
                <option value="">-- Seleccionar proveedor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) {s.taxId ? `- CUIT: ${s.taxId}` : ""}
                  </option>
                ))}
              </select>
              {errors.supplierId && <span className={styles.errorText}>{errors.supplierId}</span>}
            </div>

            {/* Server-Derived Branch Selector */}
            <div className={styles.fieldGroup}>
              <label htmlFor="purchase-branch" className={`${styles.label} ${styles.labelRequired}`}>
                Sucursal
              </label>
              <select
                id="purchase-branch"
                className={`${styles.select} ${errors.branchId ? styles.inputError : ""}`}
                value={currentBranchId}
                onChange={(e) => handleBranchSelect(e.target.value)}
                disabled={isSubmitting || hasNoBranches}
                aria-required="true"
                aria-invalid={!!errors.branchId}
              >
                {hasNoBranches ? (
                  <option value="">Sin sucursales asignadas</option>
                ) : (
                  <>
                    <option value="">-- Seleccionar sucursal --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {errors.branchId && <span className={styles.errorText}>{errors.branchId}</span>}
              <span className={styles.helperText}>
                {contextLoading ? "Cargando sucursales…" : "Sucursal autorizada del tenant"}
              </span>
            </div>

            {/* Server-Derived Active Location Selector */}
            <div className={styles.fieldGroup}>
              <label htmlFor="purchase-location" className={`${styles.label} ${styles.labelRequired}`}>
                Ubicación / Depósito
              </label>
              <select
                id="purchase-location"
                className={`${styles.select} ${errors.locationId ? styles.inputError : ""}`}
                value={currentLocationId}
                onChange={(e) => handleHeaderChange("locationId", e.target.value)}
                disabled={isSubmitting || !currentBranchId || availableLocations.length === 0}
                aria-required="true"
                aria-invalid={!!errors.locationId}
              >
                {!currentBranchId ? (
                  <option value="">-- Seleccione una sucursal primero --</option>
                ) : availableLocations.length === 0 ? (
                  <option value="">-- Sin ubicaciones activas en esta sucursal --</option>
                ) : (
                  <>
                    <option value="">-- Seleccionar ubicación --</option>
                    {availableLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code}) [{l.type}]
                      </option>
                    ))}
                  </>
                )}
              </select>
              {errors.locationId && <span className={styles.errorText}>{errors.locationId}</span>}
              <span className={styles.helperText}>
                {currentBranchId
                  ? `${availableLocations.length} ubicación(es) activa(s)`
                  : "Requiere selección de sucursal"}
              </span>
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.fieldGroup}>
              <label htmlFor="purchase-receipt-number" className={styles.label}>
                N° Comprobante / Factura
              </label>
              <input
                id="purchase-receipt-number"
                type="text"
                className={styles.input}
                value={form.receiptNumber}
                onChange={(e) => handleHeaderChange("receiptNumber", e.target.value)}
                placeholder="Ej. FAC-A-0001-00012345"
                disabled={isSubmitting}
              />
              <span className={styles.helperText}>Número fiscal o remito del proveedor</span>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="purchase-currency" className={`${styles.label} ${styles.labelRequired}`}>
                Moneda
              </label>
              <select
                id="purchase-currency"
                className={styles.select}
                value={form.currency}
                onChange={(e) => handleHeaderChange("currency", e.target.value)}
                disabled={isSubmitting}
              >
                <option value="ARS">ARS - Pesos Argentinos</option>
                <option value="USD">USD - Dólares Estadounidenses</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="purchase-issued-at" className={styles.label}>
                Fecha de Emisión
              </label>
              <input
                id="purchase-issued-at"
                type="date"
                className={styles.input}
                value={form.issuedAt}
                onChange={(e) => handleHeaderChange("issuedAt", e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className={styles.grid2} style={{ marginTop: "16px" }}>
            <div className={styles.fieldGroup}>
              <label htmlFor="purchase-notes" className={styles.label}>
                Observaciones / Notas
              </label>
              <input
                id="purchase-notes"
                type="text"
                className={styles.input}
                value={form.notes}
                onChange={(e) => handleHeaderChange("notes", e.target.value)}
                placeholder="Detalle de entrega, transporte o precinto"
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.fieldGroup}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="purchase-idempotency" className={styles.label}>
                  Clave Idempotencia (Protección contra duplicados)
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateIdempotency}
                  disabled={isSubmitting}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-primary, #0284c7)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    padding: 0,
                  }}
                  title="Generar nueva clave"
                >
                  ↻ Regenerar
                </button>
              </div>
              <input
                id="purchase-idempotency"
                type="text"
                className={styles.input}
                value={form.idempotencyKey}
                readOnly
                style={{ backgroundColor: "var(--color-surface-subtle, #f8fafc)", fontSize: "0.85rem" }}
              />
            </div>
          </div>
        </fieldset>

        {/* Multi-Line Entry Section */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <legend className={styles.sectionTitle} style={{ margin: 0, border: "none" }}>
              2. Detalle de Mercadería Recibida ({form.lines.length} {form.lines.length === 1 ? "línea" : "líneas"})
            </legend>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleAddLine}
              disabled={isSubmitting}
              style={{ minHeight: "36px", padding: "6px 14px", fontSize: "0.85rem" }}
            >
              + Agregar línea <span className={styles.kbd}>Alt+N</span>
            </button>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.linesTable} aria-label="Líneas del comprobante de compra">
              <thead>
                <tr>
                  <th style={{ width: "35px" }}>#</th>
                  <th style={{ minWidth: "260px" }}>Variante / Producto</th>
                  <th style={{ width: "110px" }}>Cantidad</th>
                  <th style={{ width: "120px" }}>Costo Unit.</th>
                  <th style={{ width: "95px" }}>IVA %</th>
                  <th style={{ width: "100px" }}>Descuento</th>
                  <th style={{ width: "120px" }}>Lote</th>
                  <th style={{ width: "130px" }}>Vencimiento</th>
                  <th style={{ width: "120px", textAlign: "right" }}>Subtotal</th>
                  <th style={{ width: "90px", textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, idx) => {
                  const lineErr = errors.lineErrors?.[idx];
                  const lineCalc = preview.lines[idx];

                  return (
                    <tr key={line.id}>
                      <td style={{ textAlign: "center", fontWeight: 600, color: "var(--color-text-muted, #64748b)" }}>
                        {idx + 1}
                      </td>

                      {/* Variant autocomplete search */}
                      <td>
                        <div className={styles.variantSearchContainer}>
                          <input
                            type="text"
                            className={`${styles.tableInput} ${lineErr?.variantId ? styles.inputError : ""}`}
                            placeholder="Buscar por SKU, nombre o pegar UUID..."
                            value={line.variantName || line.variantId}
                            onChange={(e) => {
                              const val = e.target.value;
                              // If looks like UUID directly:
                              if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
                                handleLineChange(idx, "variantId", val);
                                handleLineChange(idx, "variantName", val);
                              } else {
                                handleVariantQueryChange(idx, val);
                              }
                            }}
                            onFocus={() => {
                              if (line.variantName && searchResults.length > 0) {
                                setActiveSearchLineIndex(idx);
                              }
                            }}
                            disabled={isSubmitting}
                            aria-label={`Variante o producto línea ${idx + 1}`}
                          />
                          {activeSearchLineIndex === idx && (
                            <ul className={styles.variantDropdown} role="listbox">
                              {isSearchingCatalog ? (
                                <li className={styles.variantOption} style={{ color: "var(--color-text-muted)" }}>
                                  Buscando en catálogo…
                                </li>
                              ) : searchResults.length > 0 ? (
                                searchResults.map((item) => (
                                  <li
                                    key={item.id}
                                    className={styles.variantOption}
                                    role="option"
                                    aria-selected="false"
                                    onClick={() => handleSelectVariant(idx, item)}
                                  >
                                    <strong>{item.sku}</strong> — {item.productName} ({item.name})
                                  </li>
                                ))
                              ) : (
                                <li className={styles.variantOption} style={{ color: "var(--color-text-muted)" }}>
                                  Sin coincidencias (puede pegar el UUID directamente)
                                </li>
                              )}
                            </ul>
                          )}
                          {lineErr?.variantId && <span className={styles.errorText}>{lineErr.variantId}</span>}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`${styles.tableInput} ${lineErr?.quantity ? styles.inputError : ""}`}
                          value={line.quantity}
                          onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                          placeholder="1"
                          disabled={isSubmitting}
                          aria-label={`Cantidad línea ${idx + 1}`}
                        />
                        {lineErr?.quantity && <span className={styles.errorText}>{lineErr.quantity}</span>}
                      </td>

                      {/* Unit Cost */}
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`${styles.tableInput} ${lineErr?.unitCost ? styles.inputError : ""}`}
                          value={line.unitCost}
                          onChange={(e) => handleLineChange(idx, "unitCost", e.target.value)}
                          placeholder="0.00"
                          disabled={isSubmitting}
                          aria-label={`Costo unitario línea ${idx + 1}`}
                        />
                        {lineErr?.unitCost && <span className={styles.errorText}>{lineErr.unitCost}</span>}
                      </td>

                      {/* Tax Rate */}
                      <td>
                        <select
                          className={styles.tableInput}
                          value={line.taxRate || ""}
                          onChange={(e) => handleLineChange(idx, "taxRate", e.target.value)}
                          disabled={isSubmitting}
                          aria-label={`Alícuota IVA línea ${idx + 1}`}
                        >
                          <option value="">0%</option>
                          <option value="0.21">21%</option>
                          <option value="0.105">10.5%</option>
                          <option value="0.27">27%</option>
                        </select>
                      </td>

                      {/* Discount Amount */}
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={styles.tableInput}
                          value={line.discountAmount || ""}
                          onChange={(e) => handleLineChange(idx, "discountAmount", e.target.value)}
                          placeholder="0.00"
                          disabled={isSubmitting}
                          aria-label={`Descuento línea ${idx + 1}`}
                        />
                      </td>

                      {/* Lot number */}
                      <td>
                        <input
                          type="text"
                          className={styles.tableInput}
                          value={line.lotNumber || ""}
                          onChange={(e) => handleLineChange(idx, "lotNumber", e.target.value)}
                          placeholder="L-2026-X"
                          disabled={isSubmitting}
                          aria-label={`Número de lote línea ${idx + 1}`}
                        />
                      </td>

                      {/* Expires at */}
                      <td>
                        <input
                          type="date"
                          className={styles.tableInput}
                          value={line.expiresAt || ""}
                          onChange={(e) => handleLineChange(idx, "expiresAt", e.target.value)}
                          disabled={isSubmitting}
                          aria-label={`Vencimiento lote línea ${idx + 1}`}
                        />
                      </td>

                      {/* Line Subtotal (Decimal computed) */}
                      <td className={styles.numberCell}>
                        {lineCalc ? lineCalc.total : "0.00"} {form.currency}
                      </td>

                      {/* Row actions */}
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: "4px" }}>
                          <button
                            type="button"
                            onClick={() => handleDuplicateLine(idx)}
                            disabled={isSubmitting}
                            title="Duplicar línea"
                            style={{
                              background: "none",
                              border: "1px solid var(--color-border)",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer",
                            }}
                          >
                            📋
                          </button>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={() => handleRemoveLine(idx)}
                            disabled={isSubmitting || form.lines.length <= 1}
                            title="Eliminar línea"
                            aria-label={`Eliminar línea ${idx + 1}`}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </fieldset>

        {/* Decimal-Safe Totals and Submit Action */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className={styles.totalsCard}>
            <div className={styles.totalsRow}>
              <span>Subtotal neto:</span>
              <span className={styles.numberCell}>{preview.subtotal} {form.currency}</span>
            </div>
            <div className={styles.totalsRow}>
              <span>Descuentos:</span>
              <span className={styles.numberCell}>-{preview.discountTotal} {form.currency}</span>
            </div>
            <div className={styles.totalsRow}>
              <span>Impuestos (IVA):</span>
              <span className={styles.numberCell}>+{preview.taxTotal} {form.currency}</span>
            </div>
            <div className={styles.totalsRowFinal}>
              <span>Total Comprobante:</span>
              <span>{preview.total} {form.currency}</span>
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleAddLine}
              disabled={isSubmitting}
            >
              + Agregar línea (<kbd className={styles.kbd}>Alt+N</kbd>)
            </button>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting || hasNoBranches}
            >
              {isSubmitting ? "Registrando compra…" : "Registrar compra"} (<kbd className={styles.kbd}>Alt+G</kbd>)
            </button>
          </div>
        </div>
      </form>

      {/* Supplier Creation Modal */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onCreated={(newSupplier) => {
          if (onSupplierCreated) onSupplierCreated(newSupplier);
          setForm((prev) => ({ ...prev, supplierId: newSupplier.id }));
        }}
      />
    </div>
  );
}
