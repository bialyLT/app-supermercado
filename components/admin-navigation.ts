import type { RoleName } from "../src/domain/contracts";

export type NavGroupId = "operacion" | "administracion";

export type NavIconName =
  | "home"
  | "inventory"
  | "alerts"
  | "sales"
  | "purchases"
  | "suppliers"
  | "transfers"
  | "reports"
  | "promotions"
  | "users"
  | "settings"
  | "weighed"
  | "shifts"
  | "pos"
  | "logout";

export type NavGroup = {
  readonly id: NavGroupId;
  readonly title: string;
};

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "operacion", title: "Operación" },
  { id: "administracion", title: "Administración" },
];

export type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly group: NavGroupId;
  readonly roles: readonly RoleName[];
  readonly icon: NavIconName;
  readonly description?: string;
  readonly badge?: string;
  readonly shortcut?: string;
};

export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Inicio",
    href: "/admin",
    group: "operacion",
    roles: ["ADMIN", "STOCK_MANAGER", "SUPERVISOR"],
    icon: "home",
    description: "Tablero operativo general",
    shortcut: "Alt+H",
  },
  {
    label: "Compras",
    href: "/admin/purchases",
    group: "operacion",
    roles: ["ADMIN", "STOCK_MANAGER"],
    icon: "purchases",
    description: "Recepción y comprobantes de compra",
    shortcut: "Alt+C",
  },
  {
    label: "Proveedores",
    href: "/admin/suppliers",
    group: "operacion",
    roles: ["ADMIN", "STOCK_MANAGER"],
    icon: "suppliers",
    description: "Gestión y catálogo de proveedores comerciales",
    shortcut: "Alt+V",
  },
  {
    label: "Transferencias",
    href: "/admin/transfers",
    group: "operacion",
    roles: ["ADMIN", "STOCK_MANAGER"],
    icon: "transfers",
    description: "Movimientos entre sucursales y depósitos",
    shortcut: "Alt+T",
  },
  {
    label: "Inventario",
    href: "/admin/inventory",
    group: "operacion",
    roles: ["ADMIN", "STOCK_MANAGER"],
    icon: "inventory",
    description: "Existencias y movimientos del ledger",
    shortcut: "Alt+I",
  },
  { label: "Recepciones", href: "/admin/inventory/receipts", group: "operacion", roles: ["ADMIN", "STOCK_MANAGER"], icon: "purchases", description: "Alta e historial de recepciones" },
  { label: "Alertas de inventario", href: "/admin/inventory/alerts", group: "operacion", roles: ["ADMIN", "STOCK_MANAGER", "SUPERVISOR"], icon: "alerts", description: "Casos pendientes fuera de umbral" },
  { label: "Intakes", href: "/admin/inventory/intakes", group: "operacion", roles: ["ADMIN", "STOCK_MANAGER", "SUPERVISOR"], icon: "reports", description: "Revisión de discrepancias" },
  {
    label: "Ventas",
    href: "/admin/sales",
    group: "operacion",
    roles: ["ADMIN", "SUPERVISOR"],
    icon: "sales",
    description: "Historial de ventas y detalle",
    shortcut: "Alt+L",
  },
  {
    label: "Reportes",
    href: "/admin/reports",
    group: "operacion",
    roles: ["ADMIN", "STOCK_MANAGER"],
    icon: "reports",
    description: "Reportes operativos y exportación tabular",
    shortcut: "Alt+R",
  },
  {
    label: "Promociones N×M",
    href: "/admin/promotions",
    group: "administracion",
    roles: ["ADMIN"],
    icon: "promotions",
    description: "Reglas de promociones vigentes por categoría",
    shortcut: "Alt+N",
  },
  {
    label: "Usuarios",
    href: "/admin/users",
    group: "administracion",
    roles: ["ADMIN"],
    icon: "users",
    description: "Gestión de personal y roles de acceso",
    shortcut: "Alt+U",
  },
  {
    label: "Configuración",
    href: "/admin/settings",
    group: "administracion",
    roles: ["ADMIN"],
    icon: "settings",
    description: "Parámetros del tenant y tope de intake",
    shortcut: "Alt+G",
  },
  {
    label: "Códigos pesables",
    href: "/admin/weighed-barcode",
    group: "administracion",
    roles: ["ADMIN"],
    icon: "weighed",
    description: "Configuración de prefijo y balanzas EAN-13",
    shortcut: "Alt+B",
  },
  {
    label: "Arqueos y Turnos",
    href: "/admin/cash-shifts",
    group: "administracion",
    roles: ["ADMIN", "SUPERVISOR"],
    icon: "shifts",
    description: "Supervisión de caja, arqueos y anulaciones",
    shortcut: "Alt+S",
  },
  {
    label: "Cajas y ubicaciones",
    href: "/admin/cash-registers",
    group: "administracion",
    roles: ["ADMIN"],
    icon: "settings",
    description: "Asignación de ubicación activa por caja",
    shortcut: "Alt+J",
  },
  {
    label: "Historial de caja",
    href: "/admin/cash-shifts/history",
    group: "administracion",
    roles: ["ADMIN", "SUPERVISOR"],
    icon: "shifts",
    description: "Turnos y movimientos históricos de caja",
    shortcut: "Alt+Y",
  },
  {
    label: "Punto de Venta (POS)",
    href: "/pos",
    group: "operacion",
    roles: ["ADMIN", "STOCK_MANAGER", "SUPERVISOR", "CASHIER"],
    icon: "pos",
    description: "Terminal operativa de cobro y ventas",
    shortcut: "Alt+P",
  },
];

