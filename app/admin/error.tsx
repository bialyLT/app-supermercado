"use client";

import React, { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors for audit/monitoring
    console.error("Admin section error:", error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        padding: "32px",
        margin: "24px 0",
        backgroundColor: "var(--color-danger-bg, #fef2f2)",
        border: "1px solid var(--color-danger-border, #fecaca)",
        borderRadius: "var(--radius-lg, 8px)",
        textAlign: "center",
      }}
    >
      <h2
        style={{
          color: "var(--color-danger, #dc2626)",
          marginTop: 0,
          marginBottom: "12px",
          fontSize: "1.25rem",
        }}
      >
        Error al cargar la sección administrativa
      </h2>
      <p
        style={{
          color: "var(--color-text, #0f172a)",
          marginBottom: "24px",
          maxWidth: "480px",
          marginInline: "auto",
        }}
      >
        {error.message || "Ocurrió un error inesperado al procesar la solicitud."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px 20px",
          minHeight: "44px",
          minWidth: "44px",
          backgroundColor: "var(--color-primary, #0284c7)",
          color: "#ffffff",
          border: "none",
          borderRadius: "var(--radius-md, 6px)",
          fontSize: "0.95rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Intentar nuevamente
      </button>
    </div>
  );
}
