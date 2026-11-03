"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "../../src/client/api-fetch";
import { formatCurrency, formatDateTime, formatQuantity, parseDateTimeLocal } from "../../src/client/presentation";
import { z } from "zod";
import styles from "./operational-read.module.css";

type Surface = "inventory" | "sales" | "cash";
type Filters = { branchId: string; locationId: string; variantId: string; from: string; to: string };
type Level = { id: string; location: { code: string; name: string }; variant: { sku: string; name: string; productName: string }; lot: { lotNumber: string } | null; onHand: string; reserved: string; available: string };
type Movement = { id: string; type: string; quantityDelta: string; location: { code: string; name: string }; variant: { sku: string; name: string }; reason: string | null; createdAt: string };
type Sale = { id: string; documentNumber: string; branchId: string | null; total: string; currency: string; createdAt: string; lineCount: number; paymentCount: number };
type Shift = { id: string; branchId: string | null; registerId: string; currency: string; openedAt: string; closedAt: string | null; declaredCash: string | null; expectedCash: string | null; difference: string | null; movements: { id: string; type: string; amount: string; reason: string | null; createdAt: string }[] };
type Detail = { id: string; documentNumber: string; total: string; currency: string; createdAt: string; lines: { id: string; productName: string; quantity: string; unitPrice: string; sourceSnapshot: unknown }[]; payments: { id: string; method: string; amount: string; currency: string }[] };
type InventoryData = { levels: Level[]; movements: Movement[] };

const initialFilters: Filters = { branchId: "", locationId: "", variantId: "", from: "", to: "" };
const titles: Record<Surface, string> = { inventory: "Inventario", sales: "Historial de ventas", cash: "Historial de caja" };

function query(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) {
    params.set(key, key === "from" || key === "to" ? parseDateTimeLocal(value) : value);
  }
  params.set("limit", "50");
  return params.toString();
}

function preserveQuery(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.set("limit", "50");
  return params.toString();
}

function filtersFromLocation(): Filters {
  if (typeof window === "undefined") return initialFilters;
  const params = new URLSearchParams(window.location.search);
  return { branchId: params.get("branchId") ?? "", locationId: params.get("locationId") ?? "", variantId: params.get("variantId") ?? "", from: params.get("from") ?? "", to: params.get("to") ?? "" };
}

const levelResponseSchema = z.object({ levels: z.array(z.object({ id: z.string(), location: z.object({ code: z.string(), name: z.string() }), variant: z.object({ sku: z.string(), name: z.string(), productName: z.string() }), lot: z.object({ lotNumber: z.string() }).nullable(), onHand: z.string(), reserved: z.string(), available: z.string() })) });
const movementResponseSchema = z.object({ movements: z.array(z.object({ id: z.string(), type: z.string(), quantityDelta: z.string(), location: z.object({ code: z.string(), name: z.string() }), variant: z.object({ sku: z.string(), name: z.string() }), reason: z.string().nullable(), createdAt: z.string() })) });
const saleResponseSchema = z.object({ sales: z.array(z.object({ id: z.string(), documentNumber: z.string(), branchId: z.string().nullable(), total: z.string(), currency: z.string(), createdAt: z.string(), lineCount: z.number(), paymentCount: z.number() })) });
const shiftResponseSchema = z.object({ shifts: z.array(z.object({ id: z.string(), branchId: z.string().nullable(), registerId: z.string(), currency: z.string(), openedAt: z.string(), closedAt: z.string().nullable(), declaredCash: z.string().nullable(), expectedCash: z.string().nullable(), difference: z.string().nullable(), movements: z.array(z.object({ id: z.string(), type: z.string(), amount: z.string(), reason: z.string().nullable(), createdAt: z.string() })) })) });

function endpoint(surface: Surface, filters: Filters): string {
  const suffix = query(filters);
  return surface === "inventory" ? `/api/admin/inventory/levels?${suffix}` : surface === "sales" ? `/api/admin/sales?${suffix}` : `/api/admin/cash-shifts/history?${suffix}`;
}

