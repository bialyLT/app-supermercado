import Decimal from "decimal.js";
import { currencyPrecision } from "../../src/domain/cash";

export type Supplier = {
  id: string;
  code: string;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  active: boolean;
};

export type OperationalLocation = {
  id: string;
  code: string;
  name: string;
  type: string;
  branchId: string;
  active: boolean;
};

export type OperationalBranch = {
  id: string;
  code: string;
  name: string;
  locations: OperationalLocation[];
};

export type OperationalContext = {
  tenantId: string;
  branches: OperationalBranch[];
  locations: OperationalLocation[];
};

export type PurchaseLineState = {
  id: string; // client key
  variantId: string;
  variantName?: string;
  sku?: string;
  lotId?: string;
  lotNumber?: string;
  expiresAt?: string;
  quantity: string;
  unitCost: string;
  taxRate?: string;
  taxAmount?: string;
  discountAmount?: string;
};

export type PurchaseFormState = {
  supplierId: string;
  branchId: string;
  locationId: string;
  receiptNumber: string;
  issuedAt?: string;
  currency: string;
  notes: string;
  idempotencyKey: string;
  lines: PurchaseLineState[];
};

export type CalculatedLinePreview = {
  id: string;
  variantId: string;
  quantity: string;
  unitCost: string;
  taxRate?: string;
  taxAmount: string;
  discountAmount: string;
  subtotal: string;
  total: string;
};

export type CalculatedReceiptPreview = {
  currency: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  lines: CalculatedLinePreview[];
};

export type ReceiptLineSummary = {
  id: string;
  variantId: string;
  lotId?: string | null;
  quantity: string | Decimal;
  unitCost: string | Decimal;
  subtotal: string | Decimal;
  taxRate?: string | Decimal | null;
  taxAmount: string | Decimal;
  discountAmount: string | Decimal;
  total: string | Decimal;
};

export type PurchaseReceiptSummary = {
  id: string;
  tenantId: string;
  branchId: string;
  locationId: string;
  supplierId: string;
  receiptNumber?: string | null;
  issuedAt: string | Date;
  receivedAt: string | Date;
  currency: string;
  subtotal: string | Decimal;
  taxTotal: string | Decimal;
  discountTotal: string | Decimal;
  total: string | Decimal;
  notes?: string | null;
  idempotencyKey: string;
  supplier?: Supplier;
  lines?: ReceiptLineSummary[];
};

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createEmptyPurchaseLine(): PurchaseLineState {
  return {
    id: generateIdempotencyKey(),
    variantId: "",
    variantName: "",
    sku: "",
    lotNumber: "",
    expiresAt: "",
    quantity: "1",
    unitCost: "0.00",
    taxRate: "",
    taxAmount: "",
    discountAmount: "0.00",
  };
}

export function createInitialPurchaseFormState(defaults?: {
  branchId?: string;
  locationId?: string;
  currency?: string;
}): PurchaseFormState {
  return {
    supplierId: "",
    branchId: defaults?.branchId ?? "",
    locationId: defaults?.locationId ?? "",
    receiptNumber: "",
    issuedAt: new Date().toISOString().slice(0, 10),
    currency: defaults?.currency ?? "ARS",
    notes: "",
    idempotencyKey: generateIdempotencyKey(),
    lines: [createEmptyPurchaseLine()],
  };
}

