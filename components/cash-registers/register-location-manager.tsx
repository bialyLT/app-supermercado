"use client";

import { useEffect, useState } from "react";
import styles from "./register-location-manager.module.css";

type Register = {
  id: string;
  name: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
};

type LocationOption = {
  id: string;
  code: string;
  name: string;
  branchId: string;
  branchCode: string;
  branchName: string;
};

async function fetchRegisterAssignments(): Promise<{ registers: Register[]; locations: LocationOption[] }> {
  const response = await fetch("/api/admin/cash-registers");
  const body = await response.json().catch(() => ({})) as { registers?: Register[]; locations?: LocationOption[]; error?: string };
  if (!response.ok || !body.registers) throw new Error(`No se pudo cargar: ${body.error ?? "REQUEST_FAILED"}`);
  return { registers: body.registers, locations: body.locations ?? [] };
}

function registerAssignmentErrorMessage(error: unknown): string {
  if (error instanceof TypeError) return "No se pudo conectar con el sistema";
  return error instanceof Error ? error.message : "No se pudo cargar: REQUEST_FAILED";
}

export function RegisterLocationManager() {
  const [registers, setRegisters] = useState<Register[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(): Promise<boolean> {
    try {
      const assignments = await fetchRegisterAssignments();
      setRegisters(assignments.registers);
      setLocations(assignments.locations);
      return true;
    } catch (error) {
      setStatus(registerAssignmentErrorMessage(error));
      return false;
    }
  }

  useEffect(() => {
    let active = true;
    fetchRegisterAssignments()
      .then((assignments) => {
        if (!active) return;
        setRegisters(assignments.registers);
        setLocations(assignments.locations);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(registerAssignmentErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);

  async function assign(registerId: string) {
    const locationId = selection[registerId];
    if (!locationId) {
      setStatus("Elegí una ubicación activa de la misma sucursal");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/cash-registers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registerId, locationId }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (response.ok) {
        const refreshed = await load();
        setStatus(refreshed
          ? "Ubicación asignada y auditada"
          : "Ubicación asignada; no se pudo actualizar la lista");
      } else {
        setStatus(`No se pudo asignar: ${body.error ?? "REQUEST_FAILED"}`);
      }
    } catch {
      setStatus("No se pudo conectar con el sistema");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.shell} aria-labelledby="cash-registers-title">
      <header>
        <h1 id="cash-registers-title">Cajas y ubicaciones</h1>
        <p>Solo ADMIN asigna la ubicación activa de cada caja. El cambio aplica al próximo turno; el turno abierto conserva su ubicación.</p>
      </header>
      {status ? <p role="status">{status}</p> : null}
      <ul className={styles.list}>
        {registers.map((register) => {
          const options = locations.filter((location) => location.branchId === register.branchId);
          return (
            <li key={register.id} className={styles.card}>
              <h2>{register.name} · {register.branchName} ({register.branchCode})</h2>
              <p>Ubicación actual: {register.locationName ? `${register.locationName} (${register.locationCode})` : "sin asignar — la caja no puede abrir turno"}</p>
              <label>Ubicación activa de {register.branchName}
                <select
                  value={selection[register.id] ?? register.locationId ?? ""}
                  onChange={(event) => setSelection((current) => ({ ...current, [register.id]: event.target.value }))}
                >
                  <option value="">Sin asignar</option>
                  {options.map((location) => (
                    <option key={location.id} value={location.id}>{location.name} ({location.code})</option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={busy} onClick={() => assign(register.id)}>Asignar ubicación</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
