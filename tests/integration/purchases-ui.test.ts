import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { directPurchaseReceiptInputSchema, calculatePurchaseTotals } from "../../src/domain/purchases";
import {
  calculateReceiptPreviewTotals,
  type OperationalBranch,
  type OperationalContext,
  type PurchaseLineState,
} from "../../components/purchases/types";
import { PurchaseManager } from "../../components/purchases/purchase-manager";
import { PurchaseForm } from "../../components/purchases/purchase-form";
import PurchasesPage from "../../app/admin/purchases/page";
import PurchasesLoading from "../../app/admin/purchases/loading";

describe("Purchases UI Integration — Backend schema compatibility & SSR", () => {
  it("renders PurchasesPage Server Component gracefully when unauthenticated or in test context", async () => {
    const pageElement = await PurchasesPage();
    expect(React.isValidElement(pageElement)).toBe(true);
    const html = renderToStaticMarkup(pageElement);
    expect(html).toContain("Gestión de Compras y Recepción");
    expect(html).toContain("Registrar Comprobante");
    expect(html).toContain("Historial de Compras");
  });

  it("renders PurchasesLoading skeleton with accessible status", () => {
    const loadingElement = React.createElement(PurchasesLoading);
    const html = renderToStaticMarkup(loadingElement);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Cargando interfaz de compras y recepción");
  });

  it("guarantees preview totals match server domain calculatePurchaseTotals exact decimal results", () => {
    const lines: PurchaseLineState[] = [
      {
        id: "l1",
        variantId: "a0000000-0000-4000-8000-000000000001",
        quantity: "12.5",
        unitCost: "340.50",
        taxRate: "0.21",
        discountAmount: "50.00",
      },
      {
        id: "l2",
        variantId: "a0000000-0000-4000-8000-000000000002",
        quantity: "4",
        unitCost: "1200.00",
        taxRate: "0.105",
        discountAmount: "0.00",
      },
    ];

    const uiPreview = calculateReceiptPreviewTotals(lines, "ARS");

    const serverTotals = calculatePurchaseTotals({
      currency: "ARS",
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        taxRate: l.taxRate,
        discountAmount: l.discountAmount,
      })),
    });

    // The client UI preview and server domain calculatePurchaseTotals must be 100% identical in Decimal strings
    expect(uiPreview.subtotal).toBe(serverTotals.subtotal);
    expect(uiPreview.discountTotal).toBe(serverTotals.discountTotal);
    expect(uiPreview.taxTotal).toBe(serverTotals.taxTotal);
    expect(uiPreview.total).toBe(serverTotals.total);
    expect(uiPreview.lines[0].subtotal).toBe(serverTotals.lines[0].subtotal);
    expect(uiPreview.lines[0].taxAmount).toBe(serverTotals.lines[0].taxAmount);
    expect(uiPreview.lines[0].total).toBe(serverTotals.lines[0].total);
  });

  it("produces valid directPurchaseReceiptInputSchema payloads from client form shape", () => {
    const clientPayload = {
      supplierId: "a0000000-0000-4000-8000-000000000010",
      branchId: "a0000000-0000-4000-8000-000000000020",
      locationId: "a0000000-0000-4000-8000-000000000030",
      receiptNumber: "FAC-A-0001-9999",
      issuedAt: "2026-03-30T12:00:00.000Z",
      currency: "ARS",
      subtotal: "4256.25",
      taxTotal: "893.81",
      discountTotal: "50.00",
      total: "5100.06",
      idempotencyKey: "test-client-idem-key-999",
      notes: "Carga de prueba",
      lines: [
        {
          variantId: "a0000000-0000-4000-8000-000000000001",
          quantity: "12.5",
          unitCost: "340.50",
          taxRate: "0.21",
          discountAmount: "50.00",
        },
      ],
    };

    const parseResult = directPurchaseReceiptInputSchema.safeParse(clientPayload);
    expect(parseResult.success).toBe(true);
  });

  it("integrates server-derived OperationalContext into branch and active-location selectors", () => {
    const operationalContext: OperationalContext = {
      tenantId: "t0000000-0000-4000-8000-000000000001",
      branches: [
        {
          id: "b0000000-0000-4000-8000-000000000001",
          code: "SUC-01",
          name: "Sucursal Belgrano",
          locations: [
            {
              id: "l0000000-0000-4000-8000-000000000001",
              code: "DEP-B1",
              name: "Depósito Belgrano",
              type: "STORE",
              branchId: "b0000000-0000-4000-8000-000000000001",
              active: true,
            },
          ],
        },
      ],
      locations: [
        {
          id: "l0000000-0000-4000-8000-000000000001",
          code: "DEP-B1",
          name: "Depósito Belgrano",
          type: "STORE",
          branchId: "b0000000-0000-4000-8000-000000000001",
          active: true,
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(PurchaseManager, {
        initialContext: operationalContext,
        initialSuppliers: [
          {
            id: "s0000000-0000-4000-8000-000000000001",
            code: "PROV-1",
            name: "Proveedor Central",
            active: true,
          },
        ],
      })
    );

    // Context options populated
    expect(html).toContain("Sucursal Belgrano (SUC-01)");
    expect(html).toContain("Depósito Belgrano (DEP-B1) [STORE]");
    // Does not expose manual text inputs
    expect(html).not.toContain('placeholder="UUID de la sucursal receptora"');
    expect(html).not.toContain('placeholder="UUID del depósito o piso de venta"');
  });

  it("handles branch with no active locations safely in the location selector", () => {
    const branchesWithoutActiveLocs: OperationalBranch[] = [
      {
        id: "b0000000-0000-4000-8000-000000000002",
        code: "SUC-EMPTY",
        name: "Sucursal Sin Depósitos",
        locations: [
          {
            id: "l0000000-0000-4000-8000-000000000009",
            code: "INACTIVO",
            name: "Depósito Clausurado",
            type: "STORAGE",
            branchId: "b0000000-0000-4000-8000-000000000002",
            active: false,
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(PurchaseForm, {
        suppliers: [],
        branches: branchesWithoutActiveLocs,
        branchId: "b0000000-0000-4000-8000-000000000002",
        onSubmit: async () => false,
      })
    );

    expect(html).toContain("Sin ubicaciones activas en esta sucursal");
    expect(html).not.toContain("Depósito Clausurado");
  });
});
