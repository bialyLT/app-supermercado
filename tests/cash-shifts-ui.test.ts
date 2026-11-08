import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CashShiftsManager, cashRegisterOptionLabel } from "../components/cash-shifts/cash-shifts-manager";

describe("cash shifts UI", () => {
  it("exposes the approved cash operations", () => {
    const markup = renderToStaticMarkup(React.createElement(CashShiftsManager));
    expect(markup).toContain("Arqueos y Turnos");
    expect(markup).toContain("Abrir turno");
    expect(markup).toContain("Movimiento");
    expect(markup).toContain("Arqueo ciego");
    expect(markup).toContain("Cerrar turno");
  });

  it("uses an accessible native register selector instead of UUID text entry", () => {
    const markup = renderToStaticMarkup(React.createElement(CashShiftsManager));
    expect(markup).toContain('for="cash-register"');
    expect(markup).toContain('<select id="cash-register"');
    expect(markup).toContain("Cargando cajas");
    expect(markup).not.toContain("UUID de caja");
    expect(markup).not.toContain('<label>UUID de caja<input');
  });

  it("labels options by register and branch, with the configured location when present", () => {
    const register = {
      name: "Caja 1",
      branchName: "Centro",
      branchCode: "CEN",
      locationName: "Mostrador",
      locationCode: "MOS",
    };
    expect(cashRegisterOptionLabel(register)).toBe("Caja 1 — Centro (CEN) · Mostrador (MOS)");
    expect(cashRegisterOptionLabel({ ...register, locationName: null, locationCode: null })).toBe("Caja 1 — Centro (CEN)");
  });
});
