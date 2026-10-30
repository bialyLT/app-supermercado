"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import styles from "./suppliers.module.css";

export type Supplier = {
  id: string;
  code: string;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  active: boolean;
};

export type SupplierManagerProps = {
  readonly initialSuppliers?: readonly Supplier[];
};

export function SupplierManager({ initialSuppliers = [] }: SupplierManagerProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([...initialSuppliers]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsModalOpen(true);
      }
      if (e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (isModalOpen) {
          setIsModalOpen(false);
          setFormError(null);
        } else {
          setFeedback(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => codeInputRef.current?.focus(), 50);
    }
  }, [isModalOpen]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter(
      (s) =>
        s.code.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term) ||
        (s.taxId && s.taxId.toLowerCase().includes(term))
    );
  }, [suppliers, search]);

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!code.trim() || !name.trim()) {
      setFormError("El código y la razón social son obligatorios.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: {
        code: string;
        name: string;
        taxId?: string;
        email?: string;
        phone?: string;
        address?: string;
        active: boolean;
      } = {
        code: code.trim(),
        name: name.trim(),
        active,
      };

      if (taxId.trim()) payload.taxId = taxId.trim();
      if (email.trim()) payload.email = email.trim();
      if (phone.trim()) payload.phone = phone.trim();
      if (address.trim()) payload.address = address.trim();

      const res = await fetch("/api/admin/purchases/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === "FORBIDDEN") {
          throw new Error("Acceso denegado: se requiere permiso de inventario (403 FORBIDDEN)");
        }
        if (data.error === "UNAUTHENTICATED") {
          throw new Error("Sesión no autenticada (401 UNAUTHENTICATED)");
        }
        if (data.error === "INVALID_INPUT") {
          throw new Error("Datos inválidos: verifique el código y correo electrónico");
        }
        throw new Error(data.detail || data.error || "Error al crear proveedor");
      }

      const created: Supplier = {
        id: data.id,
        code: data.code,
        name: data.name,
        taxId: data.taxId ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        active: data.active ?? true,
      };

      setSuppliers((prev) => [created, ...prev]);
      setFeedback(`Proveedor «${created.name}» (${created.code}) registrado correctamente.`);
      setIsModalOpen(false);
      // Reset form
      setCode("");
      setName("");
      setTaxId("");
      setEmail("");
      setPhone("");
      setAddress("");
      setActive(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error inesperado al contactar con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Gestión de Proveedores</h1>
          <p className={styles.subtitle}>
            Catálogo comercial de proveedores autorizados para compras y órdenes de abastecimiento
          </p>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => setIsModalOpen(true)}
          aria-haspopup="dialog"
        >
          + Nuevo Proveedor
        </button>
      </header>

      <section className={styles.shortcutsBar} aria-label="Atajos de teclado">
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Alt+N</kbd> Nuevo proveedor
        </span>
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Alt+F</kbd> Buscar proveedor
        </span>
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Esc</kbd> Cerrar modal o descartar
        </span>
      </section>

      {feedback && (
        <div className={styles.alertSuccess} role="status" aria-live="polite">
          <strong>Éxito:</strong> {feedback}
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            ref={searchInputRef}
            id="supplier-search"
            type="search"
            className={styles.input}
            placeholder="Buscar por código, razón social o CUIT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar proveedores"
          />
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted, #64748b)" }}>
          Total: {filteredSuppliers.length} proveedor{filteredSuppliers.length === 1 ? "" : "es"}
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Razón Social</th>
              <th>Identificación Fiscal</th>
              <th>Contacto</th>
              <th>Dirección</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <p>
                      {search.trim()
                        ? `No se encontraron proveedores que coincidan con «${search}».`
                        : "No hay proveedores registrados en el sistema."}
                    </p>
                    {!search.trim() && (
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => setIsModalOpen(true)}
                        style={{ marginTop: "8px" }}
                      >
                        Crear Primer Proveedor
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((s) => (
                <tr key={s.id}>
                  <td><code>{s.code}</code></td>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.taxId || "—"}</td>
                  <td>
                    {s.email && <div>{s.email}</div>}
                    {s.phone && <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{s.phone}</div>}
                    {!s.email && !s.phone && "—"}
                  </td>
                  <td>{s.address || "—"}</td>
                  <td>
                    <span className={s.active ? styles.badgeActive : styles.badgeInactive}>
                      {s.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de alta de proveedor */}
      {isModalOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-modal-title"
        >
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 id="supplier-modal-title" className={styles.title} style={{ fontSize: "1.25rem" }}>
                Nuevo Proveedor Comercial
              </h2>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setIsModalOpen(false);
                  setFormError(null);
                }}
                aria-label="Cerrar modal"
                style={{ minHeight: "36px", padding: "4px 10px" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className={styles.alertBanner} role="alert" aria-live="assertive">
                <strong>Error:</strong> {formError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className={styles.grid2}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="supplier-code" className={`${styles.label} ${styles.labelRequired}`}>
                    Código
                  </label>
                  <input
                    ref={codeInputRef}
                    id="supplier-code"
                    type="text"
                    className={styles.input}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="PROV-001"
                    required
                    maxLength={64}
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="supplier-name" className={`${styles.label} ${styles.labelRequired}`}>
                    Razón Social
                  </label>
                  <input
                    id="supplier-name"
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Distribuidora Alimentos SA"
                    required
                    maxLength={200}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="supplier-taxid" className={styles.label}>
                    Identificación Fiscal (CUIT / RFC)
                  </label>
                  <input
                    id="supplier-taxid"
                    type="text"
                    className={styles.input}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="30-12345678-9"
                    maxLength={64}
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="supplier-email" className={styles.label}>
                    Correo Electrónico
                  </label>
                  <input
                    id="supplier-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@proveedor.com"
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="supplier-phone" className={styles.label}>
                    Teléfono
                  </label>
                  <input
                    id="supplier-phone"
                    type="tel"
                    className={styles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+54 11 4444-5555"
                    maxLength={50}
                    disabled={isSubmitting}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="supplier-address" className={styles.label}>
                    Dirección Comercial
                  </label>
                  <input
                    id="supplier-address"
                    type="text"
                    className={styles.input}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Libertador 500"
                    maxLength={255}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <input
                  id="supplier-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={isSubmitting}
                  style={{ width: "18px", height: "18px", accentColor: "var(--color-primary, #0284c7)" }}
                />
                <label htmlFor="supplier-active" className={styles.label} style={{ cursor: "pointer" }}>
                  Proveedor activo para operaciones comerciales
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormError(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={isSubmitting || !code.trim() || !name.trim()}
                >
                  {isSubmitting ? "Registrando..." : "Guardar Proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