export const ROLE_LABELS: Record<RoleName, { title: string; category: string; description: string }> = {
  ADMIN: {
    title: "Administrador / Gerente Tenant-wide",
    category: "Tenant-wide",
    description: "Acceso total a configuración, usuarios, promociones, reportes, compras y transferencias.",
  },
  STOCK_MANAGER: {
    title: "Gerente de Inventario",
    category: "Inventario",
    description: "Gestión de compras, transferencias y reportes operativos asignados.",
  },
  SUPERVISOR: {
    title: "Gerente de Turno y Caja",
    category: "Turno y Caja",
    description: "Supervisión de arqueos, autorizaciones, revisiones y turnos de caja.",
  },
  CASHIER: {
    title: "Cajero / Operador",
    category: "Operativo",
    description: "Operador de punto de venta y cobro. Sin acceso al panel administrativo.",
  },
};

export const KEYBOARD_SHORTCUTS = [
  { key: "Alt+H", description: "Ir al Inicio del panel administrativo" },
  { key: "Alt+P", description: "Ir al Punto de Venta (POS)" },
  { key: "Alt+K", description: "Abrir o cerrar ayuda de atajos de teclado" },
  { key: "Alt+M", description: "Abrir o cerrar menú de navegación en tablet/móvil" },
  { key: "Escape", description: "Cerrar menú lateral desplegable o diálogos modales" },
];

export function isRoleAuthorizedForAdmin(role: RoleName): boolean {
  return role !== "CASHIER";
}

export function getVisibleNavItems(role: RoleName, operationalMode: "SIMPLE" | "MULTI" = "MULTI"): NavItem[] {
  if (role === "CASHIER") {
    return ADMIN_NAV_ITEMS.filter((item) => item.href === "/pos");
  }
  const items = ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
  // A single-branch kiosco never needs branch transfers or register management.
  if (operationalMode === "SIMPLE") {
    const hidden = new Set(["/admin/transfers", "/admin/cash-registers"]);
    return items.filter((item) => !hidden.has(item.href));
  }
  return items;
}

const ROUTE_LABELS: Record<string, string> = {
  "/admin": "Inicio",
  "/admin/purchases": "Compras",
  "/admin/suppliers": "Proveedores",
  "/admin/transfers": "Transferencias",
  "/admin/inventory": "Inventario",
  "/admin/inventory/receipts": "Recepciones",
  "/admin/inventory/alerts": "Alertas de inventario",
  "/admin/inventory/intakes": "Intakes",
  "/admin/sales": "Ventas",
  "/admin/reports": "Reportes",
  "/admin/promotions": "Promociones N×M",
  "/admin/users": "Usuarios",
  "/admin/settings": "Configuración",
  "/admin/weighed-barcode": "Códigos pesables",
  "/admin/cash-shifts": "Arqueos y Turnos",
  "/admin/cash-shifts/history": "Historial de caja",
  "/admin/cash-registers": "Cajas y ubicaciones",
  "/pos": "Punto de Venta (POS)",
};

export type Breadcrumb = {
  label: string;
  href: string;
};

export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const normalized = pathname.replace(/\/$/, "") || "/admin";
  const crumbs: Breadcrumb[] = [{ label: "Inicio", href: "/admin" }];

  if (normalized === "/admin") {
    return crumbs;
  }
  if (normalized === "/admin/cash-shifts/history") {
    return [...crumbs, { label: "Historial de caja", href: normalized }];
  }

  const segments = normalized.split("/").filter(Boolean);
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    if (currentPath === "/admin") continue;

    const label = ROUTE_LABELS[currentPath]
      ?? (currentPath.startsWith("/admin/inventory/intakes/") ? "Detalle de intake" : segments[i].charAt(0).toUpperCase() + segments[i].slice(1));
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}
