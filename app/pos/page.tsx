"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductCombobox } from "../../components/product-combobox";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { enqueue, pendingCommands, replayOfflineCommand, update, type OfflineCommand } from "../../src/pos/offline-queue";
import styles from "./pos.module.css";
import { ApiError, apiFetch } from "../../src/client/api-fetch";

type Line = { variantId: string; locationId: string; quantity: string; label: string; unitPrice?: string; weighedBarcode?: string };
type Payment = { method: "CASH" | "TRANSFER" | "CARD" | "WALLET"; amount: string };
type Suggestion = { id: string; sku: string; name: string; productName: string };

function suggestionLabel(item: Suggestion): string {
  const name = item.productName.trim() || item.name.trim() || "Producto";
  return item.sku.trim() ? `${name} · ${item.sku}` : name;
}

const methods = ["CASH", "TRANSFER", "CARD", "WALLET"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PosPage() {
  const router = useRouter();
  const [locationId, setLocationId] = useState("");
  const [locationReady, setLocationReady] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [scannedUnitPrice, setScannedUnitPrice] = useState<string | undefined>();
  const [scannedBarcode, setScannedBarcode] = useState<string | undefined>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<Line[]>([]);
  const [payments, setPayments] = useState<Payment[]>([{ method: "CASH", amount: "" }]);
  const [status, setStatus] = useState("");
  const [change, setChange] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [queueCounts, setQueueCounts] = useState({ pending: 0, processing: 0, completed: 0, conflict: 0, error: 0 });

  const [commandId, setCommandId] = useState(() => crypto.randomUUID());
  const searchSeq = useRef(0);
  const addLineRef = useRef<() => void>(() => {});
  const checkoutRef = useRef<() => Promise<void>>(async () => {});
  const linesRef = useRef(lines);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    const loadLocation = async () => {
      const response = await fetch("/api/pos/context").catch(() => null);
      if (!response) {
        setStatus("No se pudo resolver la ubicación autorizada");
        return;
      }
      const body = await response.json().catch(() => ({})) as { locationId?: string; error?: string };
      if (!response.ok || !body.locationId) {
        setStatus(body.error === "POS_LOCATION_AMBIGUOUS"
          ? "POS bloqueado: hay múltiples ubicaciones activas autorizadas"
          : "POS bloqueado: no hay una única ubicación activa autorizada");
        return;
      }
      setLocationId(body.locationId);
      setLocationReady(true);
    };
    void loadLocation();

    const refreshQueue = () => void pendingCommands().then((items) => {
      setQueueCounts(items.reduce((counts, item) => {
        const state = item.state ?? "pending";
        counts[state] += 1;
        return counts;
      }, { pending: 0, processing: 0, completed: 0, conflict: 0, error: 0 }));
    }).catch(() => setStatus("No se pudo leer la cola offline. Reintentá."));
    const replay = async () => {
      const items = await pendingCommands().catch(() => []);
      for (const item of items.filter((candidate) => (candidate.state ?? "pending") === "pending" || candidate.state === "error")) {
        await update(item.commandId, { state: "processing", lastError: undefined });
        const result = await replayOfflineCommand(item);
        await update(item.commandId, result);
        if (result.state !== "completed") {
          setStatus(`${result.lastError ?? "Replay rechazado"} (${item.commandId})`);
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
    const onSessionExpired = () => router.push("/");
    window.addEventListener("supermercado:session-expired", onSessionExpired);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); document.getElementById("variant")?.focus(); }
      if (event.key === "F4") { event.preventDefault(); addLineRef.current(); }
      if (event.key === "F8") { event.preventDefault(); document.getElementById("payment")?.focus(); }
      if (event.key === "F10") { event.preventDefault(); void checkoutRef.current(); }
      if (event.key === "Escape") {
        if (linesRef.current.length > 0) {
          setStatus("El carrito se conserva; no se realizó ningún cambio.");
          return;
        }
        setStatus("");
        setChange(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("supermercado:session-expired", onSessionExpired); };
  }, [router]);

  const retryQueue = () => {
    setStatus("Reintentando comandos offline…");
    void pendingCommands().then(() => {
      window.dispatchEvent(new Event("online"));
    });
  };

  async function searchCatalogQuery(queryText: string, seq: number) {
    const query = queryText.trim().toLowerCase();
    if (query.length < 2) {
      if (seq === searchSeq.current) setSuggestions([]);
      return;
    }
    const cached = () => {
      const items = JSON.parse(localStorage.getItem("supermercado-pos-catalog") ?? "[]") as Suggestion[];
      return items.filter((item) => `${item.sku} ${item.name} ${item.productName}`.toLowerCase().includes(query));
    };
    if (!navigator.onLine) {
      if (seq === searchSeq.current) {
        const items = cached();
        setSuggestions(items);
        setStatus(items.length ? "Catálogo local: sin conexión" : "Producto no disponible en catálogo local");
      }
      return;
    }
    try {
      const response = await fetch(`/api/pos/catalog?q=${encodeURIComponent(queryText)}`);
      if (seq !== searchSeq.current) return;
      if (!response.ok) return;
      const items = (await response.json() as { items: Suggestion[] }).items;
      if (seq !== searchSeq.current) return;
      localStorage.setItem("supermercado-pos-catalog", JSON.stringify(items));
      setSuggestions(items);
    } catch {
      if (seq !== searchSeq.current) return;
      const items = cached();
      setSuggestions(items);
      setStatus(items.length ? "Catálogo local: sin conexión" : "Producto no disponible en catálogo local");
    }
  }

  async function search(value: string) {
    const seq = ++searchSeq.current;
    setVariantId(value);
    setSelectedSuggestion(null);
    setScannedUnitPrice(undefined);
    setScannedBarcode(undefined);
    if (/^\d{13}$/.test(value.trim())) {
      if (!navigator.onLine) {
        setStatus("Sin conexión: no se puede resolver código pesable");
        await searchCatalogQuery(value, seq);
        return;
      }
      try {
        const response = await fetch(`/api/pos/barcodes/price?code=${encodeURIComponent(value.trim())}`);
        if (seq !== searchSeq.current) return;
        if (response.ok) {
          const item = await response.json() as Suggestion & { variantId: string; unitPrice: string };
          if (seq !== searchSeq.current) return;
          const selectedItem: Suggestion = { id: item.variantId, sku: item.sku, name: item.name, productName: item.productName };
          setVariantId(item.variantId);
          setSelectedSuggestion(selectedItem);
          setScannedUnitPrice(item.unitPrice);
          setScannedBarcode(value.trim());
          setSuggestions([selectedItem]);
          setStatus(`Código pesable: precio unitario ${item.unitPrice}`);
          return;
        }
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (seq !== searchSeq.current) return;
        if (body.error === "WEIGHED_BARCODE_NOT_CONFIGURED" || body.error === "EAN13_PREFIX_MISMATCH") {
          // Ordinary EAN13: fall back to catalog
          await searchCatalogQuery(value, seq);
          return;
        }
        // Invalid configured scan: show error and do not fall back
        setSuggestions([]);
        setStatus(`Código pesable inválido: ${body.error ?? "error"}`);
        return;
      } catch {
        if (seq !== searchSeq.current) return;
        setStatus("Error al resolver código pesable");
        setSuggestions([]);
        return;
      }
    }
    await searchCatalogQuery(value, seq);
  }

  function selectSuggestion(item: Suggestion) {
    ++searchSeq.current;
    setVariantId(item.id);
    setSelectedSuggestion(item);
    if (item.id !== variantId || !scannedBarcode) {
      setScannedUnitPrice(undefined);
      setScannedBarcode(undefined);
    }
    setSuggestions([]);
  }

  function addLine() {
    if (!locationReady || !locationId.trim() || !uuidPattern.test(locationId.trim())) { setStatus("POS bloqueado: ubicación autorizada no disponible"); return; }
    if (!uuidPattern.test(variantId.trim())) { setStatus("Seleccioná un producto del catálogo"); return; }
    ++searchSeq.current;
    const selectedItem = selectedSuggestion?.id === variantId.trim() ? selectedSuggestion : null;
    setLines((current) => [...current, { variantId: variantId.trim(), locationId: locationId.trim(), quantity, label: selectedItem ? suggestionLabel(selectedItem) : "Producto seleccionado", unitPrice: scannedUnitPrice, weighedBarcode: scannedBarcode }]);
    setVariantId("");
    setSelectedSuggestion(null);
    setScannedUnitPrice(undefined);
    setScannedBarcode(undefined);
    setQuantity("1");
    setSuggestions([]);
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
    const payload = {
      lines: lines.map((line) => ({
        variantId: line.variantId,
        locationId: line.locationId,
        quantity: line.quantity,
        ...(line.unitPrice ? { unitPrice: line.unitPrice } : {}),
        ...(line.weighedBarcode ? { weighedBarcode: line.weighedBarcode } : {}),
      })),
      payments,
      idempotencyKey: commandId,
    };
    try {
      const response = await apiFetch("/api/pos/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string; change?: string; id?: string };
      if (!response.ok) throw new Error(body.error ?? "REQUEST_FAILED");
      setStatus(`Venta ${body.id ?? "confirmada"}`); setChange(body.change ?? "0.00"); setLines([]); setCommandId(crypto.randomUUID());
    } catch (error) {
      if (error instanceof TypeError || !navigator.onLine) {
        const command: OfflineCommand = { commandId, kind: "SALE", endpoint: "/api/pos/checkout", payload: { ...payload, allowUnverifiedIntake: true }, createdAt: Date.now(), state: "pending" };
        await enqueue(command); setQueueCounts((counts) => ({ ...counts, pending: counts.pending + 1 })); setOffline(true); setStatus("Sin conexión: venta en cola local"); setLines([]); setCommandId(crypto.randomUUID());
      } else if (error instanceof ApiError && error.status === 0) {
        const command: OfflineCommand = { commandId, kind: "SALE", endpoint: "/api/pos/checkout", payload: { ...payload, allowUnverifiedIntake: true }, createdAt: Date.now(), state: "pending" };
        await enqueue(command); setQueueCounts((counts) => ({ ...counts, pending: counts.pending + 1 })); setOffline(true); setStatus("Sin conexión: venta en cola local"); setLines([]); setCommandId(crypto.randomUUID());
      } else setStatus(error instanceof Error ? error.message : "REQUEST_FAILED");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    addLineRef.current = addLine;
    checkoutRef.current = checkout;
  });

  // La shell aporta el único <main> del documento (S4): la página POS
  // renderiza su contenido en un div para no duplicar el landmark y delega
  // el nombre accesible al main de la shell en modo rail.
  return <div className={styles.shell}>
    <header className={styles.banner}>
      <div className={styles.bannerContext}>
        <h1>POS</h1>
        <p className={styles.shortcuts}>Atajos: <kbd>F2</kbd> buscar · <kbd>F4</kbd> agregar · <kbd>F8</kbd> pagar · <kbd>F10</kbd> confirmar · <kbd>Esc</kbd> conserva el carrito</p>
      </div>
      <div className={styles.bannerStatus}>
        {offline
          ? <Alert variant="error" className={styles.connection}>Offline · comandos se guardan localmente</Alert>
          : <Alert variant="success" className={styles.connection}>Online</Alert>}
        <p role="status" className={styles.queue}>{offline ? "Sin conexión" : "Conectado"} · Pendientes: {queueCounts.pending} · Procesando: {queueCounts.processing} · Completados: {queueCounts.completed} · Conflictos: {queueCounts.conflict} · Errores: {queueCounts.error}</p>
        {(queueCounts.conflict > 0 || queueCounts.error > 0) && <Button variant="secondary" type="button" onClick={retryQueue}>Reintentar cola</Button>}
      </div>
    </header>
    <div className={styles.grid}>
      <div className={styles.column}>
        <form className={styles.card} onSubmit={(event) => { event.preventDefault(); addLine(); }} aria-label="Agregar producto">
          <h2>Buscar o escanear</h2>
          <p role="status" className={styles.location}>{locationReady ? "Ubicación autorizada por el servidor" : "Resolviendo ubicación autorizada…"}</p>
          <div className={styles.scanRow}>
            <div className={styles.scanWrap}>
              <ProductCombobox
                id="variant"
                label="Variante / código"
                placeholder="Buscar por SKU, nombre o código..."
                value={selectedSuggestion ? suggestionLabel(selectedSuggestion) : variantId}
                options={suggestions}
                autoFocus
                inputClassName={styles.scanInput}
                onChange={(value) => void search(value)}
                onSelect={selectSuggestion}
              />
            </div>
            <div className={styles.quantityField}>
              <label htmlFor="quantity">Cantidad</label>
              <input id="quantity" className={styles.quantity} type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
            </div>
            <Button type="submit" variant="primary">Agregar (F4)</Button>
          </div>
        </form>
        <section className={styles.card} aria-label="Carrito">
          <h2>Carrito</h2>
          {lines.length === 0
            ? <p className={styles.empty}>Vacío</p>
            : <ul className={styles.lines}>{lines.map((line, index) => <li className={styles.line} key={`${line.variantId}-${index}`}><span className={styles.lineLabel}>{line.label}</span>{" "}<span className={styles.lineQuantity}>× {line.quantity}</span></li>)}</ul>}
        </section>
      </div>
      <section className={styles.card} aria-label="Pago">
        <h2>Pago</h2>
        {payments.map((payment, index) => <div className={styles.paymentRow} key={`${payment.method}-${index}`}><select aria-label={`Medio de pago ${index + 1}`} value={payment.method} onChange={(event) => updatePayment(index, { method: event.target.value as Payment["method"] })}>{methods.map((method) => <option key={method}>{method}</option>)}</select><input id={index === 0 ? "payment" : undefined} className={styles.paymentAmount} inputMode="decimal" aria-label={`Monto ${payment.method}`} value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} /></div>)}
        <Button type="button" variant="secondary" className={styles.wide} onClick={() => setPayments((current) => [...current, { method: "CARD", amount: "" }])}>Agregar medio</Button>
        <Button type="button" variant="primary" className={styles.wide} onClick={() => void checkout()} disabled={busy || !lines.length}>{busy ? "Procesando…" : "Confirmar (F10)"}</Button>
        {change !== null && <p role="status" className={styles.change}>Vuelto: <strong>{change}</strong></p>}

      </section>
    </div>
    <p role="status" aria-live="polite" className={styles.status}>{status}</p>
  </div>;
}
