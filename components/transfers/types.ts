import Decimal from "decimal.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(val: string): boolean {
  return UUID_REGEX.test(val.trim());
}

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

export type TransferLineState = {
  id: string; // client React key
  variantId: string;
  variantName?: string;
  sku?: string;
  lotId?: string;
  quantity: string;
};

export type TransferFormState = {
  originBranchId: string;
  destinationBranchId: string;
  originLocationId: string;
  destinationLocationId: string;
  reason: string;
  idempotencyKey: string;
  lines: TransferLineState[];
};

export type TransferSummaryLine = {
  id?: string;
  variantId: string;
  variantName?: string;
  sku?: string;
  lotId?: string | null;
  quantity: string;
};

export type TransferSummary = {
  id: string;
  originBranchId: string;
  destinationBranchId: string;
  originLocationId: string;
  destinationLocationId: string;
  originBranchName?: string;
  destinationBranchName?: string;
  originLocationName?: string;
  destinationLocationName?: string;
  reason?: string | null;
  status: string;
  createdAt: string;
  idempotencyKey: string;
  lines: TransferSummaryLine[];
};

export type LineValidationError = {
  variantId?: string;
  lotId?: string;
  quantity?: string;
};

export type FormValidationErrors = {
  originBranchId?: string;
  destinationBranchId?: string;
  originLocationId?: string;
  destinationLocationId?: string;
  lines?: string;
  reason?: string;
  idempotencyKey?: string;
  lineErrors?: Record<number, LineValidationError>;
};

export function normalizeDecimalInput(value: string): string {
  return value.trim().replace(/,/g, ".");
}

