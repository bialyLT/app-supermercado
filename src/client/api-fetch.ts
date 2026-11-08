export type ApiErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "VALIDATION" | "REQUEST_FAILED";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: readonly { path: readonly (string | number)[]; message: string }[];

  constructor(status: number, code: ApiErrorCode, message: string, details?: readonly { path: readonly (string | number)[]; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const messages: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: "Tu sesión venció. Volvé a ingresar para continuar.",
  FORBIDDEN: "No tenés permisos para realizar esta acción.",
  CONFLICT: "La operación entra en conflicto con un cambio existente. Revisá y reintentá.",
  VALIDATION: "Revisá los datos ingresados antes de continuar.",
  REQUEST_FAILED: "No pudimos completar la operación. Intentá nuevamente.",
};

function codeFor(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION";
  return "REQUEST_FAILED";
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiError(0, "REQUEST_FAILED", "No pudimos conectar con el sistema. Intentá nuevamente.");
  }
  if (response.ok) return response;

  const code = codeFor(response.status);
  const body = await response.json().catch(() => null) as { issues?: { path?: (string | number)[]; message?: string }[] } | null;
  const details = body?.issues?.flatMap((issue) => issue.message
    ? [{ path: issue.path ?? [], message: issue.message }]
    : []) ?? undefined;
  if (code === "UNAUTHORIZED" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("supermercado:session-expired"));
  }
  throw new ApiError(response.status, code, messages[code], details);
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "No pudimos conectar con el sistema. Intentá nuevamente.";
}
