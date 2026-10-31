import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  calculateReceiptPreviewTotals,
  createEmptyPurchaseLine,
  updateVariantSearchText,
  validatePurchaseReceiptForm,
  type OperationalBranch,
  type PurchaseFormState,
  type PurchaseLineState,
} from "../components/purchases/types";
import { PurchaseManager } from "../components/purchases/purchase-manager";
import { PurchaseForm } from "../components/purchases/purchase-form";
import { PurchaseHistory } from "../components/purchases/purchase-history";

describe("Purchases UI — Decimal-safe totals and validation (S3, S5)", () => {
  it("clears stale variant identity when search text changes", () => {
    const line = { ...createEmptyPurchaseLine(), variantId: "b0000000-0000-4000-8000-000000000001", sku: "YER-001", variantName: "Yerba" };
    const updated = updateVariantSearchText(line, "Yerbabuena");
    expect(updated.variantId).toBe("");
    expect(updated.sku).toBe("");
    expect(updated.variantName).toBe("Yerbabuena");
  });

  it("normalizes comma decimal input before calculating receipt totals", () => {
    const line = createEmptyPurchaseLine();
    line.variantId = "b0000000-0000-4000-8000-000000000001";
    line.quantity = "1,5";
    line.unitCost = "2,50";

    expect(calculateReceiptPreviewTotals([line], "ARS").total).toBe("3.75");
    expect(validatePurchaseReceiptForm({
      supplierId: "s0000000-0000-4000-8000-000000000001",
      branchId: "b0000000-0000-4000-8000-000000000001",
      locationId: "l0000000-0000-4000-8000-000000000001",
      receiptNumber: "FAC-001",
      currency: "ARS",
      notes: "",
      idempotencyKey: "idem-comma",
      lines: [line],
    }).lineErrors?.[0]?.quantity).toBeUndefined();
  });

  it("calculates multi-line preview totals using Decimal arithmetic without float drift", () => {
    const lines: PurchaseLineState[] = [
      {
        id: "line-1",
        variantId: "b0000000-0000-4000-8000-000000000001",
        variantName: "Yerba Mate 1kg",
        sku: "YER-001",
        quantity: "3",
        unitCost: "19.99",
        taxRate: "0.21", // 21%
        taxAmount: "",
        discountAmount: "5.00",
      },
      {
        id: "line-2",
        variantId: "b0000000-0000-4000-8000-000000000002",
        variantName: "Azúcar 1kg",
        sku: "AZU-001",
        quantity: "10.5",
        unitCost: "2.50",
        taxRate: "0.105", // 10.5%
        taxAmount: "",
        discountAmount: "0",
      },
    ];

    const preview = calculateReceiptPreviewTotals(lines, "ARS");

    expect(preview.subtotal).toBe("86.22");
    expect(preview.discountTotal).toBe("5.00");
    expect(preview.taxTotal).toBe("14.30");
    expect(preview.total).toBe("95.52");

    // Verify no float issues like 0.30000000000000004
    expect(preview.lines[0].subtotal).toBe("59.97");
    expect(preview.lines[0].taxAmount).toBe("11.54");
    expect(preview.lines[0].total).toBe("66.51");
    expect(preview.lines[1].subtotal).toBe("26.25");
    expect(preview.lines[1].taxAmount).toBe("2.76");
    expect(preview.lines[1].total).toBe("29.01");
  });

  it("validates required header fields and line constraints", () => {
    const emptyForm: PurchaseFormState = {
      supplierId: "",
      branchId: "",
      locationId: "",
      receiptNumber: "",
      currency: "ARS",
      notes: "",
      idempotencyKey: "idem-1",
      lines: [],
    };

    const errors = validatePurchaseReceiptForm(emptyForm);
    expect(errors.supplierId).toBeDefined();
    expect(errors.branchId).toBeDefined();
    expect(errors.locationId).toBeDefined();
    expect(errors.lines).toBe("Debe incluir al menos una línea de compra");

    // Negative unit cost or zero quantity validation
    const invalidLineForm: PurchaseFormState = {
      supplierId: "s0000000-0000-4000-8000-000000000001",
      branchId: "b0000000-0000-4000-8000-000000000001",
      locationId: "l0000000-0000-4000-8000-000000000001",
      receiptNumber: "FAC-001",
      currency: "ARS",
      notes: "",
      idempotencyKey: "idem-2",
      lines: [
        {
          id: "line-inv-1",
          variantId: "v0000000-0000-4000-8000-000000000001",
          quantity: "0",
          unitCost: "-10.00",
        },
      ],
    };

    const lineErrors = validatePurchaseReceiptForm(invalidLineForm);
    expect(lineErrors.lineErrors?.[0]?.quantity).toMatch(/mayor a 0/i);
    expect(lineErrors.lineErrors?.[0]?.unitCost).toMatch(/no puede ser negativo/i);
  });

  it("strictly enforces server-derived branch and active-location authority (cannot invent IDs)", () => {
    const dummyBranches: OperationalBranch[] = [
      {
        id: "b0000000-0000-4000-8000-000000000001",
        code: "CEN",
        name: "Central",
        locations: [
          {
            id: "a0000000-0000-4000-8000-000000000001",
            code: "DEP-01",
            name: "Depósito 1",
            type: "STORE",
            branchId: "b0000000-0000-4000-8000-000000000001",
            active: true,
          },
          {
            id: "a0000000-0000-4000-8000-000000000002",
            code: "DEP-INACTIVO",
            name: "Inactivo",
            type: "STORAGE",
            branchId: "b0000000-0000-4000-8000-000000000001",
            active: false,
          },
        ],
      },
    ];

    // Attempting to submit with an invented/foreign branch UUID
    const inventedBranchForm: PurchaseFormState = {
      supplierId: "a0000000-0000-4000-8000-000000000099",
      branchId: "b9999999-9999-4999-8999-999999999999", // not in allowedBranches
      locationId: "a0000000-0000-4000-8000-000000000001",
      receiptNumber: "FAC-001",
      currency: "ARS",
      notes: "",
      idempotencyKey: "idem-auth-1",
      lines: [
        {
          id: "line-1",
          variantId: "a0000000-0000-4000-8000-000000000005",
          quantity: "5",
          unitCost: "10.00",
        },
      ],
    };

    const branchErrors = validatePurchaseReceiptForm(inventedBranchForm, {
      allowedBranches: dummyBranches,
    });
    expect(branchErrors.branchId).toMatch(/no está autorizada o no existe/i);

    // Attempting to submit with an inactive location or location from another branch
    const invalidLocForm: PurchaseFormState = {
      ...inventedBranchForm,
      branchId: "b0000000-0000-4000-8000-000000000001",
      locationId: "a0000000-0000-4000-8000-000000000002", // inactive location
    };

    const locErrors = validatePurchaseReceiptForm(invalidLocForm, {
      allowedBranches: dummyBranches,
    });
    expect(locErrors.locationId).toMatch(/no pertenece a la sucursal o no está activa/i);

    // Valid branch + valid active location succeeds
    const validForm: PurchaseFormState = {
      ...inventedBranchForm,
      branchId: "b0000000-0000-4000-8000-000000000001",
      locationId: "a0000000-0000-4000-8000-000000000001",
    };

    const validErrors = validatePurchaseReceiptForm(validForm, {
      allowedBranches: dummyBranches,
    });
    expect(validErrors.branchId).toBeUndefined();
    expect(validErrors.locationId).toBeUndefined();
  });

  it("creates clean empty line state with unique ID", () => {
    const line1 = createEmptyPurchaseLine();
    const line2 = createEmptyPurchaseLine();
    expect(line1.id).not.toBe(line2.id);
    expect(line1.quantity).toBe("1");
    expect(line1.unitCost).toBe("0.00");
  });
});

