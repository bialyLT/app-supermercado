import type { RoleName } from "../src/domain/contracts";

export type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly roles: readonly RoleName[];
  readonly description?: string;
  readonly badge?: string;
  readonly shortcut?: string;
};

export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Inicio",
    href: "/admin",
    roles: ["ADMIN", "STOCK_MANAGER", "SUPERVISOR"],
    description: "Tablero operativo general",
    shortcut: "Alt+H",
  },
  {
    label: "Compras",
    href: "/admin/purchases",
    roles: ["ADMIN", "STOCK_MANAGER"],
    description: "Recepción y comprobantes de compra",
    shortcut: "Alt+C",
  },
  {
    label: "Proveedores",
    href: "/admin/suppliers",
    roles: ["ADMIN", "STOCK_MANAGER"],
    description: "Gestión y catálogo de proveedores comerciales",
    shortcut: "Alt+V",
  },
  {
    label: "Transferencias",
    href: "/admin/transfers",
    roles: ["ADMIN", "STOCK_MANAGER"],
    description: "Movimientos entre sucursales y depósitos",
    shortcut: "Alt+T",
  },
  {
    label: "Reportes",
    href: "/admin/reports",
    roles: ["ADMIN", "STOCK_MANAGER"],
    description: "Reportes operativos y exportación tabular",
    shortcut: "Alt+R",
  },
  {
    label: "Promociones N×M",
    href: "/admin/promotions",
    roles: ["ADMIN"],
    description: "Reglas de promociones vigentes por categoría",
    shortcut: "Alt+N",
  },
  {
    label: "Usuarios",
    href: "/admin/users",
    roles: ["ADMIN"],
    description: "Gestión de personal y roles de acceso",
    shortcut: "Alt+U",
  },
  {
    label: "Configuración",
    href: "/admin/settings",
    roles: ["ADMIN"],
    description: "Parámetros del tenant y tope de intake",
    shortcut: "Alt+G",
  },
  {
    label: "Códigos pesables",
    href: "/admin/weighed-barcode",
    roles: ["ADMIN"],
    description: "Configuración de prefijo y balanzas EAN-13",
    shortcut: "Alt+B",
  },
  {
    label: "Arqueos y Turnos",
    href: "/admin/cash-shifts",
    roles: ["ADMIN", "SUPERVISOR"],
    description: "Supervisión de caja, arqueos y anulaciones",
    shortcut: "Alt+S",
  },
  {
    label: "Punto de Venta (POS)",
    href: "/pos",
    roles: ["ADMIN", "STOCK_MANAGER", "SUPERVISOR", "CASHIER"],
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

export function getVisibleNavItems(role: RoleName): NavItem[] {
  if (role === "CASHIER") {
    return ADMIN_NAV_ITEMS.filter((item) => item.href === "/pos");
  }
  return ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

const ROUTE_LABELS: Record<string, string> = {
  "/admin": "Inicio",
  "/admin/purchases": "Compras",
  "/admin/suppliers": "Proveedores",
  "/admin/transfers": "Transferencias",
  "/admin/reports": "Reportes",
  "/admin/promotions": "Promociones N×M",
  "/admin/users": "Usuarios",
  "/admin/settings": "Configuración",
  "/admin/weighed-barcode": "Códigos pesables",
  "/admin/cash-shifts": "Arqueos y Turnos",
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

  const segments = normalized.split("/").filter(Boolean);
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    if (currentPath === "/admin") continue;

    const label = ROUTE_LABELS[currentPath] ?? segments[i].charAt(0).toUpperCase() + segments[i].slice(1);
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}
