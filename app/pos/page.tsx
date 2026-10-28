"use client";

import { useEffect, useState } from "react";
import { enqueue, pendingCommands, remove, type OfflineCommand } from "../../src/pos/offline-queue";
import styles from "./pos.module.css";

type Line = { variantId: string; locationId: string; quantity: string; label: string };
type Payment = { method: "CASH" | "TRANSFER" | "CARD" | "WALLET"; amount: string };
type Suggestion = { id: string; sku: string; name: string; productName: string };

const methods = ["CASH", "TRANSFER", "CARD", "WALLET"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PosPage() {
  const [locationId, setLocationId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<Line[]>([]);
  const [payments, setPayments] = useState<Payment[]>([{ method: "CASH", amount: "" }]);
  const [status, setStatus] = useState("");
  const [change, setChange] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);

  const [commandId, setCommandId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const refreshQueue = () => void pendingCommands().then((items) => setQueued(items.length)).catch(() => undefined);
    const replay = async () => {
      const items = await pendingCommands().catch(() => []);
      for (const item of items) {
        const response = await fetch(item.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.payload) }).catch(() => null);
        if (!response) break;
        const body = await response.json().catch(() => ({})) as { error?: string; details?: Array<{ path: (string | number)[]; message: string }> };
        if (response.ok) await remove(item.commandId);
        else if (response.status === 409) { setStatus(`Conflicto offline ${item.commandId}: revisión requerida`); break; }
        else {
          const detail = body.details?.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join(", ");
          setStatus(`Replay rechazado: ${body.error ?? `HTTP_${response.status}`}${detail ? ` (${detail})` : ""}`);
          break;
        }
      }
      refreshQueue();
    };
    const onOnline = () => { setOffline(false); void replay(); };
    const onOffline = () => setOffline(true);
    queueMicrotask(() => {
      setOffline(!navigator.onLine);
      if (navigator.onLine) void replay();
    });
    refreshQueue();
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); document.getElementById("variant")?.focus(); }
      if (event.key === "F4") { event.preventDefault(); addLine(); }
      if (event.key === "F8") { event.preventDefault(); document.getElementById("payment")?.focus(); }
      if (event.key === "F10") { event.preventDefault(); void checkout(); }
      if (event.key === "Escape") { setLines([]); setStatus(""); setChange(null); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  // Keyboard handlers intentionally close over current command state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(value: string) {
    setVariantId(value);
    const query = value.trim().toLowerCase();
    if (query.length < 2) { setSuggestions([]); return; }
    const cached = () => {
      const items = JSON.parse(localStorage.getItem("supermercado-pos-catalog") ?? "[]") as Suggestion[];
      return items.filter((item) => `${item.sku} ${item.name} ${item.productName}`.toLowerCase().includes(query));
    };
    if (!navigator.onLine) {
      const items = cached();
      setSuggestions(items);
      setStatus(items.length ? "Catálogo local: sin conexión" : "Producto no disponible en catálogo local");
      return;
    }
    try {
      const response = await fetch(`/api/pos/catalog?q=${encodeURIComponent(value)}`);
      if (!response.ok) return;
      const items = (await response.json() as { items: Suggestion[] }).items;
      localStorage.setItem("supermercado-pos-catalog", JSON.stringify(items));
      setSuggestions(items);
    } catch {
      const items = cached();
      setSuggestions(items);
      setStatus(items.length ? "Catálogo local: sin conexión" : "Producto no disponible en catálogo local");
    }
  }

  function addLine() {
    if (!locationId.trim() || !uuidPattern.test(locationId.trim())) { setStatus("Ingresá una ubicación válida"); return; }
    if (!uuidPattern.test(variantId.trim())) { setStatus("Seleccioná un producto del catálogo"); return; }
    setLines((current) => [...current, { variantId: variantId.trim(), locationId: locationId.trim(), quantity, label: variantId.trim() }]);
    setVariantId("");
    setQuantity("1");
    setStatus("");
  }

  function updatePayment(index: number, patch: Partial<Payment>) {
    setPayments((current) => current.map((payment, i) => i === index ? { ...payment, ...patch } : payment));
  }

  async function checkout() {
    if (!lines.length || busy) return;
    if (payments.some((payment) => !/^\d+(\.\d{1,4})?$/.test(payment.amount) || Number(payment.amount) <= 0)) {
      setStatus("Ingresá un importe válido para cada medio de pago");
      return;
    }
    setBusy(true); setStatus("Procesando…"); setChange(null);
    const payload = { lines: lines.map((line) => ({ variantId: line.variantId, locationId: line.locationId, quantity: line.quantity })), payments, idempotencyKey: commandId };
    try {
      const response = await fetch("/api/pos/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string; change?: string; id?: string };
      if (!response.ok) throw new Error(body.error ?? "REQUEST_FAILED");
      setStatus(`Venta ${body.id ?? "confirmada"}`); setChange(body.change ?? "0.00"); setLines([]); setCommandId(crypto.randomUUID());
    } catch (error) {
      if (error instanceof TypeError || !navigator.onLine) {
        const command: OfflineCommand = { commandId, kind: "SALE", endpoint: "/api/pos/checkout", payload: { ...payload, allowUnverifiedIntake: true }, createdAt: Date.now() };
        await enqueue(command); setQueued((count) => count + 1); setOffline(true); setStatus("Sin conexión: venta en cola local"); setLines([]); setCommandId(crypto.randomUUID());
      } else setStatus(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally { setBusy(false); }
  }

  return <main className={styles.shell} aria-label="Punto de venta">
    <header><h1>POS</h1><p>Keyboard-first · F2 buscar · F4 agregar · F8 pagar · F10 confirmar · Esc limpiar</p><p role="status">{offline ? "Offline · comandos se guardan localmente" : "Online"} · En cola: {queued}</p></header>
    <section className={styles.grid}>
      <form onSubmit={(event) => { event.preventDefault(); addLine(); }} aria-label="Agregar producto">
        <label htmlFor="location">Ubicación</label>
        <input id="location" value={locationId} onChange={(event) => setLocationId(event.target.value)} required />
        <label htmlFor="variant">Variante / código</label>
        <input id="variant" value={variantId} onChange={(event) => void search(event.target.value)} autoFocus required />
        {suggestions.length > 0 && <ul aria-label="Resultados de búsqueda">{suggestions.map((item) => <li key={item.id}><button type="button" onClick={() => { setVariantId(item.id); setSuggestions([]); }}>{item.name} · {item.sku}</button></li>)}</ul>}
        <label htmlFor="quantity">Cantidad</label>
        <input id="quantity" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
        <button type="submit">Agregar (F4)</button>
      </form>
      <section aria-label="Carrito"><h2>Carrito</h2>{lines.length === 0 ? <p>Vacío</p> : <ul>{lines.map((line, index) => <li key={`${line.variantId}-${index}`}>{line.label} × {line.quantity}</li>)}</ul>}</section>
      <section aria-label="Pago"><h2>Pago</h2>
        {payments.map((payment, index) => <div className={styles.paymentRow} key={`${payment.method}-${index}`}><select value={payment.method} onChange={(event) => updatePayment(index, { method: event.target.value as Payment["method"] })}>{methods.map((method) => <option key={method}>{method}</option>)}</select><input id={index === 0 ? "payment" : undefined} inputMode="decimal" aria-label={`Monto ${payment.method}`} value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} /></div>)}
        <button type="button" onClick={() => setPayments((current) => [...current, { method: "CARD", amount: "" }])}>Agregar medio</button>
        <button type="button" onClick={() => void checkout()} disabled={busy || !lines.length}>{busy ? "Procesando…" : "Confirmar (F10)"}</button>
        {change !== null && <p role="status">Vuelto: <strong>{change}</strong></p>}
      </section>
    </section>
    <p role="status" aria-live="polite">{status}</p>
  </main>;
}
