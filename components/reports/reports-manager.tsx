"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  DatePreset,
  OperationalContext,
  OperationsReportData,
  ReportFilterState,
} from "./types";
import {
  buildCsvExportUrl,
  buildReportQueryString,
  getPresetDateRange,
  mapReportErrorMessage,
  validateReportFilters,
} from "./types";
import { ReportFilters } from "./report-filters";
import { ReportSummary } from "./report-summary";
import { ReportBranchDetail } from "./report-branch-detail";
import styles from "./reports.module.css";

export type ReportsManagerProps = {
  initialReport?: OperationsReportData | null;
  initialContext?: OperationalContext | null;
  initialError?: string | null;
};

export function ReportsManager({
  initialReport = null,
  initialContext = null,
  initialError = null,
}: ReportsManagerProps) {
  const [context, setContext] = useState<OperationalContext | null>(initialContext);
  const [report, setReport] = useState<OperationsReportData | null>(initialReport);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Initialize filter state with "thisMonth" preset or initialReport's period
  const [filters, setFilters] = useState<ReportFilterState>(() => {
    if (initialReport?.period) {
      return {
        preset: "custom",
        from: initialReport.period.from,
        to: initialReport.period.to,
        branchId: initialReport.filters.branchId || "",
        actorUserId: initialReport.filters.actorUserId || "",
        variantId: initialReport.filters.variantId || "",
        categoryId: initialReport.filters.categoryId || "",
      };
    }
    const defaultRange = getPresetDateRange("thisMonth");
    return {
      preset: "thisMonth",
      from: defaultRange.from,
      to: defaultRange.to,
      branchId: "",
      actorUserId: "",
      variantId: "",
      categoryId: "",
    };
  });

  // Load operational context (branches) from /api/admin/context if not preloaded
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
        })
        .catch((err) => {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar la lista de sucursales autorizadas"
          );
        });
    }
  }, [initialContext]);

  const handleFilterChange = (updates: Partial<ReportFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setValidationErrors((prev) => {
      const updated = { ...prev };
      for (const k of Object.keys(updates)) {
        delete updated[k];
      }
      return updated;
    });
  };

  const handlePresetChange = (preset: DatePreset) => {
    const range = getPresetDateRange(preset);
    setFilters((prev) => ({
      ...prev,
      preset,
      from: range.from,
      to: range.to,
    }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.from;
      delete next.to;
      return next;
    });
  };

  const handleFetchReport = useCallback(
    async (overrideFilters?: ReportFilterState) => {
      const activeFilters = overrideFilters || filters;
      const errors = validateReportFilters(activeFilters, context?.branches);

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      setValidationErrors({});
      setIsLoading(true);
      setError(null);

      try {
        const qs = buildReportQueryString(activeFilters, "json");
        const res = await fetch(`/api/admin/reports/operations?${qs}`);
        const data = await res.json();

        if (!res.ok) {
          setError(mapReportErrorMessage(res.status, data.error || data.detail));
          return;
        }

        setReport(data as OperationsReportData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error de red al consultar el reporte operativo"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [filters, context?.branches]
  );

  const handleExportCsv = useCallback(() => {
    const errors = validateReportFilters(filters, context?.branches);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setIsExporting(true);

    try {
      const csvUrl = buildCsvExportUrl(filters);
      // Trigger native browser download using an anchor element
      const link = document.createElement("a");
      link.href = csvUrl;
      link.setAttribute("download", "");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al descargar el archivo CSV"
      );
    } finally {
      setIsExporting(false);
    }
  }, [filters, context?.branches]);

  const handleReset = useCallback(() => {
    const defaultRange = getPresetDateRange("thisMonth");
    setFilters({
      preset: "thisMonth",
      from: defaultRange.from,
      to: defaultRange.to,
      branchId: "",
      actorUserId: "",
      variantId: "",
      categoryId: "",
    });
    setValidationErrors({});
    setError(null);
  }, []);

  // Keyboard navigation & shortcuts (S5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleFetchReport();
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        handleExportCsv();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFetchReport, handleExportCsv, handleReset]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Reportes Operativos</h1>
          <p className={styles.subtitle}>
            Consolidación tabular de ventas, compras, inventario y transferencias por sucursal
          </p>
        </div>

        {/* Shortcuts bar (S5) */}
        <div className={styles.shortcutsBar} role="region" aria-label="Atajos de teclado">
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Alt+C</kbd> Consultar reporte
          </span>
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Alt+E</kbd> Exportar CSV
          </span>
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Alt+L</kbd> Limpiar filtros
          </span>
          <span className={styles.shortcutItem}>
            <kbd className={styles.kbd}>Enter</kbd> Ejecutar consulta
          </span>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className={styles.alertError} role="alert">
          <span className={styles.alertErrorText}>{error}</span>
          <button
            type="button"
            className={styles.alertRetryBtn}
            onClick={() => handleFetchReport()}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Filter form */}
      <ReportFilters
        filters={filters}
        branches={context?.branches || []}
        validationErrors={validationErrors}
        isLoading={isLoading}
        isExporting={isExporting}
        onChange={handleFilterChange}
        onPresetChange={handlePresetChange}
        onSubmit={() => handleFetchReport()}
        onExportCsv={handleExportCsv}
        onReset={handleReset}
      />

      {/* Loading state */}
      {isLoading && (
        <div className={styles.loadingSkeleton} role="status" aria-busy="true">
          <div className={styles.spinner} />
          <span>Generando reporte operativo consolidado…</span>
        </div>
      )}

      {/* Data display (S2: Tabular only, no charts) */}
      {!isLoading && report && (
        <>
          <ReportSummary report={report} />
          <ReportBranchDetail
            branches={report.branches}
            operationalBranches={context?.branches}
            currency={report.currency}
          />
        </>
      )}

      {/* Neutral empty state */}
      {!isLoading && !report && !error && (
        <div className={styles.emptyState} role="status">
          <p>
            Presione <strong>Consultar reporte</strong> (<kbd className={styles.kbd}>Alt+C</kbd>) para visualizar los datos del período seleccionado.
          </p>
        </div>
      )}
    </div>
  );
}
