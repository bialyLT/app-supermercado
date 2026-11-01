"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./promotion-manager.module.css";

type Promotion = {
  id: string;
  tenantId: string;
  branchId: string | null;
  categoryId: string;
  name: string;
  n: string;
  m: string;
  active: boolean;
  validFrom: string | null;
  validTo: string | null;
};

type PromotionForm = {
  branchId: string;
  categoryId: string;
  name: string;
  n: string;
  m: string;
  active: boolean;
  validFrom: string;
  validTo: string;
};

const emptyForm: PromotionForm = {
  branchId: "",
  categoryId: "",
  name: "",
  n: "2",
  m: "1",
  active: true,
  validFrom: "",
  validTo: "",
};

function toInputDate(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

function toPayload(form: PromotionForm) {
  return {
    branchId: form.branchId || null,
    categoryId: form.categoryId,
    name: form.name,
    n: form.n,
    m: form.m,
    active: form.active,
    validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
    validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
  };
}

export default function PromotionManager() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [form, setForm] = useState<PromotionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("Cargando promociones…");
  const [busy, setBusy] = useState(false);

  async function loadPromotions() {
    const response = await fetch("/api/admin/promotions", { cache: "no-store" });
    const body = (await response.json()) as { promotions?: Promotion[]; error?: string };
    if (!response.ok || !body.promotions) throw new Error(body.error ?? "REQUEST_FAILED");
    setPromotions(body.promotions);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/promotions", { cache: "no-store" })
      .then(async (response) => ({ response, body: (await response.json()) as { promotions?: Promotion[]; error?: string } }))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok || !body.promotions) {
          setStatus(body.error ?? "REQUEST_FAILED");
          return;
        }
        setPromotions(body.promotions);
        setStatus("Listo");
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "REQUEST_FAILED");
      });
    return () => { cancelled = true; };
  }, []);

  function editPromotion(promotion: Promotion) {
    setEditingId(promotion.id);
    setForm({
      branchId: promotion.branchId ?? "",
      categoryId: promotion.categoryId,
      name: promotion.name,
      n: promotion.n,
      m: promotion.m,
      active: promotion.active,
      validFrom: toInputDate(promotion.validFrom),
      validTo: toInputDate(promotion.validTo),
    });
    setStatus(`Editando ${promotion.name}`);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setStatus("Nueva promoción");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("Guardando…");
    try {
      const endpoint = editingId ? `/api/admin/promotions/${editingId}` : "/api/admin/promotions";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "REQUEST_FAILED");
      await loadPromotions();
      resetForm();
      setStatus("Promoción guardada");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    setBusy(true);
    setStatus("Desactivando…");
    try {
      const response = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      const body = (await response.json()) as Promotion | { error?: string };
      if (!response.ok || !("id" in body)) throw new Error(("error" in body && body.error) || "REQUEST_FAILED");
      setPromotions((current) => current.map((promotion) => promotion.id === body.id ? body : promotion));
      setStatus("Promoción desactivada");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page} aria-labelledby="promotions-title">
      <header>
        <h1 id="promotions-title">Promociones N×M</h1>
        <p className={styles.intro}>Configuración server-side por categoría, tenant y sucursal opcional.</p>
      </header>
      <p className={styles.status} role="status" aria-live="polite">{status}</p>

      <section className={styles.card} aria-labelledby="promotion-form-title">
        <h2 id="promotion-form-title">{editingId ? "Editar promoción" : "Nueva promoción"}</h2>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="promotion-category">Categoría UUID</label>
            <input className={styles.input} id="promotion-category" required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="promotion-branch">Sucursal UUID (opcional)</label>
            <input className={styles.input} id="promotion-branch" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })} />
          </div>
          <div className={`${styles.field} ${styles.fieldWide}`}>
            <label className={styles.label} htmlFor="promotion-name">Nombre</label>
            <input className={styles.input} id="promotion-name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="promotion-n">Llevar N</label>
            <input className={styles.input} id="promotion-n" required inputMode="numeric" pattern="[1-9][0-9]*" value={form.n} onChange={(event) => setForm({ ...form, n: event.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="promotion-m">Pagar M</label>
            <input className={styles.input} id="promotion-m" required inputMode="numeric" pattern="[1-9][0-9]*" value={form.m} onChange={(event) => setForm({ ...form, m: event.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="promotion-from">Vigente desde</label>
            <input className={styles.input} id="promotion-from" type="datetime-local" value={form.validFrom} onChange={(event) => setForm({ ...form, validFrom: event.target.value })} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="promotion-to">Vigente hasta</label>
            <input className={styles.input} id="promotion-to" type="datetime-local" value={form.validTo} onChange={(event) => setForm({ ...form, validTo: event.target.value })} />
          </div>
          <label className={styles.checkboxField} htmlFor="promotion-active">
            <input className={styles.checkbox} id="promotion-active" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Activa
          </label>
          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={busy}>{editingId ? "Guardar cambios" : "Crear promoción"}</button>
            {editingId ? <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={resetForm} disabled={busy}>Cancelar</button> : null}
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="promotion-list-title">
        <h2 id="promotion-list-title">Promociones configuradas</h2>
        {promotions.length === 0 ? <p>No hay promociones configuradas.</p> : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr><th>Nombre</th><th>Regla</th><th>Categoría</th><th>Alcance</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => (
                  <tr key={promotion.id}>
                    <td>{promotion.name}</td>
                    <td>{promotion.n}×{promotion.m}</td>
                    <td>{promotion.categoryId}</td>
                    <td>{promotion.branchId ?? "Tenant"}</td>
                    <td>{promotion.active ? "Activa" : "Inactiva"}</td>
                    <td className={styles.actionsCell}>
                      <button className={`${styles.button} ${styles.buttonSecondary}`} type="button" onClick={() => editPromotion(promotion)} disabled={busy}>Editar</button>
                      {promotion.active ? <button className={styles.button} type="button" onClick={() => deactivate(promotion.id)} disabled={busy}>Desactivar</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