export function updateVariantSearchText(line: TransferLineState, value: string): TransferLineState {
  if (value === line.variantName) return { ...line, variantName: value };
  return { ...line, variantName: value, variantId: "", sku: "" };
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `transf-${crypto.randomUUID()}`;
  }
  return `transf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function calculateTransferQuantity(quantity: string, multiplier: string): string {
  return new Decimal(quantity).times(new Decimal(multiplier)).toFixed(2);
}

export function createEmptyTransferLine(): TransferLineState {
  const lineKey =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return {
    id: `tl-${lineKey}`,
    variantId: "",
    variantName: "",
    sku: "",
    lotId: "",
    quantity: "1",
  };
}

export function createInitialTransferFormState(defaults?: {
  originBranchId?: string;
  originLocationId?: string;
  destinationBranchId?: string;
  destinationLocationId?: string;
}): TransferFormState {
  return {
    originBranchId: defaults?.originBranchId ?? "",
    destinationBranchId: defaults?.destinationBranchId ?? "",
    originLocationId: defaults?.originLocationId ?? "",
    destinationLocationId: defaults?.destinationLocationId ?? "",
    reason: "",
    idempotencyKey: generateIdempotencyKey(),
    lines: [createEmptyTransferLine()],
  };
}

export function validateTransferForm(
  form: TransferFormState,
  context?: OperationalContext | null
): FormValidationErrors {
  const errors: FormValidationErrors = {};

  // 1. Origin Branch validation
  if (!form.originBranchId.trim()) {
    errors.originBranchId = "Debe seleccionar una sucursal de origen";
  } else if (!isValidUuid(form.originBranchId)) {
    errors.originBranchId = "Sucursal de origen no válida";
  } else if (context && context.branches.length > 0) {
    const found = context.branches.find((b) => b.id === form.originBranchId);
    if (!found) {
      errors.originBranchId = "Sucursal de origen no autorizada o no encontrada";
    }
  }

  // 2. Destination Branch validation
  if (!form.destinationBranchId.trim()) {
    errors.destinationBranchId = "Debe seleccionar una sucursal de destino";
  } else if (!isValidUuid(form.destinationBranchId)) {
    errors.destinationBranchId = "Sucursal de destino no válida";
  } else if (context && context.branches.length > 0) {
    const found = context.branches.find((b) => b.id === form.destinationBranchId);
    if (!found) {
      errors.destinationBranchId = "Sucursal de destino no autorizada o no encontrada";
    }
  }

  // Same branch constraint
  if (
    form.originBranchId.trim() &&
    form.destinationBranchId.trim() &&
    form.originBranchId.trim() === form.destinationBranchId.trim()
  ) {
    errors.destinationBranchId = "La sucursal de destino debe ser distinta a la de origen";
  }

  // 3. Origin Location validation
  if (!form.originLocationId.trim()) {
    errors.originLocationId = "Debe seleccionar una ubicación de origen";
  } else if (!isValidUuid(form.originLocationId)) {
    errors.originLocationId = "Ubicación de origen no válida";
  } else if (context && form.originBranchId) {
    const originBranch = context.branches.find((b) => b.id === form.originBranchId);
    if (originBranch) {
      const loc = originBranch.locations.find((l) => l.id === form.originLocationId);
      if (!loc) {
        errors.originLocationId = "La ubicación no pertenece a la sucursal de origen seleccionada";
      } else if (!loc.active) {
        errors.originLocationId = "La ubicación de origen está inactiva";
      }
    }
  }

  // 4. Destination Location validation
  if (!form.destinationLocationId.trim()) {
    errors.destinationLocationId = "Debe seleccionar una ubicación de destino";
  } else if (!isValidUuid(form.destinationLocationId)) {
    errors.destinationLocationId = "Ubicación de destino no válida";
  } else if (context && form.destinationBranchId) {
    const destBranch = context.branches.find((b) => b.id === form.destinationBranchId);
    if (destBranch) {
      const loc = destBranch.locations.find((l) => l.id === form.destinationLocationId);
      if (!loc) {
        errors.destinationLocationId = "La ubicación no pertenece a la sucursal de destino seleccionada";
      } else if (!loc.active) {
        errors.destinationLocationId = "La ubicación de destino está inactiva";
      }
    }
  }

  // 5. Lines validation
  if (!form.lines || form.lines.length === 0) {
    errors.lines = "Debe incluir al menos una línea de transferencia";
  } else if (form.lines.length > 100) {
    errors.lines = "No se pueden incluir más de 100 líneas por transferencia";
  } else {
    const lineErrors: Record<number, LineValidationError> = {};
    let hasLineErrors = false;

    // Check duplicate lines: (variantId:lotId)
    const seenKeys = new Set<string>();
    let hasDuplicates = false;

    form.lines.forEach((line, index) => {
      const lErr: LineValidationError = {};

      if (!line.variantId.trim()) {
        lErr.variantId = "Debe seleccionar un producto o variante";
      } else if (!isValidUuid(line.variantId)) {
        lErr.variantId = "ID de variante no válido";
      }

      if (line.lotId && line.lotId.trim()) {
        if (!isValidUuid(line.lotId.trim())) {
          lErr.lotId = "ID de lote no válido (debe ser UUID)";
        }
      }

      if (!line.quantity.trim()) {
        lErr.quantity = "Ingrese una cantidad";
      } else {
        try {
          const dec = new Decimal(normalizeDecimalInput(line.quantity));
          if (!dec.isFinite() || dec.lte(0)) {
            lErr.quantity = "La cantidad debe ser mayor a 0";
          }
        } catch {
          lErr.quantity = "Cantidad no válida";
        }
      }

      if (Object.keys(lErr).length > 0) {
        lineErrors[index] = lErr;
        hasLineErrors = true;
      }

      const compositeKey = `${line.variantId.trim().toLowerCase()}:${(line.lotId || "").trim().toLowerCase()}`;
      if (line.variantId.trim()) {
        if (seenKeys.has(compositeKey)) {
          hasDuplicates = true;
        }
        seenKeys.add(compositeKey);
      }
    });

    if (hasLineErrors) {
      errors.lineErrors = lineErrors;
    }

    if (hasDuplicates) {
      errors.lines = "No se pueden incluir líneas duplicadas para la misma variante y lote";
    }
  }

  // 6. Reason validation
  if (form.reason && form.reason.length > 500) {
    errors.reason = "El motivo no puede superar los 500 caracteres";
  }

  // 7. Idempotency key
  if (!form.idempotencyKey.trim()) {
    errors.idempotencyKey = "Clave de idempotencia requerida";
  } else if (form.idempotencyKey.trim().length > 128) {
    errors.idempotencyKey = "La clave de idempotencia no puede superar los 128 caracteres";
  }

  return errors;
}

export function formatTransferPayload(form: TransferFormState) {
  return {
    originBranchId: form.originBranchId.trim(),
    destinationBranchId: form.destinationBranchId.trim(),
    originLocationId: form.originLocationId.trim(),
    destinationLocationId: form.destinationLocationId.trim(),
    reason: form.reason.trim() || undefined,
    idempotencyKey: form.idempotencyKey.trim(),
    lines: form.lines.map((l) => ({
      variantId: l.variantId.trim(),
      lotId: l.lotId?.trim() ? l.lotId.trim() : undefined,
      quantity: l.quantity.trim(),
    })),
  };
}

export function mapTransferErrorMessage(status: number, codeOrDetail?: string): string {
  if (status === 409) {
    if (codeOrDetail === "INSUFFICIENT_STOCK") {
      return "Stock insuficiente en la ubicación de origen para uno o más artículos seleccionados.";
    }
    if (codeOrDetail === "IDEMPOTENCY_CONFLICT") {
      return "Conflicto de idempotencia: esta transferencia ya fue enviada previamente con parámetros distintos.";
    }
    return "Conflicto en la operación de transferencia (stock o concurrencia).";
  }
  if (status === 403) {
    return "Permisos insuficientes: el usuario no tiene permisos de transferencia para las sucursales seleccionadas.";
  }
  if (status === 404) {
    return "Recurso no encontrado: verifique que las sucursales, ubicaciones y variantes existan y estén activas.";
  }
  if (status === 401) {
    return "Sesión no autenticada. Inicie sesión nuevamente.";
  }
  if (codeOrDetail === "INVALID_QUANTITY_PRECISION") {
    return "La cantidad excede la precisión decimal permitida para la variante seleccionada.";
  }
  if (codeOrDetail === "TRANSFER_BRANCHES_MUST_DIFFER") {
    return "Las sucursales de origen y destino deben ser distintas.";
  }
  if (codeOrDetail === "DUPLICATE_TRANSFER_LINE") {
    return "Existen líneas duplicadas para la misma variante y lote.";
  }
  return codeOrDetail || "Error inesperado al procesar la transferencia.";
}
