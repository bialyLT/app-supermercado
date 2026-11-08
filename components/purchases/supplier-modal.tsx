"use client";

import React, { useState } from "react";
import { Modal } from "../modal";
import { Alert } from "../ui/alert";
import { Button } from "../ui/button";
import type { Supplier } from "./types";
import styles from "./purchases.module.css";

export type SupplierModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (supplier: Supplier) => void;
};

export function SupplierModal({ isOpen, onClose, onCreated }: SupplierModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("Código y nombre son obligatorios");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        active: true,
      };

      const res = await fetch("/api/admin/purchases/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Error al crear proveedor");
      }

      onCreated(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Modal ariaLabelledBy="modal-title" closeDisabled={isBusy} onRequestClose={onClose}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={`${styles.title} ${styles.modalTitleCompact}`}>
            Nuevo Proveedor
          </h2>
          <Button type="button" variant="secondary" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </Button>
        </div>

        {error && <Alert variant="error" title="Error">{error}</Alert>}

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.grid2}>
            <div className={styles.fieldGroup}>
              <label htmlFor="sup-code" className={`${styles.label} ${styles.labelRequired}`}>
                Código
              </label>
              <input
                id="sup-code"
                type="text"
                className={styles.input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PROV-001"
                required
                disabled={isBusy}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="sup-name" className={`${styles.label} ${styles.labelRequired}`}>
                Nombre o Razón Social
              </label>
              <input
                id="sup-name"
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Distribuidora Mayorista SA"
                required
                disabled={isBusy}
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.fieldGroup}>
              <label htmlFor="sup-taxId" className={styles.label}>
                CUIT / Identificador Fiscal
              </label>
              <input
                id="sup-taxId"
                type="text"
                className={styles.input}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="30-12345678-9"
                disabled={isBusy}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="sup-phone" className={styles.label}>
                Teléfono
              </label>
              <input
                id="sup-phone"
                type="tel"
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 11 4444-5555"
                disabled={isBusy}
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.fieldGroup}>
              <label htmlFor="sup-email" className={styles.label}>
                Correo electrónico
              </label>
              <input
                id="sup-email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ventas@proveedor.com"
                disabled={isBusy}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="sup-address" className={styles.label}>
                Dirección
              </label>
              <input
                id="sup-address"
                type="text"
                className={styles.input}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Industrial 1234"
                disabled={isBusy}
              />
            </div>
          </div>

          <div className={`${styles.buttonGroup} ${styles.buttonGroupEnd}`}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isBusy}>
              {isBusy ? "Guardando…" : "Guardar Proveedor"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
