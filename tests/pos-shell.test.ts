import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminShell } from "../components/admin-shell";
import { getVisibleNavItems } from "../components/admin-navigation";
import PosPage from "../app/pos/page";
import type { RoleName } from "../src/domain/contracts";

vi.mock("next/navigation", () => ({
  usePathname: () => "/pos",
  useRouter: () => ({ push: vi.fn() }),
}));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderPosShell(role: RoleName = "ADMIN"): string {
  return renderToStaticMarkup(
    React.createElement(
      AdminShell,
      { initialRole: role, rail: true },
      React.createElement(PosPage)
    )
  );
}

describe("POS administrative shell integration (S4 rail)", () => {
  it("delegates the main landmark to the shell: the POS page renders no main of its own", () => {
    const html = renderToStaticMarkup(React.createElement(PosPage));
    expect(html).not.toContain("<main");
  });

  it("wraps the POS page in exactly one main landmark owned by the shell (S4)", () => {
    const html = renderPosShell();
    expect(html.match(/<main\b/g) ?? []).toHaveLength(1);
    expect(html.match(/<\/main>/g) ?? []).toHaveLength(1);
    const mainTag = html.match(/<main[^>]*>/)?.[0] ?? "";
    expect(mainTag).toContain('aria-label="Punto de venta"');
  });

  it("keeps a single navigation set: main menu plus breadcrumbs (S4)", () => {
    const html = renderPosShell();
    expect(html.match(/<nav\b/g) ?? []).toHaveLength(2);
    expect(html).toContain('aria-label="Menú principal"');
    expect(html).toContain('aria-label="Miga de pan"');
    expect(html.match(/aria-label="Navegación del Punto de Venta"/g)).toHaveLength(1);
  });

  it("exposes an accessible name inside every rail destination link and an icon per destination (S4)", () => {
    const html = renderPosShell();
    const visible = getVisibleNavItems("ADMIN");
    for (const item of visible) {
      const linkPattern = new RegExp(
        `<a[^>]*href="${escapeRegExp(item.href)}"[^>]*>[\\s\\S]*?${escapeRegExp(item.label)}[\\s\\S]*?<\\/a>`
      );
      expect(html).toMatch(linkPattern);
    }
    // One icon per visible destination plus one for the logout control.
    expect(html.match(/<svg\b/g) ?? []).toHaveLength(visible.length + 1);
    expect(html).toContain('aria-hidden="true"');
  });

  it("marks the active POS destination with aria-current=\"page\" (S4)", () => {
    const html = renderPosShell();
    const posLink = html.match(/<a[^>]*href="\/pos"[^>]*>/)?.[0] ?? "";
    expect(posLink).toContain('aria-current="page"');
    const adminHomeLink = html.match(/<a[^>]*href="\/admin"[^>]*>/)?.[0] ?? "";
    expect(adminHomeLink).not.toContain('aria-current="page"');
  });

  it("shows the Admin/POS badge and an explicit expand control with aria-expanded (S4)", () => {
    const html = renderPosShell();
    expect(html).toContain(">POS</span>");
    expect(html).toContain('aria-label="Expandir navegación"');
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).toContain('aria-controls="admin-sidebar"');
  });

  it("renders the cashier POS inside the rail without the administrative restriction banner (S6)", () => {
    const html = renderPosShell("CASHIER");
    expect(html).not.toContain("Acceso no autorizado");
    expect(html).toContain("Buscar o escanear");
    expect(html).not.toContain('href="/admin/purchases"');
  });

  it("keeps the administrative shell exactly as before: no rail controls, no icons (S2)", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminShell, { initialRole: "ADMIN" }, React.createElement("div", null, "Child Content"))
    );
    expect(html).toContain(">Admin</span>");
    expect(html).toContain("Cerrar sesión");
    expect(html).not.toContain("Expandir navegación");
    expect(html).not.toContain("<svg");
  });
});
