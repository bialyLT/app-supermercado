"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import styles from "./inventory-ui.module.css";
import { InventoryVariantField, LocationSelect, isVariantSelectionStale, operationalContextSchema, toContextErrorMessage, useVariantSelection, validateReceiptSelection } from "./inventory-selectors";
import type { CatalogSelectorItem, OperationalSelectorContext } from "./inventory-selectors";

type Receipt = { id:string; locationId:string; variantId:string; lotId:string|null; quantity:string; reason:string; actorUserId:string; createdAt:string; referenceId:string|null };
export type ReceiptFormState = { locationId:string; variantId:string; lotId:string; quantity:string; reason:string; idempotencyKey:string };
type Alert = { type:string; reviewId:string; createdAt:string; quantity:string; registerSessionId:string; thresholdDays:number };
type CashierTotal = { cashierId:string; currency:string; count:number; quantity:string; value:string|null };
type Intake = { id:string; locationId:string; variantId:string; lotId:string|null; quantity:string; reason:string; status:string; saleId:string|null; saleLineId:string|null; intakeValue:string|null; currency:string|null; businessDay:string|null; correctionQuantity:string|null; reviewedBy:string|null; reviewedAt:string|null; createdBy:string|null; createdAt:string; provider:string; costStatus:string };

function uuid() { return globalThis.crypto?.randomUUID?.() ?? `ui-${Math.random().toString(36).slice(2)}`; }
const uuidSchema = z.string().uuid();
const decimalSchema = z.string().regex(/^-?(?:\d+)(?:\.\d+)?$/);
const dateSchema = z.string().datetime({ offset:true });
const receiptSchema = z.object({ id:uuidSchema, locationId:uuidSchema, variantId:uuidSchema, lotId:uuidSchema.nullable(), quantity:decimalSchema, reason:z.string(), actorUserId:uuidSchema, createdAt:dateSchema, referenceId:uuidSchema.nullable() });
const alertSchema = z.object({ type:z.string(), reviewId:uuidSchema, createdAt:dateSchema, quantity:decimalSchema, registerSessionId:uuidSchema, thresholdDays:z.number().int().nonnegative() });
const cashierTotalSchema = z.object({ cashierId:uuidSchema, currency:z.string().min(1), count:z.number().int().nonnegative(), quantity:decimalSchema, value:decimalSchema.nullable() });
const intakeSchema = z.object({ id:uuidSchema, locationId:uuidSchema, variantId:uuidSchema, lotId:uuidSchema.nullable(), quantity:decimalSchema, reason:z.string(), status:z.enum(["PENDING_REVIEW","CONFIRMED","CORRECTED","REJECTED"]), saleId:uuidSchema.nullable(), saleLineId:uuidSchema.nullable(), intakeValue:decimalSchema.nullable(), currency:z.string().nullable(), businessDay:z.string().nullable(), correctionQuantity:decimalSchema.nullable(), reviewedBy:uuidSchema.nullable(), reviewedAt:dateSchema.nullable(), createdBy:uuidSchema.nullable(), createdAt:dateSchema, provider:z.string(), costStatus:z.string() });
export const receiptListResponseSchema = z.object({ receipts:z.array(receiptSchema) });
const alertsResponseSchema = z.object({ alerts:z.array(alertSchema), intakesByCashier:z.array(cashierTotalSchema) });
const intakesResponseSchema = z.object({ intakes:z.array(intakeSchema) });
const intakeDetailResponseSchema = z.object({ intake:intakeSchema });
export function parseInventoryResponse<T>(schema:z.ZodType<T>, data:unknown):T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("Respuesta inválida del servidor.");
  return parsed.data;
}
export function safeInventoryDate(value:string):string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Fecha inválida" : new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(parsed);
}
export function createReceiptFormState(): ReceiptFormState {
  return { locationId:"", variantId:"", lotId:"", quantity:"", reason:"", idempotencyKey:uuid() };
}
export function updateReceiptFormState(form:ReceiptFormState, field:Exclude<keyof ReceiptFormState, "idempotencyKey">, value:string):ReceiptFormState {
  if (form[field] === value) return form;
  return { ...form, [field]:value, idempotencyKey:uuid() };
}
export function resetReceiptFormState(form:ReceiptFormState):ReceiptFormState {
  return { ...form, locationId:"", variantId:"", lotId:"", quantity:"", reason:"", idempotencyKey:uuid() };
}
export function inventoryErrorMessage(status:number, code:string) {
  if (status===401) return "Tu sesión expiró. Volvé a iniciar sesión.";
  if (status===403) return "No tenés permiso para esta operación.";
  if (status===404) return "El recurso no existe o no está en tu sucursal.";
  if (status===409) return "El servidor informó un conflicto. Revisá el estado antes de reintentar.";
  return code === "REQUEST_FAILED" ? "No se pudo completar la solicitud. Reintentá." : `Solicitud rechazada (${code}).`;
}
const message = inventoryErrorMessage;
async function getJson<T>(url:string, schema:z.ZodType<T>, signal?:AbortSignal):Promise<T> {
  const response = await fetch(url, { signal, cache:"no-store" });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(message(response.status, typeof data==="object" && data && "error" in data && typeof data.error==="string" ? data.error : "REQUEST_FAILED"));
  return parseInventoryResponse(schema, data);
}