export function OperationalRead({ surface }: { readonly surface: Surface }) {
  const [filters, setFilters] = useState(filtersFromLocation);
  const [data, setData] = useState<Level[] | Sale[] | Shift[] | InventoryData>(surface === "inventory" ? { levels: [], movements: [] } : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const load = useCallback(async () => {
    setFilterError("");
    setLoading(true); setError("");
    try {
      if (filters.from && filters.to && new Date(parseDateTimeLocal(filters.to)).getTime() <= new Date(parseDateTimeLocal(filters.from)).getTime()) {
        setFilterError("El rango de fechas debe terminar después de comenzar.");
        return;
      }
      if (surface === "inventory") {
        const [levelsResponse, movementsResponse] = await Promise.all([
          apiFetch(endpoint(surface, filters)),
          apiFetch(`/api/admin/inventory/movements?${query(filters)}`),
        ]);
        const levels = levelResponseSchema.parse(await levelsResponse.json());
        const movements = movementResponseSchema.parse(await movementsResponse.json());
        setData({ levels: levels.levels, movements: movements.movements });
      } else {
        const response = await apiFetch(endpoint(surface, filters));
        if (surface === "sales") {
          setData(saleResponseSchema.parse(await response.json()).sales);
        } else {
          setData(shiftResponseSchema.parse(await response.json()).shifts);
        }
      }
    } catch (reason) { setError(errorMessage(reason)); setData(surface === "inventory" ? { levels: [], movements: [] } : []); }
    finally { setLoading(false); }
  }, [surface, filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  function update(key: keyof Filters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }

  return <section className={styles.shell} aria-labelledby={`${surface}-title`}>
    <header className={styles.header}><div><h1 id={`${surface}-title`}>{titles[surface]}</h1><p>Consulta de solo lectura, limitada por tu sesión y sucursales autorizadas.</p></div></header>
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); void load(); }}>
      <Filter label="Sucursal" value={filters.branchId} onChange={(v) => update("branchId", v)} placeholder="ID opcional" />
      {surface === "inventory" && <><Filter label="Ubicación" value={filters.locationId} onChange={(v) => update("locationId", v)} placeholder="ID opcional" /><Filter label="Variante / SKU" value={filters.variantId} onChange={(v) => update("variantId", v)} placeholder="ID opcional" /></>}
      <Filter label="Desde" type="datetime-local" value={filters.from} onChange={(v) => update("from", v)} />
      <Filter label="Hasta" type="datetime-local" value={filters.to} onChange={(v) => update("to", v)} />
      <div className={styles.actions}><button className={styles.button} type="submit">Aplicar filtros</button></div>
    </form>
    {filterError && <p className={styles.status} role="alert">{filterError}</p>}
    {loading && <p role="status">Cargando datos…</p>}
    {error && <div className={`${styles.status} ${error.includes("permisos") ? styles.forbidden : ""}`} role="alert">{error} <button className={styles.button} type="button" onClick={() => void load()}>Reintentar</button></div>}
    {!loading && !error && ((surface === "inventory" && !(data as InventoryData).levels.length && !(data as InventoryData).movements.length) || (surface !== "inventory" && !(data as (Sale[] | Shift[])).length)) && <p className={styles.empty}>No hay resultados para los filtros seleccionados.</p>}
    {!loading && !error && <ReadTable surface={surface} data={data} filters={filters} />}
  </section>;
}

