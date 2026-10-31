"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  FormValidationErrors,
  OperationalBranch,
  TransferFormState,
  TransferLineState,
} from "./types";
import {
  createEmptyTransferLine,
  createInitialTransferFormState,
  generateIdempotencyKey,
  normalizeDecimalInput,
  validateTransferForm,
} from "./types";
import styles from "./transfers.module.css";

export type TransferFormProps = {
  branches: OperationalBranch[];
  onSubmit: (formData: TransferFormState) => Promise<boolean>;
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

export function TransferForm({
  branches = [],
  onSubmit,
  isSubmitting = false,
  serverError = null,
  onClearServerError,
  contextLoading = false,
}: TransferFormProps) {
  const [form, setForm] = useState<TransferFormState>(() =>
    createInitialTransferFormState()
  );
  const [errors, setErrors] = useState<FormValidationErrors>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Catalog variant search per line
  const [activeSearchLineIndex, setActiveSearchLineIndex] = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<CatalogSearchResult[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived selected branches
  const originBranch = branches.find((b) => b.id === form.originBranchId);
  const destinationBranch = branches.find((b) => b.id === form.destinationBranchId);

  // Active locations for selected branches
  const originActiveLocations = originBranch?.locations?.filter((l) => l.active) ?? [];
  const destinationActiveLocations = destinationBranch?.locations?.filter((l) => l.active) ?? [];

  const handleAddLine = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyTransferLine()],
    }));
  }, []);

  const handleRemoveLine = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) {
        return { ...prev, lines: [createEmptyTransferLine()] };
      }
      return {
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index),
      };
    });
  }, []);

  const handleDuplicateLine = useCallback((index: number) => {
    setForm((prev) => {
      const target = prev.lines[index];
      const newLine: TransferLineState = {
        ...createEmptyTransferLine(),
        variantId: target.variantId,
        variantName: target.variantName,
        sku: target.sku,
        lotId: "",
        quantity: target.quantity,
      };
      const updated = [...prev.lines];
      updated.splice(index + 1, 0, newLine);
      return { ...prev, lines: updated };
    });
  }, []);

  const handleLineChange = useCallback(
    (index: number, field: keyof TransferLineState, value: string) => {
      onClearServerError?.();
      const normalizedValue = field === "quantity" ? normalizeDecimalInput(value) : value;
    setForm((prev) => {
        const updated = [...prev.lines];
        updated[index] = { ...updated[index], [field]: normalizedValue };
        return { ...prev, lines: updated };
      });
    },
    [onClearServerError]
  );

  const handleSearchVariants = useCallback((index: number, query: string) => {
    handleLineChange(index, "variantName", query);
    setActiveSearchLineIndex(index);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearchingCatalog(false);
      return;
    }

    setIsSearchingCatalog(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/catalog?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearchingCatalog(false);
      }
    }, 250);
  }, [handleLineChange]);

  const handleSelectVariant = useCallback(
    (index: number, item: CatalogSearchResult) => {
      setForm((prev) => {
        const updated = [...prev.lines];
        updated[index] = {
          ...updated[index],
          variantId: item.id,
          variantName: item.name ? `${item.productName} - ${item.name}` : item.productName,
          sku: item.sku,
        };
        return { ...prev, lines: updated };
      });
      setActiveSearchLineIndex(null);
      setSearchResults([]);
    },
    []
  );

  const handleRegenerateIdempotencyKey = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      idempotencyKey: generateIdempotencyKey(),
    }));
  }, []);

  const handleOpenConfirm = useCallback(() => {
    onClearServerError?.();
    const validationContext = {
      tenantId: "",
      branches,
      locations: [],
    };
    const validationErrors = validateTransferForm(form, validationContext);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsConfirmOpen(true);
  }, [branches, form, onClearServerError]);

  // Keyboard navigation shortcuts (Alt+N, Alt+D, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleAddLine();
      } else if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        handleOpenConfirm();
      } else if (e.key === "Escape") {
        setActiveSearchLineIndex(null);
        if (isConfirmOpen) setIsConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAddLine, handleOpenConfirm, isConfirmOpen]);

  const handleConfirmDispatch = useCallback(async () => {
    const success = await onSubmit(form);
    if (success) {
      setIsConfirmOpen(false);
      // Reset form with new idempotency key while keeping selected branches
      setForm((prev) => ({
        ...createInitialTransferFormState({
          originBranchId: prev.originBranchId,
          originLocationId: prev.originLocationId,
          destinationBranchId: prev.destinationBranchId,
          destinationLocationId: prev.destinationLocationId,
        }),
      }));
      setErrors({});
    } else {
      setIsConfirmOpen(false);
    }
  }, [form, onSubmit]);

  const hasInsufficientBranches = branches.length < 2 && !contextLoading;

  return (
    <div className={styles.linesSection}>
      {hasInsufficientBranches && (
        <div className={`${styles.alertBanner} ${styles.alertError}`} role="alert">
          <span className={styles.alertTitle}>Sucursales insuficientes</span>
          <span>
            Se requieren al menos dos sucursales asignadas para realizar transferencias.
            El usuario actual tiene acceso a {branches.length} sucursal(es).
          </span>
        </div>
      )}

      {serverError && (
        <div className={`${styles.alertBanner} ${styles.alertError}`} role="alert" aria-live="assertive">
          <span className={styles.alertTitle}>Error en la transferencia</span>
          <span>{serverError}</span>
        </div>
      )}

      {/* Origin / Destination Branch & Location Selectors */}
      <div className={styles.branchSelectorGrid}>
        {/* Origin Card */}
        <section className={styles.selectorCard} aria-labelledby="origin-heading">
          <h2 id="origin-heading" className={styles.selectorCardTitle}>
            📍 Origen de la Transferencia
          </h2>

          <div className={styles.formGroup}>
            <label htmlFor="originBranchId" className={styles.label}>
              Sucursal Origen <span className={styles.required}>*</span>
            </label>
            <select
              id="originBranchId"
              className={`${styles.select} ${errors.originBranchId ? styles.inputError : ""}`}
              value={form.originBranchId}
              onChange={(e) => {
                const newBranchId = e.target.value;
                onClearServerError?.();
                setForm((prev) => {
                  const b = branches.find((branch) => branch.id === newBranchId);
                  const activeLocs = b?.locations.filter((l) => l.active) ?? [];
                  return {
                    ...prev,
                    originBranchId: newBranchId,
                    originLocationId: activeLocs.length === 1 ? activeLocs[0].id : "",
                  };
                });
              }}
              disabled={contextLoading || branches.length === 0}
            >
              <option value="">-- Seleccionar sucursal origen --</option>
              {branches.map((b) => (
                <option key={`origin-branch-${b.id}`} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {errors.originBranchId && (
              <span className={styles.errorText}>{errors.originBranchId}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="originLocationId" className={styles.label}>
              Ubicación Origen <span className={styles.required}>*</span>
            </label>
            <select
              id="originLocationId"
              className={`${styles.select} ${errors.originLocationId ? styles.inputError : ""}`}
              value={form.originLocationId}
              onChange={(e) => {
                onClearServerError?.();
                setForm((prev) => ({ ...prev, originLocationId: e.target.value }));
              }}
              disabled={!form.originBranchId || originActiveLocations.length === 0}
            >
              <option value="">-- Seleccionar ubicación origen --</option>
              {originActiveLocations.map((loc) => (
                <option key={`origin-loc-${loc.id}`} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
            {errors.originLocationId && (
              <span className={styles.errorText}>{errors.originLocationId}</span>
            )}
          </div>
        </section>

        {/* Destination Card */}
        <section className={styles.selectorCard} aria-labelledby="destination-heading">
          <h2 id="destination-heading" className={styles.selectorCardTitle}>
            🎯 Destino de la Transferencia
          </h2>

          <div className={styles.formGroup}>
            <label htmlFor="destinationBranchId" className={styles.label}>
              Sucursal Destino <span className={styles.required}>*</span>
            </label>
            <select
              id="destinationBranchId"
              className={`${styles.select} ${errors.destinationBranchId ? styles.inputError : ""}`}
              value={form.destinationBranchId}
              onChange={(e) => {
                const newDestBranchId = e.target.value;
                onClearServerError?.();
                setForm((prev) => {
                  const b = branches.find((branch) => branch.id === newDestBranchId);
                  const activeLocs = b?.locations.filter((l) => l.active) ?? [];
                  return {
                    ...prev,
                    destinationBranchId: newDestBranchId,
                    destinationLocationId: activeLocs.length === 1 ? activeLocs[0].id : "",
                  };
                });
              }}
              disabled={contextLoading || branches.length === 0}
            >
              <option value="">-- Seleccionar sucursal destino --</option>
              {branches.map((b) => (
                <option
                  key={`dest-branch-${b.id}`}
                  value={b.id}
                  disabled={b.id === form.originBranchId}
                >
                  {b.name} ({b.code}){b.id === form.originBranchId ? " (Origen actual)" : ""}
                </option>
              ))}
            </select>
            {errors.destinationBranchId && (
              <span className={styles.errorText}>{errors.destinationBranchId}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="destinationLocationId" className={styles.label}>
              Ubicación Destino <span className={styles.required}>*</span>
            </label>
            <select
              id="destinationLocationId"
              className={`${styles.select} ${errors.destinationLocationId ? styles.inputError : ""}`}
              value={form.destinationLocationId}
              onChange={(e) => {
                onClearServerError?.();
                setForm((prev) => ({ ...prev, destinationLocationId: e.target.value }));
              }}
              disabled={!form.destinationBranchId || destinationActiveLocations.length === 0}
            >
              <option value="">-- Seleccionar ubicación destino --</option>
              {destinationActiveLocations.map((loc) => (
                <option key={`dest-loc-${loc.id}`} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
            {errors.destinationLocationId && (
              <span className={styles.errorText}>{errors.destinationLocationId}</span>
            )}
          </div>
        </section>
      </div>

      {/* Multi-line transfer items */}
      <section className={styles.linesSection} aria-labelledby="lines-heading">
        <div className={styles.sectionHeader}>
          <h2 id="lines-heading" className={styles.sectionTitle}>
            Líneas de transferencia ({form.lines.length})
          </h2>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleAddLine}
            aria-label="Agregar línea de transferencia (Alt+N)"
          >
            + Agregar línea (Alt+N)
          </button>
        </div>

        {errors.lines && (
          <div className={`${styles.alertBanner} ${styles.alertError}`} role="alert">
            <span className={styles.errorText}>{errors.lines}</span>
          </div>
        )}

        <div className={styles.tableContainer}>
          <table className={styles.table} aria-label="Líneas de la transferencia">
            <thead>
              <tr>
                <th className={styles.th} style={{ width: "40px" }}>#</th>
                <th className={styles.th} style={{ minWidth: "260px" }}>
                  Variante / Producto <span className={styles.required}>*</span>
                </th>
                <th className={styles.th} style={{ minWidth: "200px" }}>
                  Lote (opcional)
                </th>
                <th className={styles.th} style={{ width: "140px" }}>
                  Cantidad <span className={styles.required}>*</span>
                </th>
                <th className={styles.th} style={{ width: "120px", textAlign: "center" }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => {
                const lineErr = errors.lineErrors?.[index];

                return (
                  <tr key={line.id} className={styles.lineRow}>
                    <td className={`${styles.td} ${styles.lineIndex}`}>{index + 1}</td>
                    <td className={styles.td}>
                      <div className={styles.searchContainer}>
                        <input
                          type="text"
                          className={`${styles.input} ${lineErr?.variantId ? styles.inputError : ""}`}
                          placeholder="Buscar por SKU, nombre o código..."
                          value={line.variantName || line.variantId}
                          onChange={(e) => handleSearchVariants(index, e.target.value)}
                          onFocus={() => {
                            if (searchResults.length > 0) setActiveSearchLineIndex(index);
                          }}
                          aria-label={`Buscar variante línea ${index + 1}`}
                          autoComplete="off"
                        />
                        {activeSearchLineIndex === index && searchResults.length > 0 && (
                          <div className={styles.searchDropdown} role="listbox">
                            {searchResults.map((item) => (
                              <div
                                key={item.id}
                                className={styles.searchItem}
                                onClick={() => handleSelectVariant(index, item)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSelectVariant(index, item);
                                  }
                                }}
                                role="option"
                                aria-selected="false"
                                tabIndex={0}
                              >
                                <span className={styles.searchItemName}>
                                  {item.productName} {item.name ? `- ${item.name}` : ""}
                                </span>
                                <span className={styles.searchItemMeta}>
                                  SKU: {item.sku}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {activeSearchLineIndex === index && isSearchingCatalog && (
                          <div className={styles.searchDropdown} style={{ padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#64748b" }}>
                            Buscando en catálogo…
                          </div>
                        )}
                      </div>
                      {lineErr?.variantId && (
                        <span className={styles.errorText}>{lineErr.variantId}</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <input
                        type="text"
                        className={`${styles.input} ${lineErr?.lotId ? styles.inputError : ""}`}
                        placeholder="UUID de lote (opcional)"
                        value={line.lotId || ""}
                        onChange={(e) => handleLineChange(index, "lotId", e.target.value)}
                        aria-label={`ID de lote línea ${index + 1}`}
                      />
                      {lineErr?.lotId && (
                        <span className={styles.errorText}>{lineErr.lotId}</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${styles.input} ${lineErr?.quantity ? styles.inputError : ""}`}
                        placeholder="Ej. 10"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(index, "quantity", e.target.value)}
                        aria-label={`Cantidad línea ${index + 1}`}
                      />
                      {lineErr?.quantity && (
                        <span className={styles.errorText}>{lineErr.quantity}</span>
                      )}
                    </td>
                    <td className={styles.td} style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          onClick={() => handleDuplicateLine(index)}
                          title="Duplicar variante"
                          aria-label={`Duplicar línea ${index + 1}`}
                          style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnDanger}`}
                          onClick={() => handleRemoveLine(index)}
                          title="Eliminar línea"
                          aria-label={`Eliminar línea ${index + 1}`}
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
      </section>

      {/* Motivo e Idempotencia */}
      <div className={styles.branchSelectorGrid}>
        <div className={styles.formGroup}>
          <label htmlFor="transfer-reason" className={styles.label}>
            Motivo / Observaciones (opcional)
          </label>
          <textarea
            id="transfer-reason"
            className={`${styles.textarea} ${errors.reason ? styles.inputError : ""}`}
            rows={2}
            placeholder="Ej. Reposición de stock semanal, traslado por demanda..."
            value={form.reason}
            onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            maxLength={500}
          />
          {errors.reason && <span className={styles.errorText}>{errors.reason}</span>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="transfer-idempotency" className={styles.label}>
            Clave de Idempotencia
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="transfer-idempotency"
              type="text"
              className={styles.input}
              value={form.idempotencyKey}
              readOnly
              aria-label="Clave de idempotencia única generada por el sistema"
            />
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleRegenerateIdempotencyKey}
              title="Regenerar clave de idempotencia"
              aria-label="Regenerar clave"
              style={{ whiteSpace: "nowrap" }}
            >
              🔄 Nueva clave
            </button>
          </div>
          <span className={styles.helperText}>
            Garantiza que la solicitud no se procese dos veces ante cortes de red.
          </span>
        </div>
      </div>

      {/* Action Submit Bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.5rem" }}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleOpenConfirm}
          disabled={isSubmitting || hasInsufficientBranches}
          aria-label="Despachar Transferencia (Alt+D)"
        >
          {isSubmitting ? "Despachando…" : "Despachar Transferencia (Alt+D)"}
        </button>
      </div>

      {/* Dispatch Confirmation Modal (Idempotent Dispatch UX) */}
      {isConfirmOpen && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="confirm-dialog-title" className={styles.modalTitle}>
                Confirmar Despacho de Transferencia
              </h2>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setIsConfirmOpen(false)}
                aria-label="Cerrar modal de confirmación"
                style={{ padding: "0.25rem 0.5rem" }}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p style={{ margin: 0 }}>
                Se debitará el stock de la sucursal de origen y se acreditará en destino inmediatamente:
              </p>

              <div style={{ backgroundColor: "#f8fafc", padding: "1rem", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div>
                  <strong>Origen:</strong> {originBranch?.name} ({originBranch?.code}) —{" "}
                  {originActiveLocations.find((l) => l.id === form.originLocationId)?.name || form.originLocationId}
                </div>
                <div>
                  <strong>Destino:</strong> {destinationBranch?.name} ({destinationBranch?.code}) —{" "}
                  {destinationActiveLocations.find((l) => l.id === form.destinationLocationId)?.name || form.destinationLocationId}
                </div>
                <div>
                  <strong>Líneas a transferir:</strong> {form.lines.length}
                </div>
                {form.reason && (
                  <div>
                    <strong>Motivo:</strong> {form.reason}
                  </div>
                )}
                <div>
                  <strong>Clave de idempotencia:</strong>{" "}
                  <code style={{ fontSize: "0.75rem" }}>{form.idempotencyKey}</code>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar (Esc)
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleConfirmDispatch}
                disabled={isSubmitting}
                autoFocus
              >
                {isSubmitting ? "Despachando…" : "Confirmar y Despachar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
