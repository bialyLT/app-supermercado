"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./admin-operations.module.css";
import type { BranchOption } from "./users-manager";

export type SettingsManagerProps = {
  readonly branches?: readonly BranchOption[];
};

export type UpdatedSetting = {
  readonly id: string;
  readonly setting: string;
  readonly value: string;
  readonly branchName: string;
  readonly updatedAt: string;
};

const PRESET_SETTINGS = [
  { key: "intake_cap", label: "Tope de intake diario", placeholder: "500000.00", hint: "Límite monetario máximo diario para compras" },
  { key: "timezone", label: "Zona horaria operativa", placeholder: "America/Argentina/Buenos_Aires", hint: "Zona horaria para cortes de turno y arqueos" },
  { key: "fiscal_currency", label: "Moneda del sistema", placeholder: "ARS", hint: "Código ISO de moneda de facturación" },
  { key: "receipt_footer", label: "Pie de ticket", placeholder: "Gracias por su compra", hint: "Texto al pie del ticket de venta" },
  { key: "custom", label: "Parámetro personalizado...", placeholder: "clave_personalizada", hint: "Clave de configuración avanzada" },
];

export function SettingsManager({ branches = [] }: SettingsManagerProps) {
  const [selectedPreset, setSelectedPreset] = useState("intake_cap");
  const [customKey, setCustomKey] = useState("");
  const [value, setValue] = useState("");
  const [branchId, setBranchId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatedLog, setUpdatedLog] = useState<UpdatedSetting[]>([]);

  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        valueInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setError(null);
        setSuccess(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeKey = selectedPreset === "custom" ? customKey.trim() : selectedPreset;
  const currentPresetInfo = PRESET_SETTINGS.find((p) => p.key === selectedPreset);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!activeKey) {
      setError("La clave de configuración es obligatoria");
      return;
    }
    if (!value.trim()) {
      setError("El valor del parámetro es obligatorio");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: { setting: string; value: string; branchId?: string } = {
        setting: activeKey,
        value: value.trim(),
      };

      if (branchId) {
        payload.branchId = branchId;
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Límite de operaciones de configuración alcanzado (429 TOO_MANY_REQUESTS). Espere un minuto antes de reintentar.");
        }
        if (data.error === "FORBIDDEN") {
          throw new Error("Acceso denegado: se requiere rol ADMIN para modificar configuraciones (403 FORBIDDEN)");
        }
        if (data.error === "UNAUTHENTICATED") {
          throw new Error("Sesión no autenticada (401 UNAUTHENTICATED)");
        }
        if (data.error === "INVALID_INPUT") {
          throw new Error("Formato de parámetro inválido (400 INVALID_INPUT)");
        }
        throw new Error(data.error || "Error al actualizar la configuración");
      }

      const branchObj = branches.find((b) => b.id === branchId);
      const logEntry: UpdatedSetting = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        setting: activeKey,
        value: value.trim(),
        branchName: branchObj ? `${branchObj.name} (${branchObj.code})` : "Tenant-wide (Todas)",
        updatedAt: new Date().toLocaleTimeString(),
      };

      setUpdatedLog((prev) => [logEntry, ...prev]);
      setSuccess(`Parámetro «${activeKey}» actualizado correctamente.`);
      setValue("");
      valueInputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al contactar con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Configuración del Sistema</h1>
          <p className={styles.subtitle}>
            Parámetros operativos del tenant, tope de compras (intake cap) y directivas por sucursal
          </p>
        </div>
      </header>

      <section className={styles.shortcutsBar} aria-label="Atajos de teclado">
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Alt+G</kbd> Enfocar campo de valor
        </span>
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Enter</kbd> Guardar parámetro
        </span>
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Esc</kbd> Descartar avisos
        </span>
      </section>

      {error && (
        <div className={styles.alertBanner} role="alert" aria-live="assertive">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className={styles.alertSuccess} role="status" aria-live="polite">
          <strong>Éxito:</strong> {success}
        </div>
      )}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Actualizar Parámetro Operativo</h2>
        <p className={styles.cardDescription}>
          Los cambios se auditan con firma de actor y entran en vigencia de inmediato en el servidor
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid3}>
            <div className={styles.fieldGroup}>
              <label htmlFor="setting-key" className={`${styles.label} ${styles.labelRequired}`}>
                Parámetro
              </label>
              <select
                id="setting-key"
                className={styles.select}
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                disabled={isSubmitting}
              >
                {PRESET_SETTINGS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label} ({p.key})
                  </option>
                ))}
              </select>
              <p className={styles.helperText}>{currentPresetInfo?.hint}</p>
            </div>

            {selectedPreset === "custom" && (
              <div className={styles.fieldGroup}>
                <label htmlFor="custom-setting-key" className={`${styles.label} ${styles.labelRequired}`}>
                  Clave Personalizada
                </label>
                <input
                  id="custom-setting-key"
                  type="text"
                  className={styles.input}
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="mi_parametro"
                  required
                  maxLength={80}
                  disabled={isSubmitting}
                />
                <p className={styles.helperText}>Máximo 80 caracteres</p>
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label htmlFor="setting-value" className={`${styles.label} ${styles.labelRequired}`}>
                Valor
              </label>
              <input
                ref={valueInputRef}
                id="setting-value"
                type="text"
                className={styles.input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={currentPresetInfo?.placeholder || "Ingrese el valor"}
                required
                maxLength={200}
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Máximo 200 caracteres</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="setting-branch" className={styles.label}>
                Alcance (Sucursal)
              </label>
              <select
                id="setting-branch"
                className={styles.select}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Tenant-wide (Todas las sucursales)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <p className={styles.helperText}>Dejar vacío para aplicar a todo el tenant</p>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting || !activeKey || !value.trim()}
            >
              {isSubmitting ? "Guardando..." : "Guardar Parámetro"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Historial de Actualizaciones en esta Sesión</h2>
        <p className={styles.cardDescription}>
          Registro local de cambios enviados al endpoint de auditoría
        </p>

        {updatedLog.length === 0 ? (
          <div className={styles.emptyState}>
            No se han modificado parámetros en esta sesión.
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Parámetro</th>
                  <th>Nuevo Valor</th>
                  <th>Alcance</th>
                </tr>
              </thead>
              <tbody>
                {updatedLog.map((log) => (
                  <tr key={log.id}>
                    <td>{log.updatedAt}</td>
                    <td><code>{log.setting}</code></td>
                    <td><strong>{log.value}</strong></td>
                    <td>{log.branchName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