export function calculateReceiptPreviewTotals(
  lines: PurchaseLineState[],
  currency = "ARS"
): CalculatedReceiptPreview {
  let decimals = 2;
  try {
    decimals = currencyPrecision(currency);
  } catch {
    decimals = 2;
  }

  let computedSubtotal = new Decimal(0);
  let computedDiscountTotal = new Decimal(0);
  let computedTaxTotal = new Decimal(0);

  const calculatedLines: CalculatedLinePreview[] = lines.map((line) => {
    let qty = new Decimal(0);
    try {
      if (line.quantity && !Number.isNaN(Number(line.quantity))) {
        qty = new Decimal(line.quantity);
      }
    } catch {
      qty = new Decimal(0);
    }

    let cost = new Decimal(0);
    try {
      if (line.unitCost && !Number.isNaN(Number(line.unitCost))) {
        cost = new Decimal(line.unitCost);
      }
    } catch {
      cost = new Decimal(0);
    }

    const lineSubtotal = qty.times(cost).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);

    let lineDiscount = new Decimal(0);
    try {
      if (line.discountAmount && !Number.isNaN(Number(line.discountAmount))) {
        lineDiscount = new Decimal(line.discountAmount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
      }
    } catch {
      lineDiscount = new Decimal(0);
    }

    if (lineDiscount.isNegative() || lineDiscount.gt(lineSubtotal)) {
      lineDiscount = new Decimal(0);
    }

    const taxableAmount = lineSubtotal.minus(lineDiscount);

    let lineTax = new Decimal(0);
    if (line.taxAmount && !Number.isNaN(Number(line.taxAmount))) {
      try {
        lineTax = new Decimal(line.taxAmount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
      } catch {
        lineTax = new Decimal(0);
      }
    } else if (line.taxRate && !Number.isNaN(Number(line.taxRate))) {
      try {
        const rate = new Decimal(line.taxRate);
        lineTax = taxableAmount.times(rate).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
      } catch {
        lineTax = new Decimal(0);
      }
    }

    const lineTotal = taxableAmount.plus(lineTax);

    computedSubtotal = computedSubtotal.plus(lineSubtotal);
    computedDiscountTotal = computedDiscountTotal.plus(lineDiscount);
    computedTaxTotal = computedTaxTotal.plus(lineTax);

    return {
      id: line.id,
      variantId: line.variantId,
      quantity: line.quantity,
      unitCost: cost.toFixed(decimals),
      taxRate: line.taxRate,
      taxAmount: lineTax.toFixed(decimals),
      discountAmount: lineDiscount.toFixed(decimals),
      subtotal: lineSubtotal.toFixed(decimals),
      total: lineTotal.toFixed(decimals),
    };
  });

  const computedTotal = computedSubtotal.minus(computedDiscountTotal).plus(computedTaxTotal);

  return {
    currency,
    subtotal: computedSubtotal.toFixed(decimals),
    discountTotal: computedDiscountTotal.toFixed(decimals),
    taxTotal: computedTaxTotal.toFixed(decimals),
    total: computedTotal.toFixed(decimals),
    lines: calculatedLines,
  };
}

export type FormValidationErrors = {
  supplierId?: string;
  branchId?: string;
  locationId?: string;
  lines?: string;
  lineErrors?: Record<number, { variantId?: string; quantity?: string; unitCost?: string }>;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validatePurchaseReceiptForm(
  form: PurchaseFormState,
  options?: {
    allowedBranches?: readonly OperationalBranch[];
  }
): FormValidationErrors {
  const errors: FormValidationErrors = {};

  if (!form.supplierId || form.supplierId.trim() === "") {
    errors.supplierId = "Debe seleccionar un proveedor";
  } else if (!UUID_REGEX.test(form.supplierId.trim())) {
    errors.supplierId = "El ID de proveedor debe ser un UUID válido";
  }

  if (!form.branchId || form.branchId.trim() === "") {
    errors.branchId = "Debe seleccionar una sucursal";
  } else if (!UUID_REGEX.test(form.branchId.trim())) {
    errors.branchId = "El ID de sucursal debe ser un UUID válido";
  } else if (options?.allowedBranches && options.allowedBranches.length > 0) {
    const branchMatch = options.allowedBranches.find((b) => b.id === form.branchId);
    if (!branchMatch) {
      errors.branchId = "La sucursal seleccionada no está autorizada o no existe";
    }
  }

  if (!form.locationId || form.locationId.trim() === "") {
    errors.locationId = "Debe seleccionar una ubicación de stock";
  } else if (!UUID_REGEX.test(form.locationId.trim())) {
    errors.locationId = "El ID de ubicación debe ser un UUID válido";
  } else if (options?.allowedBranches && form.branchId) {
    const branchMatch = options.allowedBranches.find((b) => b.id === form.branchId);
    if (branchMatch) {
      const locMatch = branchMatch.locations.find((l) => l.id === form.locationId && l.active);
      if (!locMatch) {
        errors.locationId = "La ubicación seleccionada no pertenece a la sucursal o no está activa";
      }
    }
  }

  if (!form.lines || form.lines.length === 0) {
    errors.lines = "Debe incluir al menos una línea de compra";
  } else {
    const lineErrors: Record<number, { variantId?: string; quantity?: string; unitCost?: string }> = {};
    let hasLineError = false;

    form.lines.forEach((line, index) => {
      const err: { variantId?: string; quantity?: string; unitCost?: string } = {};

      if (!line.variantId || line.variantId.trim() === "") {
        err.variantId = "Debe seleccionar una variante de producto";
      } else if (!UUID_REGEX.test(line.variantId.trim())) {
        err.variantId = "ID de variante inválido";
      }

      try {
        const qty = new Decimal(line.quantity);
        if (qty.lte(0)) {
          err.quantity = "La cantidad debe ser mayor a 0";
        }
      } catch {
        err.quantity = "Cantidad numérica inválida";
      }

      try {
        const cost = new Decimal(line.unitCost);
        if (cost.isNegative()) {
          err.unitCost = "El costo unitario no puede ser negativo";
        }
      } catch {
        err.unitCost = "Costo numérico inválido";
      }

      if (Object.keys(err).length > 0) {
        lineErrors[index] = err;
        hasLineError = true;
      }
    });

    if (hasLineError) {
      errors.lineErrors = lineErrors;
    }
  }

  return errors;
}
