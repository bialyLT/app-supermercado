import React from "react";

export default function SuppliersLoading() {
  return (
    <div style={{ padding: "24px", color: "var(--color-text-muted, #64748b)" }} role="status" aria-live="polite">
      <p>Cargando catálogo de proveedores...</p>
    </div>
  );
}
