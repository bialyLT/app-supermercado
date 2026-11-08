import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("estilos de selectores de inventario", () => {
  it("expone controles de selector con 44px y foco visible", () => {
    const inventoryCss = readFileSync(
      resolve(__dirname, "../components/inventory/inventory-ui.module.css"),
      "utf8",
    );
    expect(inventoryCss).toMatch(
      /\.field input, \.field select, \.field textarea \{[^}]*min-height:44px/,
    );
    const readCss = readFileSync(
      resolve(__dirname, "../components/operational-read/operational-read.module.css"),
      "utf8",
    );
    expect(readCss).toMatch(/\.field \.selectorControl \{[^}]*min-height: 44px/);
    expect(readCss).toMatch(/\.field \.selectorControl:focus-visible \{[^}]*outline:/);
  });

  it("los botones nuevos de quita y reintento cumplen 44px y foco visible (B2)", () => {
    const readCss = readFileSync(
      resolve(__dirname, "../components/operational-read/operational-read.module.css"),
      "utf8",
    );
    expect(readCss).toMatch(/\.chipRow \.button \{[^}]*min-height: 44px/);
    expect(readCss).toMatch(/\.button:focus-visible[^\{]*\{[^}]*outline:/);
  });
});
