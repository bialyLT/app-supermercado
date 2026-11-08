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
  normalizeDecimalInput,
  updateVariantSearchText,
  validatePurchaseReceiptForm,
} from "./types";
import { ProductCombobox } from "../product-combobox";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
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
      const normalizedValue = ["quantity", "unitCost", "taxRate", "taxAmount", "discountAmount"].includes(field)
        ? normalizeDecimalInput(value)
        : value;
      setForm((prev) => {
        const nextLines = [...prev.lines];
        nextLines[index] = field === "variantName"
          ? updateVariantSearchText(nextLines[index], normalizedValue)
          : { ...nextLines[index], [field]: normalizedValue };
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
        <Alert variant="error" title="Sin sucursales asignadas">
          Su usuario no tiene sucursales asignadas con permisos de recepción de mercadería.
          Contacte al administrador del tenant para obtener asignación de sucursal.
        </Alert>
      )}

      {serverError && (
        <Alert variant="error" title="Error al registrar comprobante">{serverError}</Alert>
      )}

      {errors.lines && (
        <Alert variant="error" title="Validación de líneas">{errors.lines}</Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Context and Supplier Selection */}
        <fieldset className={styles.formSection}>
          <legend className={styles.sectionTitle}>1. Datos del Comprobante y Contexto Operativo</legend>

          <div className={`${styles.grid3} ${styles.grid3Bottom}`}>
            <div className={styles.fieldGroup}>
              <div className={styles.labelRow}>
                <label htmlFor="purchase-supplier" className={`${styles.label} ${styles.labelRequired}`}>
                  Proveedor
                </label>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setIsSupplierModalOpen(true)}
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

          <div className={`${styles.grid2} ${styles.grid2Top}`}>
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
          </div>
        </fieldset>

        {/* Multi-Line Entry Section */}
        <fieldset className={styles.formSection}>
          <div className={styles.sectionHeader}>
            <legend className={`${styles.sectionTitle} ${styles.sectionTitleLegend}`}>
              2. Detalle de Mercadería Recibida ({form.lines.length} {form.lines.length === 1 ? "línea" : "líneas"})
            </legend>
            <Button type="button" variant="secondary" onClick={handleAddLine} disabled={isSubmitting}>
              + Agregar línea <span className={styles.kbd}>Alt+N</span>
            </Button>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.linesTable} aria-label="Líneas del comprobante de compra">
              <thead>
                <tr>
                  <th className={styles.colIndex}>#</th>
                  <th className={styles.colVariant}>Variante / Producto</th>
                  <th className={styles.colQuantity}>Cantidad</th>
                  <th className={styles.colUnitCost}>Costo Unit.</th>
                  <th className={styles.colTaxRate}>IVA %</th>
                  <th className={styles.colDiscount}>Descuento</th>
                  <th className={styles.colLot}>Lote</th>
                  <th className={styles.colExpiry}>Vencimiento</th>
                  <th className={styles.colSubtotal}>Subtotal</th>
                  <th className={styles.colActions}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, idx) => {
                  const lineErr = errors.lineErrors?.[idx];
                  const lineCalc = preview.lines[idx];

                  return (
                    <tr key={line.id}>
                      <td className={styles.rowIndex}>{idx + 1}</td>

                      {/* Variant autocomplete search */}
                      <td>
                        <div className={styles.variantSearchContainer}>
                          <ProductCombobox
                            label={`Variante o producto línea ${idx + 1}`}
                            placeholder="Buscar por SKU, nombre o pegar UUID..."
                            value={line.variantName || line.variantId}
                            options={activeSearchLineIndex === idx ? searchResults : []}
                            isLoading={activeSearchLineIndex === idx && isSearchingCatalog}
                            disabled={isSubmitting}
                            inputClassName={`${styles.tableInput} ${lineErr?.variantId ? styles.inputError : ""}`}
                            onChange={(value) => {
                              if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                                handleLineChange(idx, "variantId", value);
                                handleLineChange(idx, "variantName", value);
                              } else {
                                handleVariantQueryChange(idx, value);
                              }
                            }}
                            onFocus={() => {
                              if (line.variantName && searchResults.length > 0) setActiveSearchLineIndex(idx);
                            }}
                            onSelect={(item) => handleSelectVariant(idx, item)}
                            noResultsText="Sin coincidencias (puede pegar el UUID directamente)"
                          />
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
                      <td className={styles.rowActionsCell}>
                        <div className={styles.rowActions}>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleDuplicateLine(idx)}
                            disabled={isSubmitting}
                            title="Duplicar línea"
                          >
                            📋
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => handleRemoveLine(idx)}
                            disabled={isSubmitting || form.lines.length <= 1}
                            title="Eliminar línea"
                            aria-label={`Eliminar línea ${idx + 1}`}
                          >
                            ✕
                          </Button>
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
        <div className={styles.formFooter}>
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
            <Button type="button" variant="secondary" onClick={handleAddLine} disabled={isSubmitting}>
              + Agregar línea (<kbd className={styles.kbd}>Alt+N</kbd>)
            </Button>

            <Button type="submit" variant="primary" disabled={isSubmitting || hasNoBranches}>
              {isSubmitting ? "Registrando compra…" : "Registrar compra"} (<kbd className={styles.kbd}>Alt+G</kbd>)
            </Button>
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
