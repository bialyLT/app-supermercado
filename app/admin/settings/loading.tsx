import React from "react";

export default function SettingsLoading() {
  return (
    <div style={{ padding: "24px", color: "var(--color-text-muted, #64748b)" }} role="status" aria-live="polite">
      <p>Cargando panel de configuración...</p>
    </div>
  );
}
