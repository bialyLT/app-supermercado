import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductCombobox } from "../components/product-combobox";

const options = [{ id: "variant-1", sku: "SKU-1", name: "Roja", productName: "Manzana" }];

describe("ProductCombobox", () => {
  it("renders an accessible combobox with a stable label and autocomplete disabled", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ProductCombobox, {
        label: "Variante / código",
        placeholder: "Buscar producto",
        value: "Manzana",
        options,
        onChange: () => undefined,
        onSelect: () => undefined,
      })
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Variante / código"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('autoComplete="off"');
  });

  it("does not render catalog options before the field receives focus", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ProductCombobox, {
        label: "Variante / código",
        placeholder: "Buscar producto",
        value: "Manzana",
        options,
        onChange: () => undefined,
        onSelect: () => undefined,
      })
    );

    expect(markup).not.toContain('role="listbox"');
    expect(markup).not.toContain("SKU-1");
  });
});
