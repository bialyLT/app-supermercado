"use client";

import { useState } from "react";
import styles from "./cash-shifts-manager.module.css";

type Action = "open" | "movement" | "blind-close" | "close";

export function CashShiftsManager() {
  const [action, setAction] = useState<Action>("open");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function update(name: string, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/cash-shifts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...fields }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; id?: string };
      setStatus(response.ok ? `Operación confirmada${body.id ? `: ${body.id}` : ""}` : `No se pudo completar: ${body.error ?? "REQUEST_FAILED"}`);
    } catch {
      setStatus("No se pudo conectar con el sistema");
    } finally {
      setBusy(false);
    }
  }

  const needsAmount = action === "open" || action === "movement" || action === "blind-close";

  return (
    <section className={styles.shell} aria-labelledby="cash-shifts-title">
      <header>
        <h1 id="cash-shifts-title">Arqueos y Turnos</h1>
        <p>Operaciones de caja auditadas y protegidas por permisos del servidor.</p>
      </header>
      <nav className={styles.tabs} aria-label="Operaciones de caja">
        {(["open", "movement", "blind-close", "close"] as const).map((value) => (
          <button key={value} type="button" className={action === value ? styles.activeTab : styles.tab} onClick={() => setAction(value)}>
            {value === "open" ? "Abrir turno" : value === "movement" ? "Movimiento" : value === "blind-close" ? "Arqueo ciego" : "Cerrar turno"}
          </button>
        ))}
      </nav>
      <form className={styles.form} onSubmit={submit}>
        {action === "open" ? (
          <label>UUID de caja<input required value={fields.registerId ?? ""} onChange={(event) => update("registerId", event.target.value)} /></label>
        ) : (
          <label>UUID de turno<input required value={fields.registerSessionId ?? ""} onChange={(event) => update("registerSessionId", event.target.value)} /></label>
        )}
        {action === "movement" && <label>Tipo<select value={fields.type ?? "CASH_IN"} onChange={(event) => update("type", event.target.value)}><option value="CASH_IN">Ingreso</option><option value="CASH_OUT">Egreso</option></select></label>}
        {needsAmount && <label>{action === "blind-close" ? "Efectivo contado" : "Importe"}<input required inputMode="decimal" value={fields[action === "blind-close" ? "countedCashAmount" : action === "open" ? "openingAmount" : "amount"] ?? ""} onChange={(event) => update(action === "blind-close" ? "countedCashAmount" : action === "open" ? "openingAmount" : "amount", event.target.value)} /></label>}
        {action !== "close" && <label>Motivo<input required value={fields[action === "open" ? "openingReason" : "reason"] ?? ""} onChange={(event) => update(action === "open" ? "openingReason" : "reason", event.target.value)} /></label>}
        <button type="submit" disabled={busy}>{busy ? "Procesando…" : "Confirmar operación"}</button>
      </form>
      <p role="status" aria-live="polite">{status}</p>
    </section>
  );
}
