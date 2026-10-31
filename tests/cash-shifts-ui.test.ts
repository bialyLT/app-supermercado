import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CashShiftsManager } from "../components/cash-shifts/cash-shifts-manager";

describe("cash shifts UI", () => {
  it("exposes the approved cash operations", () => {
    const markup = renderToStaticMarkup(React.createElement(CashShiftsManager));
    expect(markup).toContain("Arqueos y Turnos");
    expect(markup).toContain("Abrir turno");
    expect(markup).toContain("Movimiento");
    expect(markup).toContain("Arqueo ciego");
    expect(markup).toContain("Cerrar turno");
  });
});
