"use client";

import React, { useState } from "react";
import type {
  DatePreset,
  OperationalBranch,
  ReportFilterState,
} from "./types";
import styles from "./reports.module.css";

export type ReportFiltersProps = {
  filters: ReportFilterState;
  branches: OperationalBranch[];
  validationErrors?: Record<string, string>;
  isLoading?: boolean;
  isExporting?: boolean;
  onChange: (updates: Partial<ReportFilterState>) => void;
  onPresetChange?: (preset: DatePreset) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onExportCsv: () => void;
  onReset: () => void;
};

export function ReportFilters({
  filters,
  branches,
  validationErrors = {},
  isLoading = false,
  isExporting = false,
  onChange,
  onPresetChange,
  onSubmit,
  onExportCsv,
  onReset,
}: ReportFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  // Convert ISO string to YYYY-MM-DDTHH:mm for datetime-local input
  const toLocalInputValue = (isoStr: string): string => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      // Format as YYYY-MM-DDTHH:mm
      return d.toISOString().slice(0, 16);
    } catch {
      return isoStr;
    }
  };

  const handleDateChange = (field: "from" | "to", value: string) => {
    if (!value) {
      onChange({ [field]: "", preset: "custom" });
      return;
    }
    try {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        onChange({ [field]: parsed.toISOString(), preset: "custom" });
      } else {
        onChange({ [field]: value, preset: "custom" });
      }
    } catch {
      onChange({ [field]: value, preset: "custom" });
    }
  };

  return (
    <div className={styles.filterCard}>
      <div className={styles.filterHeader}>
        <h2 className={styles.filterTitle}>Parámetros del Reporte</h2>

        {/* Date presets */}
        <div className={styles.presetRow}>
          <span className={styles.presetLabel}>Período rápido:</span>
          <div className={styles.presetButtons} role="group" aria-label="Períodos rápidos preestablecidos">
            <button
              type="button"
              className={`${styles.presetButton} ${filters.preset === "today" ? styles.presetButtonActive : ""}`}
              onClick={() => onPresetChange?.("today")}
            >
              Hoy
            </button>
            <button
              type="button"
              className={`${styles.presetButton} ${filters.preset === "last7days" ? styles.presetButtonActive : ""}`}
              onClick={() => onPresetChange?.("last7days")}
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              className={`${styles.presetButton} ${filters.preset === "thisMonth" ? styles.presetButtonActive : ""}`}
              onClick={() => onPresetChange?.("thisMonth")}
            >
              Este mes
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.filterGrid}>
          {/* Desde */}
          <div className={styles.filterGroup}>
            <label htmlFor="filter-from" className={styles.label}>
              Desde (Fecha y Hora) *
            </label>
            <input
              id="filter-from"
              type="datetime-local"
              className={`${styles.input} ${validationErrors.from ? styles.inputError : ""}`}
              value={toLocalInputValue(filters.from)}
              onChange={(e) => handleDateChange("from", e.target.value)}
              aria-invalid={!!validationErrors.from}
              aria-describedby={validationErrors.from ? "error-from" : undefined}
              required
            />
            {validationErrors.from && (
              <span id="error-from" className={styles.errorText}>
                {validationErrors.from}
              </span>
            )}
          </div>

          {/* Hasta */}
          <div className={styles.filterGroup}>
            <label htmlFor="filter-to" className={styles.label}>
              Hasta (Fecha y Hora) *
            </label>
            <input
              id="filter-to"
              type="datetime-local"
              className={`${styles.input} ${validationErrors.to ? styles.inputError : ""}`}
              value={toLocalInputValue(filters.to)}
              onChange={(e) => handleDateChange("to", e.target.value)}
              aria-invalid={!!validationErrors.to}
              aria-describedby={validationErrors.to ? "error-to" : undefined}
              required
            />
            {validationErrors.to && (
              <span id="error-to" className={styles.errorText}>
                {validationErrors.to}
              </span>
            )}
          </div>

          {/* Sucursal */}
          <div className={styles.filterGroup}>
            <label htmlFor="filter-branch" className={styles.label}>
              Sucursal
            </label>
            <select
              id="filter-branch"
              className={`${styles.select} ${validationErrors.branchId ? styles.inputError : ""}`}
              value={filters.branchId}
              onChange={(e) => onChange({ branchId: e.target.value })}
              aria-invalid={!!validationErrors.branchId}
              aria-describedby={validationErrors.branchId ? "error-branch" : undefined}
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
            {validationErrors.branchId && (
              <span id="error-branch" className={styles.errorText}>
                {validationErrors.branchId}
              </span>
            )}
          </div>
        </div>

        {/* Advanced filters toggle */}
        <div style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className={styles.advancedToggle}
            onClick={() => setShowAdvanced((prev) => !prev)}
            aria-expanded={showAdvanced}
          >
            <span>{showAdvanced ? "▼ Ocultar filtros avanzados" : "► Filtros avanzados (operador, variante, categoría)"}</span>
          </button>
        </div>

        {showAdvanced && (
          <div className={styles.advancedGrid} style={{ marginTop: "0.75rem" }}>
            {/* Actor User ID */}
            <div className={styles.filterGroup}>
              <label htmlFor="filter-actor-user-id" className={styles.label}>
                ID Operador / Usuario
              </label>
              <input
                id="filter-actor-user-id"
                type="text"
                placeholder="UUID de usuario"
                className={`${styles.input} ${validationErrors.actorUserId ? styles.inputError : ""}`}
                value={filters.actorUserId}
                onChange={(e) => onChange({ actorUserId: e.target.value })}
                aria-invalid={!!validationErrors.actorUserId}
                aria-describedby={validationErrors.actorUserId ? "error-actor" : undefined}
              />
              {validationErrors.actorUserId && (
                <span id="error-actor" className={styles.errorText}>
                  {validationErrors.actorUserId}
                </span>
              )}
            </div>

            {/* Variant ID */}
            <div className={styles.filterGroup}>
              <label htmlFor="filter-variant-id" className={styles.label}>
                ID Variante de Producto
              </label>
              <input
                id="filter-variant-id"
                type="text"
                placeholder="UUID de variante"
                className={`${styles.input} ${validationErrors.variantId ? styles.inputError : ""}`}
                value={filters.variantId}
                onChange={(e) => onChange({ variantId: e.target.value })}
                aria-invalid={!!validationErrors.variantId}
                aria-describedby={validationErrors.variantId ? "error-variant" : undefined}
              />
              {validationErrors.variantId && (
                <span id="error-variant" className={styles.errorText}>
                  {validationErrors.variantId}
                </span>
              )}
            </div>

            {/* Category ID */}
            <div className={styles.filterGroup}>
              <label htmlFor="filter-category-id" className={styles.label}>
                ID Categoría
              </label>
              <input
                id="filter-category-id"
                type="text"
                placeholder="UUID de categoría"
                className={`${styles.input} ${validationErrors.categoryId ? styles.inputError : ""}`}
                value={filters.categoryId}
                onChange={(e) => onChange({ categoryId: e.target.value })}
                aria-invalid={!!validationErrors.categoryId}
                aria-describedby={validationErrors.categoryId ? "error-category" : undefined}
              />
              {validationErrors.categoryId && (
                <span id="error-category" className={styles.errorText}>
                  {validationErrors.categoryId}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className={styles.actionRow} style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onReset}
            disabled={isLoading || isExporting}
          >
            <span className={styles.kbd}>Alt+L</span> Limpiar
          </button>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnSuccess}`}
            onClick={onExportCsv}
            disabled={isLoading || isExporting}
            aria-label="Exportar reporte en formato CSV"
          >
            <span className={styles.kbd}>Alt+E</span> {isExporting ? "Exportando…" : "Exportar CSV"}
          </button>

          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={isLoading || isExporting}
          >
            <span className={styles.kbd}>Alt+C</span> {isLoading ? "Consultando…" : "Consultar reporte"}
          </button>
        </div>
      </form>
    </div>
  );
}
