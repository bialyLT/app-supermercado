# Códigos Pesables EAN-13 con Precio Incrustado

Documento técnico del primer corte de la Épica 5 (D-018, D-019). Define el contrato,
la configuración por tenant, la validación transaccional server-side, la persistencia
inmutable y la interacción con el POS.

## 1. Formato y Layout Inicial

El formato inicial soportado es **EAN-13 con precio incrustado**:
- **Longitud:** 13 dígitos numéricos exactos.
- **Prefijo:** Configurable por tenant (longitud 1 a 6 dígitos; requiere configuración explícita, sin prefijo por defecto).
- **SKU de Variante:** 5 dígitos numéricos (relleno con ceros a la izquierda).
- **Precio Incrustado:** 5 dígitos numéricos con escala decimal 2 (por ejemplo `00125` = `$1.25`).
- **Dígito Verificador:** 1 dígito de control estándar EAN-13 (módulo 10 ponderado 1/3).
- **Invariante de layout:** `char_length(prefix) + variantDigits + valueDigits == 12`.

## 2. Configuración por Tenant

La configuración es tenant-scoped y se almacena en la tabla `WeighedBarcodeConfig`:
- `tenantId` (UUID, PK, FK a Tenant con CASCADE)
- `prefix` (TEXT, check `^[0-9]+$`)
- `mode` (ENUM: `PRICE` | `WEIGHT`, primer corte `PRICE`)
- `variantDigits` (INTEGER, > 0)
- `valueDigits` (INTEGER, > 0)
- `valueScale` (INTEGER, >= 0)

Restricción a nivel de base de datos (`WeighedBarcodeConfig_layout_check`):
`variantDigits > 0 AND valueDigits > 0 AND valueScale >= 0 AND char_length(prefix) + variantDigits + valueDigits = 12`.

Endpoint administrativo:
- `POST /api/admin/weighed-barcode` (requiere permiso `settings:write`, audita `weighed_barcode_config.updated`).

## 3. Resolución y Validación Transaccional

### Endpoint de consulta POS
- `GET /api/pos/barcodes/price?code=<ean13>`:
  - Resuelve la variante activa del tenant que coincide con el SKU del código.
  - Retorna `{ variantId, sku, name, productName, unitPrice }`.
  - Mapea errores tipados de dominio a respuestas HTTP controladas.

### Validación en la transacción de venta (`confirmSaleCore`)
En la misma transacción que procesa la venta, el movimiento de stock y los pagos:
1. Si una línea incluye `weighedBarcode`:
   - Verifica existencia de `WeighedBarcodeConfig` del tenant.
   - Valida el layout del código contra la configuración del tenant.
   - Rechaza precio incrustado cero o negativo (`WEIGHED_BARCODE_ZERO_PRICE`).
   - Resuelve la variante activa dentro del tenant; el `variantId` enviado debe coincidir con la variante resuelta.
   - Si la línea envía `unitPrice`, debe coincidir exactamente con el precio incrustado.
   - **Autoridad del precio vigente:** El precio incrustado se valida contra el precio vigente de la sucursal (`serverPrice`, priorizando precio por sucursal sobre precio general). Si difiere, rechaza con `PRICE_MISMATCH`.
2. Si una línea no incluye `weighedBarcode` (línea desmarcada):
   - Se preserva el comportamiento histórico: el `unitPrice` del cliente es ignorado y se cobra el precio vigente del servidor.

## 4. Snapshot Inmutable en `SaleLine`

Para auditoría y trazabilidad inmutable de la regla y el código pesable:
- Campo aditivo `sourceSnapshot` (JSONB nullable) en la tabla `SaleLine`.
- Para líneas con `weighedBarcode`, persiste:
  ```json
  {
    "type": "WEIGHED_BARCODE",
    "raw": "2012345001251",
    "prefix": "20",
    "sku": "12345",
    "mode": "PRICE",
    "variantDigits": 5,
    "valueDigits": 5,
    "valueScale": 2,
    "unitPrice": "1.25"
  }
  ```