function Filter({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <div className={styles.field}><label>{label}<input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label></div>;
}

function ReadTable({ surface, data, filters }: { surface: Surface; data: Level[] | Sale[] | Shift[] | InventoryData; filters: Filters }) {
  if (surface === "inventory") {
    const inventory = data as InventoryData;
    return <><div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Existencias por ubicación y variante</caption><thead><tr><th>Ubicación</th><th>Variante</th><th>Lote</th><th>Disponible</th><th>Reservado</th></tr></thead><tbody>{inventory.levels.map((row) => <tr key={row.id}><td>{row.location.name} ({row.location.code})</td><td>{row.variant.name} ({row.variant.sku})</td><td>{row.lot?.lotNumber ?? "Sin lote"}</td><td>{formatQuantity(row.available)}</td><td>{formatQuantity(row.reserved)}</td></tr>)}</tbody></table></div><div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Movimientos del ledger de inventario</caption><thead><tr><th>Fecha</th><th>Ubicación</th><th>Variante</th><th>Tipo</th><th>Variación</th><th>Motivo</th></tr></thead><tbody>{inventory.movements.map((row) => <tr key={row.id}><td>{formatDateTime(row.createdAt)}</td><td>{row.location.name} ({row.location.code})</td><td>{row.variant.name} ({row.variant.sku})</td><td>{row.type}</td><td className={row.quantityDelta.startsWith("-") ? styles.negative : styles.positive}>{formatQuantity(row.quantityDelta)}</td><td>{row.reason ?? "—"}</td></tr>)}</tbody></table></div></>;
  }
  if (surface === "sales") return <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Documento</th><th>Fecha</th><th>Total</th><th>Líneas</th><th /></tr></thead><tbody>{(data as Sale[]).map((row) => <tr key={row.id}><td>{row.documentNumber}</td><td>{formatDateTime(row.createdAt)}</td><td>{formatCurrency(row.total, row.currency)}</td><td>{row.lineCount}</td><td><Link className={styles.link} href={`/admin/sales/${row.id}?${preserveQuery(filters)}`}>Ver detalle</Link></td></tr>)}</tbody></table></div>;
  return <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Apertura</th><th>Estado</th><th>Esperado</th><th>Declarado</th><th>Diferencia</th><th>Movimientos</th></tr></thead><tbody>{(data as Shift[]).map((row) => <tr key={row.id}><td>{formatDateTime(row.openedAt)}</td><td>{row.closedAt ? "Cerrado" : "Abierto"}</td><td>{formatCurrency(row.expectedCash, row.currency)}</td><td>{formatCurrency(row.declaredCash, row.currency)}</td><td>{formatCurrency(row.difference, row.currency)}</td><td>{row.movements.length}</td></tr>)}</tbody></table></div>;
}

export function SaleDetail({ saleId }: { readonly saleId: string }) {
  const [sale, setSale] = useState<Detail | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const [backQuery] = useState(() => typeof window === "undefined" ? "" : window.location.search.replace(/^\?/, ""));
  const load = useCallback(() => { setLoading(true); setError(""); void apiFetch(`/api/admin/sales/${saleId}`).then(async (response) => {
    const body = await response.json();
    const parsed = z.object({ id: z.string(), documentNumber: z.string(), total: z.string(), currency: z.string(), createdAt: z.string(), lines: z.array(z.object({ id: z.string(), productName: z.string(), quantity: z.string(), unitPrice: z.string(), sourceSnapshot: z.unknown() })), payments: z.array(z.object({ id: z.string(), method: z.string(), amount: z.string(), currency: z.string() })) }).parse(body);
    setSale(parsed);
  }).catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false)); }, [saleId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (loading) return <p role="status">Cargando venta…</p>;
  if (error) return <div className={styles.status} role="alert">{error} <button className={styles.button} type="button" onClick={load}>Reintentar</button></div>;
  if (!sale) return <p className={styles.empty}>Venta no encontrada.</p>;
  return <div className={styles.detail}><Link className={styles.link} href={`/admin/sales${backQuery ? `?${backQuery}` : ""}`}>← Volver al historial</Link><h1>Venta {sale.documentNumber}</h1><dl className={styles.cards}><div className={styles.card}><dt>Fecha</dt><dd>{formatDateTime(sale.createdAt)}</dd></div><div className={styles.card}><dt>Total</dt><dd>{formatCurrency(sale.total, sale.currency)}</dd></div><div className={styles.card}><dt>Líneas</dt><dd>{sale.lines.length}</dd></div><div className={styles.card}><dt>Pagos</dt><dd>{sale.payments.length}</dd></div></dl><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th></tr></thead><tbody>{sale.lines.map((line) => <tr key={line.id}><td>{line.productName}</td><td>{formatQuantity(line.quantity)}</td><td>{formatCurrency(line.unitPrice, sale.currency)}</td></tr>)}</tbody></table></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Medio de pago</th><th>Importe</th></tr></thead><tbody>{sale.payments.map((payment) => <tr key={payment.id}><td>{payment.method}</td><td>{formatCurrency(payment.amount, payment.currency)}</td></tr>)}</tbody></table></div></div>;
}
