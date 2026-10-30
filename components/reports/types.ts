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
  locations?: OperationalLocation[];
};

export type OperationalContext = {
  tenantId: string;
  branches: OperationalBranch[];
  locations?: OperationalLocation[];
};

export type DatePreset = "today" | "last7days" | "thisMonth" | "custom";

export type ReportFilterState = {
  preset: DatePreset;
  from: string;
  to: string;
  branchId: string;
  actorUserId: string;
  variantId: string;
  categoryId: string;
};

export type BranchReport = {
  branchId: string;
  salesCount: number;
  salesTotal: string;
  purchaseCount: number;
  purchaseTotal: string;
  transferOutQuantity: string;
  transferInQuantity: string;
  stockQuantity: string;
};

export type OperationsReportData = {
  period: { from: string; to: string };
  filters: {
    from: string;
    to: string;
    branchId?: string;
    actorUserId?: string;
    variantId?: string;
    categoryId?: string;
  };
  currency: string | null;
  sales: { count: number; total: string; quantity: string };
  purchases: {
    count: number;
    total: string;
    taxTotal: string;
    discountTotal: string;
    quantity: string;
  };
  transfers: { count: number; outQuantity: string; inQuantity: string };
  stock: { lineCount: number; quantity: string };
  branches: BranchReport[];
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function getPresetDateRange(
  preset: DatePreset,
  now: Date = new Date()
): { from: string; to: string } {
  const current = new Date(now);

  switch (preset) {
    case "today": {
      const from = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth(),
          current.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
      const to = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth(),
          current.getUTCDate() + 1,
          0,
          0,
          0,
          0
        )
      );
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "last7days": {
      const to = new Date(current.getTime());
      const from = new Date(current.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "thisMonth": {
      const from = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 0, 0, 0, 0)
      );
      const to = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth() + 1,
          1,
          0,
          0,
          0,
          0
        )
      );
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case "custom":
    default: {
      const from = new Date(
        Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 0, 0, 0, 0)
      );
      const to = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth() + 1,
          1,
          0,
          0,
          0,
          0
        )
      );
      return { from: from.toISOString(), to: to.toISOString() };
    }
  }
}

export function toIsoStringSafe(val: string): string | null {
  if (!val) return null;
  const parsed = Date.parse(val);
  if (isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function validateReportFilters(
  filters: ReportFilterState,
  allowedBranches?: OperationalBranch[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!filters.from) {
    errors.from = "Debe indicar la fecha de inicio";
  } else if (!toIsoStringSafe(filters.from)) {
    errors.from = "Fecha de inicio inválida";
  }

  if (!filters.to) {
    errors.to = "Debe indicar la fecha de fin";
  } else if (!toIsoStringSafe(filters.to)) {
    errors.to = "Fecha de fin inválida";
  }

  if (filters.from && filters.to) {
    const fromTime = Date.parse(filters.from);
    const toTime = Date.parse(filters.to);
    if (!isNaN(fromTime) && !isNaN(toTime) && toTime <= fromTime) {
      errors.to = "La fecha 'Hasta' debe ser posterior a la fecha 'Desde'";
    }
  }

  if (filters.branchId && filters.branchId.trim() !== "") {
    const branchId = filters.branchId.trim();
    if (!isValidUuid(branchId)) {
      errors.branchId = "Identificador de sucursal inválido";
    } else if (allowedBranches && allowedBranches.length > 0) {
      const exists = allowedBranches.some((b) => b.id === branchId);
      if (!exists) {
        errors.branchId = "Sucursal no autorizada o no encontrada";
      }
    }
  }

  if (filters.actorUserId && filters.actorUserId.trim() !== "") {
    if (!isValidUuid(filters.actorUserId.trim())) {
      errors.actorUserId = "Identificador de usuario/operador inválido";
    }
  }

  if (filters.variantId && filters.variantId.trim() !== "") {
    if (!isValidUuid(filters.variantId.trim())) {
      errors.variantId = "Identificador de variante inválido";
    }
  }

  if (filters.categoryId && filters.categoryId.trim() !== "") {
    if (!isValidUuid(filters.categoryId.trim())) {
      errors.categoryId = "Identificador de categoría inválido";
    }
  }

  return errors;
}

export function buildReportQueryString(
  filters: ReportFilterState,
  format: "json" | "csv" = "json"
): string {
  const params = new URLSearchParams();

  const isoFrom = toIsoStringSafe(filters.from);
  const isoTo = toIsoStringSafe(filters.to);

  if (isoFrom) params.set("from", isoFrom);
  if (isoTo) params.set("to", isoTo);
  params.set("format", format);

  if (filters.branchId && filters.branchId.trim() !== "") {
    params.set("branchId", filters.branchId.trim());
  }
  if (filters.actorUserId && filters.actorUserId.trim() !== "") {
    params.set("actorUserId", filters.actorUserId.trim());
  }
  if (filters.variantId && filters.variantId.trim() !== "") {
    params.set("variantId", filters.variantId.trim());
  }
  if (filters.categoryId && filters.categoryId.trim() !== "") {
    params.set("categoryId", filters.categoryId.trim());
  }

  return params.toString();
}

export function buildCsvExportUrl(filters: ReportFilterState): string {
  const qs = buildReportQueryString(filters, "csv");
  return `/api/admin/reports/operations?${qs}`;
}

export function resolveBranchName(
  branchId: string,
  branches?: OperationalBranch[]
): string {
  if (!branches || branches.length === 0) return branchId;
  const found = branches.find((b) => b.id === branchId);
  return found ? `${found.name} (${found.code})` : branchId;
}

export function formatCurrencyAmount(
  amount: string | number | null | undefined,
  currency?: string | null
): string {
  if (amount == null) return "0.00";
  const numStr = String(amount);
  return currency ? `${numStr} ${currency}` : numStr;
}

export function mapReportErrorMessage(
  status: number,
  errorCode?: string
): string {
  if (errorCode === "INVALID_PERIOD" || status === 400) {
    if (errorCode === "INVALID_PERIOD") {
      return "El período seleccionado es inválido. La fecha 'Hasta' debe ser posterior a 'Desde'.";
    }
    if (errorCode === "INVALID_INPUT") {
      return "Los parámetros de consulta son inválidos. Revise los filtros ingresados.";
    }
  }
  if (errorCode === "FORBIDDEN" || status === 403) {
    return "No tiene permisos suficientes para consultar reportes de la sucursal seleccionada.";
  }
  if (errorCode === "UNAUTHENTICATED" || status === 401) {
    return "Su sesión ha expirado o no está autenticado. Inicie sesión nuevamente.";
  }
  return "Ocurrió un error al cargar el reporte operativo. Verifique su conexión e intente nuevamente.";
}
