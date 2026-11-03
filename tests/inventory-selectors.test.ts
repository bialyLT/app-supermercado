import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import {
  LocationSelect,
  isVariantSelectionStale,
  locationFilterDisplay,
  locationOptionLabel,
  parseCatalogSearchResults,
  parseOperationalContext,
  toContextErrorMessage,
  validateReceiptSelection,
  variantDisplayName,
} from "../components/inventory/inventory-selectors";
import { ApiError } from "../src/client/api-fetch";
import {
  createReceiptFormState,
  updateReceiptFormState,
} from "../components/inventory/inventory-ui";

const contextPayload = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  branches: [],
  locations: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      code: "DEP-01",
      name: "Depósito central",
      type: "WAREHOUSE",
      branchId: "33333333-3333-4333-8333-333333333333",
      active: true,
    },
  ],
};

const catalogPayload = {
  items: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      sku: "YER-500",
      name: "Yerba 500g",
      productName: "Yerba",
    },
  ],
};

describe("selectores legibles de inventario", () => {
  it("valida el contexto operativo y rechaza respuestas malformadas", () => {
    expect(parseOperationalContext(contextPayload).locations).toHaveLength(1);
    expect(() =>
      parseOperationalContext({ tenantId: "x", branches: [], locations: [{ id: "no-uuid" }] }),
    ).toThrow("Respuesta inválida del servidor.");
  });

  it("valida el catálogo y rechaza respuestas malformadas", () => {
    expect(parseCatalogSearchResults(catalogPayload)).toHaveLength(1);
    expect(() => parseCatalogSearchResults({ items: [{ id: 42 }] })).toThrow(
      "Respuesta inválida del servidor.",
    );
  });

  it("muestra ubicación y variante con nombre legible", () => {
    expect(locationOptionLabel({ name: "Depósito central", code: "DEP-01" })).toBe(
      "Depósito central (DEP-01)",
    );
    expect(
      variantDisplayName({ sku: "YER-500", name: "Yerba 500g", productName: "Yerba" }),
    ).toBe("YER-500 — Yerba (Yerba 500g)");
  });

  it("invalida la variante seleccionada cuando se edita el texto", () => {
    expect(isVariantSelectionStale("Yerba 50", "YER-500 — Yerba (Yerba 500g)")).toBe(true);
    expect(
      isVariantSelectionStale("YER-500 — Yerba (Yerba 500g)", "YER-500 — Yerba (Yerba 500g)"),
    ).toBe(false);
  });

  it("exige selección de catálogo en lugar de texto libre", () => {
    expect(
      validateReceiptSelection({
        locationId: "",
        variantId: "44444444-4444-4444-8444-444444444444",
        query: "YER-500 — Yerba (Yerba 500g)",
        selectedLabel: "YER-500 — Yerba (Yerba 500g)",
        quantity: "2",
        reason: "Compra",
      }),
    ).toContain("ubicación");
    expect(
      validateReceiptSelection({
        locationId: "22222222-2222-4222-8222-222222222222",
        variantId: "44444444-4444-4444-8444-444444444444",
        query: "Yerba edi",
        selectedLabel: "YER-500 — Yerba (Yerba 500g)",
        quantity: "2",
        reason: "Compra",
      }),
    ).toContain("catálogo");
  });

  it("conserva la clave de idempotencia al reintentar con los mismos datos", () => {
    const initial = createReceiptFormState();
    const entered = updateReceiptFormState(initial, "quantity", "2");
    expect(updateReceiptFormState(entered, "quantity", "2").idempotencyKey).toBe(
      entered.idempotencyKey,
    );
  });

  it("representa con veracidad un filtro de ubicación desconocido en la URL", () => {
    const unknownId = "55555555-5555-4555-8555-555555555555";
    const markup = renderToStaticMarkup(
      React.createElement(LocationSelect, {
        id: "inventory-location",
        label: "Ubicación",
        locations: contextPayload.locations,
        value: unknownId,
        onChange: () => undefined,
        includeAllOption: true,
      }),
    );
    expect(markup).toContain(unknownId);
    expect(markup).toContain("filtro aplicado");
    expect(markup).toContain("Todas");
  });

  it("no muestra aviso de filtro aplicado para una ubicación conocida", () => {
    const markup = renderToStaticMarkup(
      React.createElement(LocationSelect, {
        id: "inventory-location",
        label: "Ubicación",
        locations: contextPayload.locations,
        value: "22222222-2222-4222-8222-222222222222",
        onChange: () => undefined,
        includeAllOption: true,
      }),
    );
    expect(markup).not.toContain("filtro aplicado");
  });

  it("describe el filtro de ubicación sin exponer identificadores crudos", () => {
    expect(locationFilterDisplay("", contextPayload.locations)).toBeNull();
    expect(
      locationFilterDisplay("22222222-2222-4222-8222-222222222222", contextPayload.locations),
    ).toBe("Depósito central (DEP-01)");
    expect(
      locationFilterDisplay("55555555-5555-4555-8555-555555555555", contextPayload.locations),
    ).toBe("Filtro por ubicación aplicado");
  });

  it("traduce fallos de contexto sin exponer detalles crudos de validación", () => {
    const zodResult = z.string().uuid().safeParse("no-es-uuid");
    expect(zodResult.success).toBe(false);
    const zodError = zodResult.success ? null : zodResult.error;
    expect(zodError).toBeInstanceOf(z.ZodError);
    expect(toContextErrorMessage(zodError)).toBe("Respuesta inválida del servidor.");
    expect(
      toContextErrorMessage(
        new ApiError(403, "FORBIDDEN", "No tenés permisos para realizar esta acción."),
      ),
    ).toBe("No tenés permisos para realizar esta acción.");
    expect(toContextErrorMessage(null)).toBe("No se pudieron cargar las ubicaciones.");
    expect(toContextErrorMessage(new SyntaxError("Unexpected token"))).toBe(
      "Respuesta inválida del servidor.",
    );
  });

  it("oculta la opción desconocida mientras carga para igualar el markup SSR", () => {
    const unknownId = "55555555-5555-4555-8555-555555555555";
    const baseProps = {
      id: "inventory-location",
      label: "Ubicación",
      locations: contextPayload.locations,
      value: unknownId,
      onChange: () => undefined,
      includeAllOption: true,
    };
    const loadingMarkup = renderToStaticMarkup(
      React.createElement(LocationSelect, { ...baseProps, loading: true }),
    );
    expect(loadingMarkup).not.toContain(unknownId);
    expect(loadingMarkup).not.toContain("filtro aplicado");
    const loadedMarkup = renderToStaticMarkup(
      React.createElement(LocationSelect, { ...baseProps, loading: false }),
    );
    expect(loadedMarkup).toContain(unknownId);
    expect(loadedMarkup).toContain("Ubicación actual (filtro aplicado)");
  });
});
