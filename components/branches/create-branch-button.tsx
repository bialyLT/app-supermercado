"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../modal";
import styles from "./create-branch-button.module.css";

export function CreateBranchButton() {
  const router = useRouter();
  const [simple, setSimple] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/context")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { operationalMode?: string } | null) => {
        if (active && body?.operationalMode === "SIMPLE") setSimple(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!simple) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setError(body.error === "VALIDATION" ? "Completá nombre y código." : "No se pudo crear la sucursal.");
        return;
      }
      router.push("/admin/cash-registers");
      router.refresh();
    } catch {
      setError("No pudimos conectar con el sistema.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-label="Crear sucursal">
      <h2 className={styles.title}>¿Necesitás otra sucursal?</h2>
      <p className={styles.text}>
        Hoy el sistema está en modo kiosco: una sucursal y una caja. Al crear una
        segunda sucursal se habilitan Transferencias y Cajas y ubicaciones.
      </p>
      <button type="button" className={styles.button} onClick={() => setOpen(true)}>
        Crear sucursal
      </button>

      {open ? (
        <Modal ariaLabelledBy="create-branch-title" onRequestClose={() => setOpen(false)} closeDisabled={busy}>
          <h2 id="create-branch-title" className={styles.title}>Crear sucursal</h2>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              Nombre de la sucursal
              <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} />
            </label>
            <label className={styles.field}>
              Código
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required maxLength={20} placeholder="SUCURSAL-2" />
            </label>
            <p className={styles.warning} role="note">
              Al confirmar, el sistema pasa a modo multi-sucursal y aparecen los módulos
              de Transferencias y Cajas. Tus datos actuales no se modifican.
            </p>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => setOpen(false)} disabled={busy}>Cancelar</button>
              <button type="submit" className={styles.button} disabled={busy}>Crear y pasar a multi-sucursal</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
