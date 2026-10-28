"use client";

import { useEffect, useState } from "react";
import { enqueue, pendingCommands, remove, type OfflineCommand } from "../../src/pos/offline-queue";

type Line = { variantId: string; locationId: string; quantity: string; label: string };
type Payment = { method: "CASH" | "TRANSFER" | "CARD" | "WALLET"; amount: string };
type Suggestion = { id: string; sku: string; name: string; productName: string };

const methods = ["CASH", "TRANSFER", "CARD", "WALLET"] as const;

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
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [queued, setQueued] = useState(0);

  const [commandId, setCommandId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const refreshQueue = () => void pendingCommands().then((items) => setQueued(items.length)).catch(() => undefined);
    const replay = async () => {
      const items = await pendingCommands().catch(() => []);
      for (const item of items) {
        const response = await fetch(item.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.payload) }).catch(() => null);
        if (!response) break;
        if (response.ok) await remove(item.commandId);
        else if (response.status === 409) { setStatus(`Conflicto offline ${item.commandId}: revisión requerida`); break; }
      }
      refreshQueue();
    };
    const onOnline = () => { setOffline(false); void replay(); };
    const onOffline = () => setOffline(true);
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
    if (value.trim().length < 2) { setSuggestions([]); return; }
    const response = await fetch(`/api/pos/catalog?q=${encodeURIComponent(value)}`);
    if (response.ok) setSuggestions((await response.json() as { items: Suggestion[] }).items);
  }

  function addLine() {
    if (!variantId.trim() || !locationId.trim()) { setStatus("Ingresá ubicación y variante"); return; }
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

  return <main className="pos-shell" aria-label="Punto de venta">
    <style>{`.pos-shell { max-width: 1100px; margin: 0 auto; padding: 24px; } .pos-grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); } .pos-shell input, .pos-shell select, .pos-shell button { min-height: 44px; font-size: 1rem; margin: 4px; } .pos-shell label { display: block; margin-top: 8px; } .payment-row { display: flex; gap: 8px; }`}</style>
    <header><h1>POS</h1><p>Keyboard-first · F2 buscar · F4 agregar · F8 pagar · F10 confirmar · Esc limpiar</p><p role="status">{offline ? "Offline · comandos se guardan localmente" : "Online"} · En cola: {queued}</p></header>
    <section className="pos-grid">
      <form onSubmit={(event) => { event.preventDefault(); addLine(); }} aria-label="Agregar producto">
        <label htmlFor="location">Ubicación</label>
        <input id="location" value={locationId} onChange={(event) => setLocationId(event.target.value)} required />
        <label htmlFor="variant">Variante / código</label>
        <input id="variant" value={variantId} onChange={(event) => void search(event.target.value)} autoFocus required />
        {suggestions.length > 0 && <ul aria-label="Resultados de búsqueda">{suggestions.map((item) => <li key={item.id}><button type="button" onClick={() => { setVariantId(item.id); setSuggestions([]); }}>{item.name} · {item.sku}</button></li>)}</ul>}
        <label htmlFor="quantity">Cantidad</label>
        <input id="quantity" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
        <button type="submit" style={{ minHeight: "44px", minWidth: "44px" }}>Agregar (F4)</button>
      </form>
      <section aria-label="Carrito"><h2>Carrito</h2>{lines.length === 0 ? <p>Vacío</p> : <ul>{lines.map((line, index) => <li key={`${line.variantId}-${index}`}>{line.label} × {line.quantity}</li>)}</ul>}</section>
      <section aria-label="Pago"><h2>Pago</h2>
        {payments.map((payment, index) => <div className="payment-row" key={payment.method}><select value={payment.method} onChange={(event) => updatePayment(index, { method: event.target.value as Payment["method"] })}>{methods.map((method) => <option key={method}>{method}</option>)}</select><input id={index === 0 ? "payment" : undefined} inputMode="decimal" aria-label={`Monto ${payment.method}`} value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} /></div>)}
        <button type="button" style={{ minHeight: "44px", minWidth: "44px" }} onClick={() => setPayments((current) => [...current, { method: "CARD", amount: "" }])}>Agregar medio</button>
        <button type="button" style={{ minHeight: "44px", minWidth: "44px" }} onClick={() => void checkout()} disabled={busy || !lines.length}>{busy ? "Procesando…" : "Confirmar (F10)"}</button>
        {change !== null && <p role="status">Vuelto: <strong>{change}</strong></p>}
      </section>
    </section>
    <p role="status" aria-live="polite">{status}</p>
  </main>;
}