export function InventoryNav({ current }:{current:string}) {
  return <nav className={styles.nav} aria-label="Inventario">
    <Link href="/admin/inventory" aria-current={current==="inventory"?"page":undefined}>Inventario</Link>
    <Link href="/admin/inventory/receipts" aria-current={current==="receipts"?"page":undefined}>Recepciones</Link>
    <Link href="/admin/inventory/alerts" aria-current={current==="alerts"?"page":undefined}>Alertas</Link>
    <Link href="/admin/inventory/intakes" aria-current={current==="intakes"?"page":undefined}>Intakes</Link>
  </nav>;
}
function State({ loading, error, retry }:{loading:boolean;error:string|null;retry:()=>void}) {
  if (loading) return <p role="status" className={styles.status}>Cargando…</p>;
  if (error) return <div role="alert" className={`${styles.status} ${styles.error}`}><p>{error}</p><button className={styles.button} onClick={retry}>Reintentar</button></div>;
  return null;
}
function date(value:string) { return safeInventoryDate(value); }

export function ReceiptsPage() {
  const [rows,setRows]=useState<Receipt[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [sending,setSending]=useState(false); const [notice,setNotice]=useState<string|null>(null);
  const [form,setForm]=useState<ReceiptFormState>(()=>createReceiptFormState());
  const [context,setContext]=useState<OperationalSelectorContext|null>(null); const [contextLoading,setContextLoading]=useState(true); const [contextError,setContextError]=useState<string|null>(null);
  const variantSelection=useVariantSelection();
  const loadContext=()=>{setContextLoading(true);setContextError(null);getJson("/api/admin/context",operationalContextSchema).then(setContext).catch((e)=>setContextError(e instanceof TypeError?"No hay conexión. Reintentá.":toContextErrorMessage(e))).finally(()=>setContextLoading(false));};
  const load=()=>{setLoading(true);setError(null);getJson("/api/admin/inventory/receipts",receiptListResponseSchema).then((d)=>setRows(d.receipts)).catch((e)=>setError(e instanceof TypeError?"No hay conexión. Reintentá.":e.message)).finally(()=>setLoading(false));};
  useEffect(() => { queueMicrotask(() => { void load(); }); },[]);
  useEffect(() => { queueMicrotask(() => { void loadContext(); }); },[]);
  function handleVariantQuery(value:string){variantSelection.setQuery(value);if(variantSelection.selected&&isVariantSelectionStale(value,variantSelection.selected.label)){setForm((current)=>updateReceiptFormState(current,"variantId",""));}}
  function handleVariantSelect(option:CatalogSelectorItem){variantSelection.select(option);setForm((current)=>updateReceiptFormState(current,"variantId",option.id));}
  async function submit(event:FormEvent){event.preventDefault();setNotice(null);const selectionError=validateReceiptSelection({locationId:form.locationId,variantId:form.variantId,query:variantSelection.query,selectedLabel:variantSelection.selected?.label??"",quantity:form.quantity,reason:form.reason});if(selectionError){setNotice(selectionError);return;}setSending(true);try{const r=await fetch("/api/admin/inventory/receipts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,lotId:form.lotId||undefined})});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(message(r.status,d?.error??"REQUEST_FAILED"));setNotice("Recepción registrada por el servidor.");setForm(resetReceiptFormState(form));variantSelection.reset();load();}catch(e){setNotice(e instanceof TypeError?"No hay conexión. Los datos quedaron en el formulario.":e instanceof Error?e.message:"No se pudo registrar.");}finally{setSending(false);}}
  return <main className={styles.shell}><header className={styles.header}><div><h1>Recepciones</h1><p>Registrar ingresos y consultar el historial del ledger.</p></div><InventoryNav current="receipts"/></header>
    <section className={styles.panel}><h2>Nueva recepción</h2><form className={styles.form} onSubmit={submit}>
      {(contextError)&&<p role="alert" className={styles.status}>{contextError} <button type="button" className={styles.button} onClick={loadContext}>Reintentar ubicaciones</button></p>}
      <LocationSelect id="receipt-locationId" label="Ubicación" locations={context?.locations??[]} value={form.locationId} onChange={(v)=>setForm(updateReceiptFormState(form,"locationId",v))} loading={contextLoading} disabled={contextError!==null} fieldClassName={styles.field}/>
      <InventoryVariantField id="receipt-variantId" label="Variante" query={variantSelection.query} options={variantSelection.options} searching={variantSelection.searching} searchError={variantSelection.searchError} onQueryChange={handleVariantQuery} onSelect={handleVariantSelect} fieldClassName={styles.field}/>
      {(["lotId","quantity"] as const).map((name)=><div className={styles.field} key={name}><label htmlFor={`receipt-${name}`}>{name==="lotId"?"Lote (opcional)":"Cantidad"}</label><input id={`receipt-${name}`} inputMode={name==="quantity"?"decimal":undefined} value={form[name]} onChange={e=>setForm(updateReceiptFormState(form,name,e.target.value))}/></div>)}
      <div className={`${styles.field} ${styles.wide}`}><label htmlFor="receipt-reason">Motivo</label><textarea id="receipt-reason" value={form.reason} onChange={e=>setForm(updateReceiptFormState(form,"reason",e.target.value))}/></div>
      <div className={`${styles.actions} ${styles.wide}`}><button className={`${styles.button} ${styles.primary}`} disabled={sending}>{sending?"Registrando…":"Registrar recepción"}</button>{notice&&<span role="alert">{notice}</span>}</div>
    </form></section>
    <section><h2>Historial</h2><State loading={loading} error={error} retry={load}/>{!loading&&!error&&!rows.length&&<p className={styles.status}>No hay recepciones todavía.</p>}{!loading&&!error&&rows.length>0&&<div className={styles.tableWrap}><table className={styles.table}><caption className={styles.srOnly}>Historial de recepciones</caption><thead><tr><th>Fecha</th><th>Variante</th><th>Ubicación</th><th>Cantidad</th><th>Lote</th><th>Motivo</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{date(r.createdAt)}</td><td>{r.variantId}</td><td>{r.locationId}</td><td>{r.quantity}</td><td>{r.lotId??"—"}</td><td>{r.reason}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}

export function AlertsPage() {
  const [data,setData]=useState<{alerts:Alert[];intakesByCashier:CashierTotal[]}|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
  const load=()=>{setLoading(true);setError(null);getJson("/api/admin/inventory/alerts",alertsResponseSchema).then(setData).catch(e=>setError(e instanceof TypeError?"No hay conexión. Reintentá.":e.message)).finally(()=>setLoading(false));};useEffect(() => { queueMicrotask(() => { void load(); }); },[]);
  return <main className={styles.shell}><header className={styles.header}><div><h1>Alertas de inventario</h1><p>Casos pendientes que superaron el umbral configurado.</p></div><InventoryNav current="alerts"/></header><State loading={loading} error={error} retry={load}/>{!loading&&!error&&data&&<><section><h2>Intakes vencidos</h2>{!data.alerts.length?<p className={styles.status}>No hay alertas activas.</p>:<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Creado</th><th>Cantidad</th><th>Umbral</th><th>Caja</th><th>Acción</th></tr></thead><tbody>{data.alerts.map(a=><tr key={a.reviewId}><td>{date(a.createdAt)}</td><td>{a.quantity}</td><td>{a.thresholdDays} días</td><td>{a.registerSessionId}</td><td><Link className={styles.detailLink} href={`/admin/inventory/intakes/${a.reviewId}`}>Revisar</Link></td></tr>)}</tbody></table></div>}</section><section><h2>Acumulado por cajero</h2>{!data.intakesByCashier.length?<p className={styles.status}>Sin movimientos agrupados.</p>:<div className={styles.grid}>{data.intakesByCashier.map(x=><dl className={styles.card} key={`${x.cashierId}-${x.currency}`}><dt>Cajero</dt><dd>{x.cashierId}</dd><dt>Cantidad de casos</dt><dd>{x.count}</dd><dt>Volumen / valor</dt><dd>{x.quantity} · {x.value??"Costo no disponible"} {x.currency??""}</dd></dl>)}</div>}</section></>}</main>;
}

export function IntakesPage() {
  const [rows,setRows]=useState<Intake[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const load=()=>{setLoading(true);setError(null);getJson("/api/admin/inventory/intakes",intakesResponseSchema).then(d=>setRows(d.intakes)).catch(e=>setError(e instanceof TypeError?"No hay conexión. Reintentá.":e.message)).finally(()=>setLoading(false));};useEffect(() => { queueMicrotask(() => { void load(); }); },[]);
  return <main className={styles.shell}><header className={styles.header}><div><h1>Bandeja de intake</h1><p>Revisión de discrepancias creadas durante la operación.</p></div><InventoryNav current="intakes"/></header><State loading={loading} error={error} retry={load}/>{!loading&&!error&&!rows.length&&<p className={styles.status}>No hay intakes para revisar.</p>}{!loading&&!error&&rows.length>0&&<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Creado</th><th>Estado</th><th>Variante</th><th>Cantidad</th><th>Venta / caja</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{date(x.createdAt)}</td><td>{x.status}</td><td>{x.variantId}</td><td>{x.quantity}</td><td>{x.saleId??"—"}</td><td><Link className={styles.detailLink} href={`/admin/inventory/intakes/${x.id}`}>Ver detalle</Link></td></tr>)}</tbody></table></div>}</main>;
}

export function IntakeDetailPage({ id }:{id:string}) {
  const [item,setItem]=useState<Intake|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);const [sending,setSending]=useState(false);const [notice,setNotice]=useState<string|null>(null);const [form,setForm]=useState({decision:"CONFIRMED",reason:"",correctionQuantity:"",unitCost:"",acknowledgeUnknownCost:false});
  const load=()=>{setLoading(true);setError(null);getJson(`/api/admin/inventory/intakes/${id}`,intakeDetailResponseSchema).then(d=>setItem(d.intake)).catch(e=>setError(e instanceof TypeError?"No hay conexión. Reintentá.":e.message)).finally(()=>setLoading(false));};
  // The detail id is fixed for this page; retry intentionally reuses the same loader.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { queueMicrotask(() => { void load(); }); },[]);
  async function submit(e:FormEvent){e.preventDefault();setNotice(null);if(!form.reason.trim()||(form.decision==="CORRECTED"&&!form.correctionQuantity)||(form.decision==="CONFIRMED"&&!form.unitCost&&!form.acknowledgeUnknownCost)){setNotice("La decisión, el motivo y los datos requeridos deben estar completos.");return;}setSending(true);try{const body={decision:form.decision,reason:form.reason,correctionQuantity:form.correctionQuantity||undefined,unitCost:form.unitCost||undefined,acknowledgeUnknownCost:form.acknowledgeUnknownCost||undefined,idempotencyKey:uuid()};const r=await fetch(`/api/admin/inventory/intakes/${id}/review`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(message(r.status,d?.error??"REQUEST_FAILED"));setNotice("Revisión guardada por el servidor.");load();}catch(e){setNotice(e instanceof TypeError?"No hay conexión. El formulario quedó intacto.":e instanceof Error?e.message:"No se pudo revisar.");}finally{setSending(false);}}
  const readOnly=item?.status!=="PENDING_REVIEW";
  return <main className={styles.shell}><header className={styles.header}><div><h1>Detalle de intake</h1><p>Los valores mostrados provienen del servidor.</p></div><InventoryNav current="intakes"/></header><State loading={loading} error={error} retry={load}/>{item&&<><section className={styles.grid}>{[["Estado",item.status],["Variante",item.variantId],["Ubicación",item.locationId],["Cantidad",item.quantity],["Venta",item.saleId??"—"],["Caja",item.saleLineId??"—"],["Valor",item.intakeValue?`${item.intakeValue} ${item.currency??""}`:"Costo no disponible"],["Creador",item.createdBy??"—"]].map(([k,v])=><dl className={styles.card} key={k}><dt>{k}</dt><dd>{v}</dd></dl>)}</section>{readOnly?<p className={styles.status}>Caso resuelto: sólo lectura.</p>:<section className={styles.panel}><h2>Revisar caso</h2><form className={styles.form} onSubmit={submit}><div className={styles.field}><label htmlFor="decision">Decisión</label><select id="decision" value={form.decision} onChange={e=>setForm({...form,decision:e.target.value})}><option>CONFIRMED</option><option>CORRECTED</option><option>REJECTED</option></select></div><div className={styles.field}><label htmlFor="correctionQuantity">Cantidad corregida</label><input id="correctionQuantity" inputMode="decimal" value={form.correctionQuantity} onChange={e=>setForm({...form,correctionQuantity:e.target.value})}/></div><div className={styles.field}><label htmlFor="unitCost">Costo unitario</label><input id="unitCost" inputMode="decimal" value={form.unitCost} onChange={e=>setForm({...form,unitCost:e.target.value})}/></div><div className={`${styles.field} ${styles.wide}`}><label htmlFor="reason">Motivo</label><textarea id="reason" required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></div><label className={`${styles.wide} ${styles.touchTarget}`}><input type="checkbox" checked={form.acknowledgeUnknownCost} onChange={e=>setForm({...form,acknowledgeUnknownCost:e.target.checked})}/> Reconozco costo desconocido</label><div className={`${styles.actions} ${styles.wide}`}><button className={`${styles.button} ${styles.primary}`} disabled={sending}>{sending?"Guardando…":"Guardar revisión"}</button>{notice&&<span role="alert">{notice}</span>}</div></form></section>}</>}</main>;
}