describe("Purchases UI — Server-derived selectors & Component rendering (S1, S3, S5)", () => {
  const dummySuppliers = [
    {
      id: "sup-1",
      code: "PROV-001",
      name: "Distribuidora Mayorista SA",
      taxId: "30-11223344-9",
      active: true,
    },
    {
      id: "sup-2",
      code: "PROV-002",
      name: "Lácteos del Sur",
      taxId: "30-55667788-1",
      active: true,
    },
  ];

  const dummyBranches: OperationalBranch[] = [
    {
      id: "branch-central",
      code: "CEN-01",
      name: "Sucursal Central",
      locations: [
        {
          id: "loc-central-store",
          code: "PISO-01",
          name: "Piso de Venta",
          type: "STORE",
          branchId: "branch-central",
          active: true,
        },
        {
          id: "loc-central-storage",
          code: "DEP-01",
          name: "Depósito Principal",
          type: "STORAGE",
          branchId: "branch-central",
          active: true,
        },
        {
          id: "loc-central-inactive",
          code: "VIEJO-01",
          name: "Depósito Inactivo",
          type: "STORAGE",
          branchId: "branch-central",
          active: false,
        },
      ],
    },
    {
      id: "branch-norte",
      code: "NOR-02",
      name: "Sucursal Norte",
      locations: [
        {
          id: "loc-norte-store",
          code: "PISO-NORTE",
          name: "Piso Norte",
          type: "STORE",
          branchId: "branch-norte",
          active: true,
        },
      ],
    },
  ];

  const dummyReceipts = [
    {
      id: "rec-1",
      tenantId: "t-1",
      branchId: "branch-central",
      locationId: "loc-central-storage",
      supplierId: "sup-1",
      receiptNumber: "FAC-A-0001-00001234",
      issuedAt: "2026-03-30T10:00:00.000Z",
      receivedAt: "2026-03-30T10:05:00.000Z",
      currency: "ARS",
      subtotal: "1000.00",
      taxTotal: "210.00",
      discountTotal: "0.00",
      total: "1210.00",
      notes: "Entrega programada",
      idempotencyKey: "idem-abc-1",
      supplier: dummySuppliers[0],
      lines: [
        {
          id: "line-1",
          variantId: "v-1",
          quantity: "10",
          unitCost: "100.00",
          subtotal: "1000.00",
          taxRate: "0.21",
          taxAmount: "210.00",
          discountAmount: "0.00",
          total: "1210.00",
        },
      ],
    },
  ];

  it("renders PurchaseForm with server-derived branch and active-location select elements", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PurchaseForm, {
        suppliers: dummySuppliers,
        branches: dummyBranches,
        branchId: "branch-central",
        locationId: "loc-central-storage",
        onSubmit: vi.fn(),
        isSubmitting: false,
      })
    );

    // Must have <select id="purchase-branch"> and <select id="purchase-location">
    expect(markup).toContain('<select id="purchase-branch"');
    expect(markup).toContain('<select id="purchase-location"');

    // Must NOT have manual UUID input text fields
    expect(markup).not.toContain('id="purchase-branch" type="text"');
    expect(markup).not.toContain('id="purchase-location" type="text"');

    // Branch select options must contain server-derived names and codes
    expect(markup).toContain("Sucursal Central (CEN-01)");
    expect(markup).toContain("Sucursal Norte (NOR-02)");

    // Active locations of selected branch must appear
    expect(markup).toContain("Piso de Venta (PISO-01) [STORE]");
    expect(markup).toContain("Depósito Principal (DEP-01) [STORAGE]");

    // Inactive location must NOT be in the options
    expect(markup).not.toContain("Depósito Inactivo (VIEJO-01)");

    // Suppliers selector
    expect(markup).toContain("Distribuidora Mayorista SA");
    expect(markup).toContain("Lácteos del Sur");
  });

  it("renders warning and disables submit when no branches are assigned in context", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PurchaseForm, {
        suppliers: dummySuppliers,
        branches: [], // empty context
        branchId: "",
        locationId: "",
        onSubmit: vi.fn(),
        isSubmitting: false,
        contextLoading: false,
      })
    );

    expect(markup).toContain("Sin sucursales asignadas");
    expect(markup).toContain("Su usuario no tiene sucursales asignadas");
    expect(markup).toMatch(/<option[^>]*>Sin sucursales asignadas<\/option>/);
  });

  it("renders PurchaseManager with operational context, navigation, and shortcuts", () => {
    const dummyContext = {
      tenantId: "t-1",
      branches: dummyBranches,
      locations: dummyBranches.flatMap((b) => b.locations),
    };

    const markup = renderToStaticMarkup(
      React.createElement(PurchaseManager, {
        initialSuppliers: dummySuppliers,
        initialReceipts: dummyReceipts,
        initialContext: dummyContext,
        defaultBranchId: "branch-central",
        defaultLocationId: "loc-central-storage",
      })
    );

    expect(markup).toContain("Gestión de Compras y Recepción");
    expect(markup).toContain("Registrar Comprobante");
    expect(markup).toContain("Historial de Compras");
    expect(markup).toContain("Sucursal Central (CEN-01)");
    expect(markup).toContain("Depósito Principal (DEP-01)");
    expect(markup).toContain("Alt+N");
    expect(markup).toContain("Alt+G");
  });

  it("renders PurchaseHistory with receipt list and Decimal totals", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PurchaseHistory, {
        receipts: dummyReceipts,
      })
    );

    expect(markup).toContain("FAC-A-0001-00001234");
    expect(markup).toContain("Distribuidora Mayorista SA");
    expect(markup).toContain("1210.00");
    expect(markup).toContain("ARS");
    expect(markup).toContain("Ver detalle");
  });

  it("renders empty history state when no receipts are present", () => {
    const markup = renderToStaticMarkup(
      React.createElement(PurchaseHistory, {
        receipts: [],
      })
    );

    expect(markup).toContain("No hay comprobantes de compra registrados");
  });
});
