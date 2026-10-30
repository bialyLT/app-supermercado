"use client";

import React, { useState, useMemo } from "react";
import styles from "./admin-operations.module.css";

export type WeighedBarcodeConfigState = {
  prefix: string;
  mode: "PRICE" | "WEIGHT";
  variantDigits: number;
  valueDigits: number;
  valueScale: number;
};

export type WeighedBarcodeManagerProps = {
  readonly initialConfig?: Partial<WeighedBarcodeConfigState>;
};

export function WeighedBarcodeManager({ initialConfig }: WeighedBarcodeManagerProps) {
  const [prefix, setPrefix] = useState(initialConfig?.prefix || "20");
  const [mode, setMode] = useState<"PRICE" | "WEIGHT">(initialConfig?.mode || "PRICE");
  const [variantDigits, setVariantDigits] = useState<number>(initialConfig?.variantDigits ?? 5);
  const [valueDigits, setValueDigits] = useState<number>(initialConfig?.valueDigits ?? 5);
  const [valueScale, setValueScale] = useState<number>(initialConfig?.valueScale ?? 2);

  const [testBarcode, setTestBarcode] = useState("2012345005007");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalLength = prefix.length + variantDigits + valueDigits;
  const isLayoutValid = /^\d+$/.test(prefix) && totalLength === 12;

  // Real-time simulator calculated derived value
  const simResult = useMemo(() => {
    if (!testBarcode.trim()) {
      return null;
    }

    const clean = testBarcode.trim();
    if (!/^\d{13}$/.test(clean)) {
      return {
        valid: false,
        error: "El código debe tener exactamente 13 dígitos numéricos (EAN-13).",
      };
    }

    if (!clean.startsWith(prefix)) {
      return {
        valid: false,
        error: `El código no inicia con el prefijo configurado (${prefix}).`,
      };
    }

    if (!isLayoutValid) {
      return {
        valid: false,
        error: "La configuración de layout no suma 12 dígitos de datos.",
      };
    }

    try {
      const pLen = prefix.length;
      const vCode = clean.substring(pLen, pLen + variantDigits);
      const valRaw = clean.substring(pLen + variantDigits, pLen + variantDigits + valueDigits);
      const check = clean.slice(-1);

      const num = parseInt(valRaw, 10);
      const divisor = Math.pow(10, valueScale);
      const formattedAmount = (num / divisor).toFixed(valueScale);

      return {
        valid: true,
        sku: vCode,
        amount: mode === "PRICE" ? `$${formattedAmount}` : `${formattedAmount} kg`,
        checkDigit: check,
      };
    } catch {
      return { valid: false, error: "Error al descomponer el código" };
    }
  }, [testBarcode, prefix, mode, variantDigits, valueDigits, valueScale, isLayoutValid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isLayoutValid) {
      setError("El prefijo + dígitos de variante + dígitos de valor deben sumar exactamente 12 dígitos.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        prefix,
        mode,
        variantDigits: Number(variantDigits),
        valueDigits: Number(valueDigits),
        valueScale: Number(valueScale),
      };

      const res = await fetch("/api/admin/weighed-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === "FORBIDDEN") {
          throw new Error("Acceso denegado: se requiere rol ADMIN (403 FORBIDDEN)");
        }
        if (data.error === "UNAUTHENTICATED") {
          throw new Error("Sesión no autenticada (401 UNAUTHENTICATED)");
        }
        if (data.error === "INVALID_INPUT") {
          throw new Error("Configuración inválida (400 INVALID_INPUT): verifique los rangos y layout EAN-13");
        }
        throw new Error(data.error || "Error al guardar la configuración");
      }

      setSuccess("Configuración de balanza EAN-13 guardada y auditada exitosamente en el servidor.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Códigos de Balanza Pesables (EAN-13)</h1>
          <p className={styles.subtitle}>
            Configuración del layout de balanza comercial para etiquetas de peso y precio variable
          </p>
        </div>
      </header>

      <section className={styles.shortcutsBar} aria-label="Atajos de teclado">
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Enter</kbd> Guardar configuración
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
        <h2 className={styles.cardTitle}>Estructura del Código de Barras (13 Dígitos)</h2>
        <p className={styles.cardDescription}>
          Regla EAN-13 estricta: Prefijo + Dígitos de Variante + Dígitos de Valor = 12 dígitos + 1 dígito verificador.
        </p>

        {/* Layout Visualizer */}
        <div style={{ marginBottom: "20px" }}>
          <div className={styles.layoutVisualizer}>
            <div
              className={`${styles.layoutBlock} ${styles.blockPrefix}`}
              style={{ flex: prefix.length || 1 }}
              title={`Prefijo (${prefix.length} dígitos): ${prefix}`}
            >
              Prefijo ({prefix.length})
            </div>
            <div
              className={`${styles.layoutBlock} ${styles.blockVariant}`}
              style={{ flex: variantDigits }}
              title={`Código de Producto/Variante (${variantDigits} dígitos)`}
            >
              SKU ({variantDigits})
            </div>
            <div
              className={`${styles.layoutBlock} ${styles.blockValue}`}
              style={{ flex: valueDigits }}
              title={`Valor/Monto (${valueDigits} dígitos)`}
            >
              {mode === "PRICE" ? "Precio" : "Peso"} ({valueDigits})
            </div>
            <div
              className={`${styles.layoutBlock} ${styles.blockCheck}`}
              style={{ flex: 1 }}
              title="Dígito verificador de paridad EAN-13 (1 dígito)"
            >
              Chk (1)
            </div>
          </div>
          <p
            className={styles.helperText}
            style={{ marginTop: "8px", fontWeight: isLayoutValid ? 600 : 700, color: isLayoutValid ? "#15803d" : "#dc2626" }}
          >
            Longitud total: {totalLength} datos + 1 verificador = {totalLength + 1} dígitos.{" "}
            {isLayoutValid ? "✓ Layout válido (13 dígitos exactos)" : "✗ Inválido: debe sumar 12 datos"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid3}>
            <div className={styles.fieldGroup}>
              <label htmlFor="wbc-prefix" className={`${styles.label} ${styles.labelRequired}`}>
                Prefijo Numérico
              </label>
              <input
                id="wbc-prefix"
                type="text"
                className={styles.input}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="20"
                required
                maxLength={6}
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Comúnmente «20» para productos pesables en balanza</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="wbc-mode" className={`${styles.label} ${styles.labelRequired}`}>
                Modo de Información
              </label>
              <select
                id="wbc-mode"
                className={styles.select}
                value={mode}
                onChange={(e) => setMode(e.target.value as "PRICE" | "WEIGHT")}
                disabled={isSubmitting}
              >
                <option value="PRICE">PRICE (El código incrusta el precio total)</option>
                <option value="WEIGHT">WEIGHT (El código incrusta el peso en kg)</option>
              </select>
              <p className={styles.helperText}>Tipo de magnitud que emite la balanza en la etiqueta</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="wbc-variant-digits" className={`${styles.label} ${styles.labelRequired}`}>
                Dígitos para SKU / Variante
              </label>
              <input
                id="wbc-variant-digits"
                type="number"
                className={styles.input}
                value={variantDigits}
                onChange={(e) => setVariantDigits(Math.max(1, Math.min(10, parseInt(e.target.value || "1", 10))))}
                min={1}
                max={10}
                required
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Cantidad de dígitos dedicados al código del producto</p>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.fieldGroup}>
              <label htmlFor="wbc-value-digits" className={`${styles.label} ${styles.labelRequired}`}>
                Dígitos para Valor (Precio o Peso)
              </label>
              <input
                id="wbc-value-digits"
                type="number"
                className={styles.input}
                value={valueDigits}
                onChange={(e) => setValueDigits(Math.max(1, Math.min(10, parseInt(e.target.value || "1", 10))))}
                min={1}
                max={10}
                required
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Dígitos enteros dedicados a la magnitud</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="wbc-value-scale" className={`${styles.label} ${styles.labelRequired}`}>
                Escala de Decimales
              </label>
              <input
                id="wbc-value-scale"
                type="number"
                className={styles.input}
                value={valueScale}
                onChange={(e) => setValueScale(Math.max(0, Math.min(6, parseInt(e.target.value || "0", 10))))}
                min={0}
                max={6}
                required
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Cantidad de posiciones decimales (ej. 2 para centavos/gramos)</p>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting || !isLayoutValid}
            >
              {isSubmitting ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Simulador de Código EAN-13</h2>
        <p className={styles.cardDescription}>
          Pruebe la descomposición de un código de barras de balanza antes de aplicar cambios
        </p>

        <div className={styles.simulatorBox}>
          <div className={styles.fieldGroup}>
            <label htmlFor="simulator-input" className={styles.label}>
              Código EAN-13 de prueba (13 dígitos)
            </label>
            <input
              id="simulator-input"
              type="text"
              className={styles.input}
              value={testBarcode}
              onChange={(e) => setTestBarcode(e.target.value.replace(/\D/g, "").slice(0, 13))}
              placeholder="2012345005007"
              maxLength={13}
            />
          </div>

          {simResult && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "6px",
                backgroundColor: simResult.valid ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${simResult.valid ? "#bbf7d0" : "#fecaca"}`,
                color: simResult.valid ? "#166534" : "#991b1b",
              }}
            >
              {simResult.valid ? (
                <div>
                  <strong>✓ Descomposición Correcta:</strong>
                  <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                    <li>SKU Extraído: <code>{simResult.sku}</code></li>
                    <li>{mode === "PRICE" ? "Monto Total" : "Peso Total"}: <strong>{simResult.amount}</strong></li>
                    <li>Dígito de Chequeo: <code>{simResult.checkDigit}</code></li>
                  </ul>
                </div>
              ) : (
                <div>
                  <strong>✗ No coincide:</strong> {simResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
