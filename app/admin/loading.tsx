import React from "react";

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted, #475569)",
        gap: "16px",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: "36px",
          height: "36px",
          border: "3px solid #e2e8f0",
          borderTopColor: "var(--color-primary, #0284c7)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <span style={{ fontSize: "1rem", fontWeight: 500 }}>
        Cargando panel de administración…
      </span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
