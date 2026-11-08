import type { Page } from "@playwright/test";

// Fixture compartido para los E2E de selectores legibles (recepciones e
// inventario). La autenticación sigue en ./auth; aquí solo viven los datos
// mockeados comunes para no duplicarlos entre specs.

export const LOCATION_ID = "22222222-2222-4222-8222-222222222222";
export const UNKNOWN_LOCATION_ID = "55555555-5555-4555-8555-555555555555";
export const VARIANT_ID = "44444444-4444-4444-8444-444444444444";

export const CONTEXT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  branches: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      code: "SUC-01",
      name: "Sucursal centro",
      locations: [
        {
          id: LOCATION_ID,
          code: "DEP-01",
          name: "Depósito central",
          type: "WAREHOUSE",
          branchId: "33333333-3333-4333-8333-333333333333",
          active: true,
        },
      ],
    },
  ],
  locations: [
    {
      id: LOCATION_ID,
      code: "DEP-01",
      name: "Depósito central",
      type: "WAREHOUSE",
      branchId: "33333333-3333-4333-8333-333333333333",
      active: true,
    },
  ],
};

export const CATALOG = {
  items: [
    {
      id: VARIANT_ID,
      sku: "YER-500",
      name: "Yerba 500g",
      productName: "Yerba",
    },
  ],
};

export async function mockContextAndCatalog(page: Page) {
  await page.route("**/api/admin/context", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CONTEXT) });
  });
  await page.route("**/api/pos/catalog*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CATALOG) });
  });
}

export async function mockInventoryReads(page: Page, seen: { levelsUrl?: string }) {
  await page.route("**/api/admin/inventory/levels*", async (route) => {
    seen.levelsUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ levels: [] }) });
  });
  await page.route("**/api/admin/inventory/movements*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ movements: [] }) });
  });
}