- Para líneas desmarcadas, `sourceSnapshot` es `null`.
- **Inmutabilidad en base:** Trigger `SaleLine_source_snapshot_immutable` (`protect_sale_line_source_snapshot`) que bloquea cualquier actualización que modifique `sourceSnapshot` una vez insertado (`SALE_LINE_SOURCE_SNAPSHOT_IMMUTABLE`).

## 5. Errores y Códigos de Dominio

| Código de Error | HTTP Status | Causa |
|---|---|---|
| `WEIGHED_BARCODE_NOT_CONFIGURED` | 400 | El tenant no tiene configuración de códigos pesables |
| `WEIGHED_BARCODE_MODE_UNSUPPORTED` | 400 | El modo configurado no es `PRICE` |
| `EAN13_PREFIX_MISMATCH` | 400 | El código no comienza con el prefijo configurado |
| `INVALID_EAN13` | 400 | La longitud no es de 13 dígitos o contiene caracteres no numéricos |
| `INVALID_EAN13_CHECKSUM` | 400 | El dígito verificador EAN-13 no coincide |
| `INVALID_EAN13_LAYOUT` | 400 | La suma de prefijo, dígitos de SKU y dígitos de precio no es 12 |
| `WEIGHED_BARCODE_ZERO_PRICE` | 400 | El precio incrustado es menor o igual a cero |
| `PRICE_MISMATCH` | 409 | El precio incrustado no coincide con el precio vigente en sucursal o con el `unitPrice` enviado |
| `NOT_FOUND` | 404 | La variante con el SKU incrustado no existe o está inactiva en el tenant |
| `UNAUTHENTICATED` | 401 | Sesión ausente o inválida |
| `FORBIDDEN` | 403 | Permisos insuficientes |

## 6. Comportamiento en el POS (`/pos`)

- **Diferenciación de EAN-13 comercial vs. pesable:**
  - Cuando se ingresa un código de 13 dígitos, se intenta resolver como pesable contra `/api/pos/barcodes/price`.
  - Si el endpoint responde `WEIGHED_BARCODE_NOT_CONFIGURED` o `EAN13_PREFIX_MISMATCH`, se asume que es un código de barras comercial ordinario y cae automáticamente a la búsqueda en catálogo (`/api/pos/catalog`).
  - Si el endpoint responde un error de escaneo configurado (`INVALID_EAN13_CHECKSUM`, `WEIGHED_BARCODE_ZERO_PRICE`, `NOT_FOUND`, etc.), se muestra el error directamente al cajero sin caer al catálogo.
- **Preservación y limpieza:**
  - Al resolverse el código pesable, se guardan en el estado el precio unitario y el código original.
  - Al agregarse la línea al carrito (vía botón o F4), la línea conserva `unitPrice` y `weighedBarcode`.
  - El formulario se limpia inmediatamente para el siguiente escaneo.
- **Manejo de estado asíncrono y atajos de teclado:**
  - Se utiliza un contador secuencial de búsqueda para descartar respuestas asíncronas desordenadas.
  - Los atajos F4 (agregar) y F10 (confirmar) invocan referencias mutables actualizadas en cada render, evitando cierres obsoletos (`stale closures`).

## 7. Semántica Offline

- **Imposibilidad de resolución offline nueva:**
  - Un código pesable nuevo no puede resolverse sin conexión porque requiere la configuración del tenant y el catálogo/precio vigente del servidor. Si el POS está offline al escanear, se informa al usuario la imposibilidad de resolverlo.
- **Preservación en cola offline:**
  - Si los productos pesables ya fueron resueltos y cargados en el carrito estando online, y luego se pierde la conexión al momento del checkout (F10), el comando offline encolado en IndexedDB preserva íntegramente `weighedBarcode` y `unitPrice` en las líneas del payload para su replay idempotente posterior.
