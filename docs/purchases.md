# Compras — Recepción Directa de Proveedor

Documentación del módulo de recepción directa de compras (Épica 6: S8, S15, S23).

## 1. Alcance y Principios

- **S8 Compras**: Registro directo de recepciones de mercadería de proveedores hacia sucursales y ubicaciones de stock.
- **S15 Recepción directa**: La mercadería ingresa directamente al stock de la sucursal y ubicación indicada sin pasos intermedios de despacho previo.
- **S23 Con impuestos y sin emisión fiscal**: Almacena subtotal, total de impuestos (`taxTotal`), total de descuentos (`discountTotal`) y total final. Al ser un comprobante interno de ingreso de mercadería por remito/factura del proveedor, **no emite comprobante fiscal** ni consume numeradores fiscales de venta.
- **Ledger de inventario**: Genera movimientos atómicos de stock (`InventoryMovement`) con `type = "RECEIPT"` y `direction = "IN"`, actualizando el saldo materializado (`InventoryLevel.onHand`) en orden determinista para prevenir deadlocks.
- **Idempotencia**: Garantizada por `(tenantId, idempotencyKey)`. Reenvíos idénticos devuelven el comprobante ya creado sin duplicar stock; reenvíos con datos diferentes arrojan conflicto (`IDEMPOTENCY_CONFLICT` / HTTP 409).
- **Aislamiento Multi-tenant y RLS**: Todas las tablas (`Supplier`, `PurchaseReceipt`, `PurchaseReceiptLine`) implementan Row Level Security obligatorio y vinculación estricta de tenant.

## 2. Permisos y Seguridad

- **Roles autorizados**: `ADMIN`, `STOCK_MANAGER`.
- **Permisos requeridos**: `"inventory:write"` o `"inventory.receive"`.
- Los roles `CASHIER` y `SUPERVISOR` no poseen acceso y reciben `HTTP 403 FORBIDDEN`.
- Sin sesión válida se responde `HTTP 401 UNAUTHENTICATED`.

## 3. Endpoints HTTP

### POST `/api/admin/purchases`
Crea una recepción directa de compra.

**Headers requeridos**:
- `Content-Type: application/json`

**Body**:
```json
{
  "supplierId": "uuid",
  "branchId": "uuid",
  "locationId": "uuid",
  "receiptNumber": "REC-2026-001",
  "issuedAt": "2026-10-30T12:00:00Z",
  "currency": "ARS",
  "subtotal": "100.00",
  "taxTotal": "21.00",
  "discountTotal": "0.00",
  "total": "121.00",
  "idempotencyKey": "unique-command-key-123",
  "lines": [
    {
      "variantId": "uuid",
      "lotId": "uuid",
      "lotNumber": "LOT-001",
      "expiresAt": "2027-10-30T00:00:00Z",
      "quantity": "10",
      "unitCost": "10.00",
      "taxRate": "0.21",
      "taxAmount": "21.00",
      "discountAmount": "0.00"
    }
  ],
  "notes": "Entrega directa conforme"
}
```

**Respuestas**:
- `201 Created`: Objeto `PurchaseReceipt` con sus líneas y totales calculados.
- `400 Bad Request`: Error de validación o totales inconsistentes (`INVALID_TOTALS`, `INVALID_INPUT`, `INVALID_QUANTITY_PRECISION`).
- `401 Unauthorized`: Sin sesión activa (`UNAUTHENTICATED`).
- `403 Forbidden`: Rol o permisos insuficientes (`FORBIDDEN`).
- `404 Not Found`: Proveedor, sucursal, ubicación o variante inexistente o perteneciente a otro tenant (`NOT_FOUND`).
- `409 Conflict`: Clave de idempotencia duplicada con payload diferente (`IDEMPOTENCY_CONFLICT`).

### GET `/api/admin/purchases`
Lista las recepciones directas del tenant autenticado.

**Parámetros de consulta opcionales**:
- `branchId`: UUID de la sucursal.
- `supplierId`: UUID del proveedor.

**Respuesta**:
- `200 OK`: `{ "receipts": [...], "tenantId": "uuid" }`

### GET `/api/admin/purchases/[id]`
Obtiene el detalle de una recepción directa de compra por ID.

**Respuesta**:
- `200 OK`: Detalle de `PurchaseReceipt` con sus líneas y datos del proveedor.
- `404 Not Found`: Comprobante inexistente o de otro tenant.

### POST `/api/admin/purchases/suppliers`
Crea un proveedor para el tenant.

**Body**:
```json
{
  "code": "PROV-001",
  "name": "Distribuidora Mayorista SA",
  "taxId": "30-11223344-5",
  "email": "ventas@mayorista.test",
  "phone": "+54 11 4444-5555",
  "address": "Av. Siempre Viva 123"
}
```

**Respuesta**:
- `201 Created`: Proveedor creado.

### GET `/api/admin/purchases/suppliers`
Lista todos los proveedores activos del tenant.

**Respuesta**:
- `200 OK`: `{ "suppliers": [...], "tenantId": "uuid" }`
