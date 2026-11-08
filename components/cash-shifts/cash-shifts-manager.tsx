"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./cash-shifts-manager.module.css";

type Action = "open" | "movement" | "blind-close" | "close";
type RegisterLoadState = "loading" | "ready" | "error";

type RegisterOption = {
  id: string;
  name: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
};

export function cashRegisterOptionLabel(register: Pick<RegisterOption, "name" | "branchCode" | "branchName" | "locationCode" | "locationName">): string {
  const location = register.locationName
    ? ` · ${register.locationName}${register.locationCode ? ` (${register.locationCode})` : ""}`
    : "";
  return `${register.name} — ${register.branchName} (${register.branchCode})${location}`;
}

async function fetchCashRegisterOptions(): Promise<RegisterOption[]> {
  const response = await fetch("/api/admin/cash-shifts");
  const body = await response.json().catch(() => ({})) as { registers?: RegisterOption[]; error?: string };
  if (!response.ok || !Array.isArray(body.registers)) throw new Error(body.error ?? "REQUEST_FAILED");
  return body.registers;
}

export function CashShiftsManager() {
  const [action, setAction] = useState<Action>("open");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [registers, setRegisters] = useState<RegisterOption[]>([]);
  const [registerState, setRegisterState] = useState<RegisterLoadState>("loading");

  const loadRegisters = useCallback(async () => {
    try {
      const options = await fetchCashRegisterOptions();
      setRegisters(options);
      setRegisterState("ready");
    } catch {
      setRegisters([]);
      setFields((current) => ({ ...current, registerId: "" }));
      setRegisterState("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchCashRegisterOptions()
      .then((options) => {
        if (!active) return;
        setRegisters(options);
        setRegisterState("ready");
      })
      .catch(() => {
        if (!active) return;
        setRegisters([]);
        setFields((current) => ({ ...current, registerId: "" }));
        setRegisterState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  function retryRegisters() {
    setRegisterState("loading");
    void loadRegisters();
  }

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
  const openingUnavailable = action === "open" && (registerState !== "ready" || !fields.registerId);

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
          <div className={styles.registerField}>
            <label htmlFor="cash-register">Caja</label>
            <select
              id="cash-register"
              name="registerId"
              required
              disabled={busy || registerState !== "ready" || registers.length === 0}
              value={fields.registerId ?? ""}
              onChange={(event) => update("registerId", event.target.value)}
            >
              <option value="">
                {registerState === "loading" ? "Cargando cajas…" : registerState === "error" ? "Cajas no disponibles" : "Seleccioná una caja"}
              </option>
              {registers.map((register) => (
                <option key={register.id} value={register.id}>{cashRegisterOptionLabel(register)}</option>
              ))}
            </select>
            {registerState === "loading" && <p className={styles.fieldMessage} role="status">Cargando cajas autorizadas…</p>}
            {registerState === "error" && (
              <div className={styles.errorMessage} role="alert">
                <p>No se pudieron cargar las cajas autorizadas. Reintentá.</p>
                <button type="button" className={styles.retryButton} onClick={retryRegisters}>Reintentar cajas</button>
              </div>
            )}
            {registerState === "ready" && registers.length === 0 && (
              <p className={styles.fieldMessage} role="status">No hay cajas en tus sucursales autorizadas.</p>
            )}
          </div>
        ) : (
          <label>UUID de turno<input required value={fields.registerSessionId ?? ""} onChange={(event) => update("registerSessionId", event.target.value)} /></label>
        )}
        {action === "movement" && <label>Tipo<select value={fields.type ?? "CASH_IN"} onChange={(event) => update("type", event.target.value)}><option value="CASH_IN">Ingreso</option><option value="CASH_OUT">Egreso</option></select></label>}
        {needsAmount && <label>{action === "blind-close" ? "Efectivo contado" : "Importe"}<input required inputMode="decimal" value={fields[action === "blind-close" ? "countedCashAmount" : action === "open" ? "openingAmount" : "amount"] ?? ""} onChange={(event) => update(action === "blind-close" ? "countedCashAmount" : action === "open" ? "openingAmount" : "amount", event.target.value)} /></label>}
        {action !== "close" && <label>Motivo<input required value={fields[action === "open" ? "openingReason" : "reason"] ?? ""} onChange={(event) => update(action === "open" ? "openingReason" : "reason", event.target.value)} /></label>}
        <button type="submit" disabled={busy || openingUnavailable}>{busy ? "Procesando…" : "Confirmar operación"}</button>
      </form>
      <p role="status" aria-live="polite">{status}</p>
    </section>
  );
}
