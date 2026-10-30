"use client";

import React, { useState, useRef, useEffect } from "react";
import type { RoleName } from "../../src/domain/contracts";
import styles from "./admin-operations.module.css";

export type BranchOption = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
};

export type CreatedUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: RoleName;
  readonly branchName?: string;
  readonly createdAt: string;
};

export type UsersManagerProps = {
  readonly branches?: readonly BranchOption[];
};

const ROLES: readonly RoleName[] = ["ADMIN", "STOCK_MANAGER", "SUPERVISOR", "CASHIER"];

export function UsersManager({ branches = [] }: UsersManagerProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("CASHIER");
  const [branchId, setBranchId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionUsers, setSessionUsers] = useState<CreatedUser[]>([]);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        emailInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setError(null);
        setSuccess(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 12) {
      setError("La contraseña debe tener al menos 12 caracteres (política de seguridad).");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: {
        email: string;
        displayName: string;
        password: string;
        role: RoleName;
        branchId?: string;
      } = {
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        password,
        role,
      };

      if (branchId) {
        payload.branchId = branchId;
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = "Error al crear usuario";
        if (data.error === "INVALID_INPUT") msg = "Entrada inválida o formato incorrecto (400 INVALID_INPUT)";
        else if (data.error === "UNAUTHENTICATED") msg = "Sesión no autenticada (401 UNAUTHENTICATED)";
        else if (data.error === "FORBIDDEN") msg = "Acceso denegado: se requiere rol ADMIN (403 FORBIDDEN)";
        else if (data.error === "NOT_FOUND") msg = "Sucursal no asignada o no encontrada (404 NOT_FOUND)";
        else if (data.error) msg = `Error: ${data.error}`;
        throw new Error(msg);
      }

      const branchObj = branches.find((b) => b.id === branchId);
      const newUser: CreatedUser = {
        id: data.id,
        email: data.email,
        displayName: displayName.trim(),
        role,
        branchName: branchObj ? `${branchObj.name} (${branchObj.code})` : "Tenant-wide (Todas)",
        createdAt: new Date().toLocaleTimeString(),
      };

      setSessionUsers((prev) => [newUser, ...prev]);
      setSuccess(`Usuario ${data.email} creado exitosamente con rol ${role}.`);
      setEmail("");
      setDisplayName("");
      setPassword("");
      setBranchId("");
      emailInputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado al contactar con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getBadgeClass(r: RoleName) {
    switch (r) {
      case "ADMIN":
        return styles.badgeAdmin;
      case "STOCK_MANAGER":
        return styles.badgeStock;
      case "SUPERVISOR":
        return styles.badgeSupervisor;
      default:
        return styles.badgeCashier;
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Usuarios y Asignaciones</h1>
          <p className={styles.subtitle}>
            Alta de personal, asignación de roles operativos y vinculación a sucursales autorizadas
          </p>
        </div>
      </header>

      <section className={styles.shortcutsBar} aria-label="Atajos de teclado">
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Alt+N</kbd> Enfocar formulario
        </span>
        <span className={styles.shortcutItem}>
          <kbd className={styles.kbd}>Enter</kbd> Registrar usuario
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
        <h2 className={styles.cardTitle}>Nuevo Usuario del Sistema</h2>
        <p className={styles.cardDescription}>
          Los roles son server-authoritative. La contraseña requiere un mínimo de 12 caracteres.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid2}>
            <div className={styles.fieldGroup}>
              <label htmlFor="user-email" className={`${styles.label} ${styles.labelRequired}`}>
                Correo Electrónico
              </label>
              <input
                ref={emailInputRef}
                id="user-email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@kiosco.com"
                required
                maxLength={254}
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Identificador único de autenticación</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="user-displayname" className={`${styles.label} ${styles.labelRequired}`}>
                Nombre Visible
              </label>
              <input
                id="user-displayname"
                type="text"
                className={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Juan Pérez"
                required
                maxLength={120}
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Nombre para auditoría y visualización de tickets</p>
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.fieldGroup}>
              <label htmlFor="user-password" className={`${styles.label} ${styles.labelRequired}`}>
                Contraseña Temporal
              </label>
              <input
                id="user-password"
                type="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 12 caracteres"
                required
                minLength={12}
                maxLength={128}
                disabled={isSubmitting}
              />
              <p className={styles.helperText}>Debe tener al menos 12 caracteres</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="user-role" className={`${styles.label} ${styles.labelRequired}`}>
                Rol de Acceso
              </label>
              <select
                id="user-role"
                className={styles.select}
                value={role}
                onChange={(e) => setRole(e.target.value as RoleName)}
                disabled={isSubmitting}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className={styles.helperText}>Determina los permisos autorizados en el servidor</p>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="user-branch" className={styles.label}>
                Sucursal Asignada
              </label>
              <select
                id="user-branch"
                className={styles.select}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Tenant-wide (Sin restricción de sucursal)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <p className={styles.helperText}>Límite operativo territorial de la cuenta</p>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting || !email.trim() || !displayName.trim() || password.length < 12}
            >
              {isSubmitting ? "Registrando usuario..." : "Crear Usuario"}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Usuarios Registrados en esta Sesión</h2>
        <p className={styles.cardDescription}>
          Registro local de cuentas creadas recientemente mediante la API segura
        </p>

        {sessionUsers.length === 0 ? (
          <div className={styles.emptyState}>
            No se han registrado usuarios en esta sesión. Utilice el formulario superior para dar de alta personal.
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Correo</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Sucursal</th>
                </tr>
              </thead>
              <tbody>
                {sessionUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.createdAt}</td>
                    <td><strong>{u.email}</strong></td>
                    <td>{u.displayName}</td>
                    <td>
                      <span className={`${styles.badge} ${getBadgeClass(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.branchName}</td>
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
