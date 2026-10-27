# DOMAIN_RULES — Reglas de dominio no negociables

Este documento condensa los invariantes que, si se rompen, producen pérdida de
dinero, de stock o de confianza. Es la referencia de los tests de invariantes.

## 1. Glosario

| Término | Definición |
|---|---|
| tenant | Cliente del sistema (la empresa). Frontera dura de datos. |
| store | Entidad comercial/fiscal del tenant (por ejemplo, un CUIT o razón social). Ver D-006. |
| branch | Sucursal física. Pertenece a un store. |
| location | Depósito o zona de stock dentro de una sucursal. |
| register | Caja/terminal de cobro. |
| register_session | Turno de un cajero en una caja, de apertura a cierre. |
| variant | Unidad vendible real (SKU). El producto agrupa variantes. |
| movement | Fila inmutable del ledger de inventario. |
| level | Saldo materializado por (location, variant, lote?). |
| actor | Contexto autenticado: tenantId, userId, branchIds, permisos. Siempre derivado de la sesión. |

## 2. Dinero y cantidades

- Importes: `Decimal` en base y en código (`decimal.js` o equivalente). Nunca
  `number`. En contratos externos viajan como **string** con moneda explícita.
- Cantidades: `Decimal(18,3)`. Cada variante declara `quantity_precision`
  (0 para unidades, 3 para pesables); el servidor rechaza fracciones inválidas.
- Redondeo: se calcula con precisión interna ≥ 4 decimales y se redondea a la
  precisión de la moneda **por línea** con `ROUND_HALF_UP`; el total es la suma
  de líneas ya redondeadas. Cambiar esto exige nueva decisión (D-007).
- Impuestos: precio de lista con o sin impuesto es atributo explícito de la
  lista; la venta guarda neto, tasa e importe de impuesto por línea.
- Una venta guarda un **snapshot**: precio, lista y versión, regla/promo,
  tasa, unidad, cantidad y (si se conoce) costo. Nada se recalcula
  retroactivamente con precios actuales.

## 3. Tiempo

- Persistir `timestamptz` en UTC. Mostrar en la zona de la sucursal.
- "Día comercial" y cierre de caja se definen por sucursal, no por UTC.
- Los timestamps del cliente son informativos. La verdad es `server_received_at`.
- El dominio recibe un reloj inyectado; los tests lo controlan.

## 4. Ledger de inventario

- Cada movimiento tiene: tenant, branch, location, variant, lote (opcional),
  `type`, `quantity_delta` con signo, referencia (tipo + id), actor, terminal,
  motivo cuando aplique, `idempotency_key`, `created_at` del servidor.
- `level` (on_hand, reserved) es un saldo **materializado** que se actualiza en
  la **misma transacción** que el movimiento. `available = on_hand - reserved`.
- Restricciones en base de datos: `on_hand >= 0`, `reserved >= 0`,
  `reserved <= on_hand`.
- Descuento por actualización condicional atómica
  (`UPDATE … SET on_hand = on_hand - :q WHERE … AND on_hand - reserved >= :q`),
  nunca leer-modificar-escribir. Si afecta 0 filas, es falta de stock.
- Una transacción que toca varios levels los bloquea en orden determinista
  `(location_id, variant_id, lote_id)` para evitar deadlocks. Ante deadlock o
  fallo de serialización se reintenta (máx. 3) con la misma idempotency key.
- Append-only se **impone en la base**: trigger que rechaza UPDATE/DELETE y un
  rol de aplicación sin esos privilegios. Las correcciones son movimientos
  compensatorios.
- Reconciliación: para todo level, `on_hand == SUM(quantity_delta)` de sus
  movimientos. Existe una consulta/test que lo verifica; una divergencia es P0.
- Lotes con vencimiento: salida FEFO por defecto. Vender un lote vencido está
  bloqueado salvo aprobación de supervisor, auditada.

## 5. UNVERIFIED_INTAKE (extiende la decisión aprobada)

Ciclo de vida del caso: `PENDING_REVIEW → CONFIRMED | CORRECTED | REJECTED`.

- **Creación** (solo dentro de la transacción de venta): requiere permiso
  explícito, variante activa existente en el catálogo (un código desconocido
  jamás crea intake), y respetar la política del tenant:
  `DISABLED | ALLOW_WITH_CAPS | REQUIRE_SUPERVISOR`. Los topes (cantidad por
  línea, cantidad/valor por sesión de caja, cantidad por variante por día) son
  configuración, con valores por defecto conservadores.
- Entrada y salida comparten `case_id`. Costo y proveedor quedan en
  `UNKNOWN`; los reportes de margen deben marcarlo.
- **CONFIRMED**: el encargado reconoce que la mercadería existía. Se registra
  como recepción regularizada con costo (o reconocimiento explícito de
  "sin costo") mediante movimientos compensatorios; el original no se muta.
- **CORRECTED**: el encargado indica la cantidad realmente existente; la
  diferencia se registra como ajuste de pérdida con motivo.
- **REJECTED**: el intake no fue legítimo (error de escaneo, producto
  equivocado). El ledger **no se revierte** (la unidad ya salió). Se cierra el
  caso con veredicto y motivo y se abre un caso de discrepancia asociado a la
  línea de venta y a la sesión de caja. Cualquier corrección de stock de la
  variante correcta es un ajuste autorizado aparte.
- La política inicial aprobada es `ALLOW_WITH_CAPS`, con topes de 10 unidades
  por línea, 30 unidades por sesión de caja y 20 unidades por variante por
  día. Estos valores deben permanecer configurables por tenant.
- D-015: moneda y tope monetario por sesión requieren configuración explícita
  del tenant, sin valor de negocio predeterminado. Sin ella no se abre caja.
- **Separación de funciones**: quien creó el intake no puede revisarlo.
- Un caso resuelto es inmutable. Casos pendientes más de N días (default 7)
  generan alerta. El volumen de intakes por cajero es una métrica de fraude.

## 6. Offline e idempotencia

- Una venta hecha offline **ya ocurrió**: el cliente se llevó el producto y
  pagó. El servidor no la rechaza por stock o precio distinto; la acepta, la
  marca `requires_review` y registra la diferencia. Solo se rechaza por
  estructura inválida, dispositivo/usuario no autorizado o tenant incorrecto.
- Todo comando offline lleva: `command_id` (UUID generado y persistido en el
  cliente **antes** de enviar), `type`, `schema_version`, `device_id`,
  `branch_id`, `client_created_at`, `price_list_version` y `payload`.
- Idempotencia: única por `(tenant_id, command_id)` + hash del payload. Mismo
  id y mismo hash devuelve el resultado original; mismo id con otro hash es
  error 409, nunca una segunda ejecución.
- Los comandos del POS se exponen como route handlers versionados
  (`/api/v1/...`), no como Server Actions: un reintento offline necesita un
  contrato HTTP estable.
- Precios offline: el servidor recalcula con la `price_list_version` declarada.
  Si coincide con la vigente al `client_created_at`, debe dar el mismo total;
  una diferencia se marca, no se descarta la venta.
- La ventana máxima offline y el comportamiento fiscal son decisiones D-008 y
  D-009.

## 7. Autorización y auditoría

- Permisos con forma `recurso.acción` (ej. `inventory.adjust`), con alcance
  tenant o branch. Cada función de servicio recibe un `Actor` y verifica;
  ninguna lee identidad del input.
- **Override de supervisor (step-up)**: PIN hasheado (argon2/scrypt), con
  rate limit y bloqueo; produce un token de un solo uso, TTL 60–120 s, atado a
  (operación, entidad, solicitante). Aprobador ≠ solicitante. El audit registra
  a ambos.
- Audit log: actor, tenant, branch, terminal/IP, acción, entidad, antes/después,
  `correlation_id`, timestamp. Append-only impuesto en base como el ledger. Sin
  PII innecesaria, sin secretos. Las denegaciones se auditan con tope de tasa
  para que no inunden la tabla.

## 8. Aislamiento de tenant (defensa en profundidad)

1. Los servicios reciben `Actor`; el `tenantId` nunca viene del body/query.
2. Acceso a datos solo vía repositorios que inyectan el filtro de tenant;
   regla de lint que prohíbe importar el cliente Prisma fuera de ellos.
3. Políticas RLS en PostgreSQL con `tenant_id` fijado por transacción
   (`set_config('app.tenant_id', …, true)`), según D-004.
4. Un test automático recorre toda tabla con `tenant_id` y comprueba que un
   actor de otro tenant no lee ni muta.
5. Un recurso ajeno responde igual que uno inexistente (404), sin filtrar
   existencia.
6. Unicidad de códigos de barras **por tenant**, no global.

## 9. Ventas (vista previa de la épica correspondiente)

- Una venta confirmada es inmutable; se corrige con devolución, anulación
  autorizada o nota compensatoria como documentos nuevos.
- La numeración es correlativa por (store, punto de venta) mediante un contador
  bloqueado en transacción, sin saltos.
- No existe venta sin sesión de caja abierta en la caja y sucursal del actor.
  Las ventas offline se asocian a la sesión por la que se hicieron y se
  concilian si esa sesión ya cerró.

### Contexto tributario inicial (D-006/D-009)

- Argentina: perfil por razón social (`store`), compartido por sus sucursales;
  condiciones soportadas `MONOTRIBUTO` y `RESPONSABLE_INSCRIPTO`, sin default.
- Ticket interno inicial; no habilita emisión fiscal ni sustituye obligaciones.
- La venta toma el contexto tributario del servidor en su transacción. Cambiar
  el perfil no modifica snapshots históricos; la base impide su reescritura.
- Los registros legacy sin perfil no reciben condición retroactiva inventada.
- Reglas tributarias separadas de caja/pagos; no se infieren tasas impositivas.

## 10. Errores

Errores de dominio tipados con código estable; el mapeo a HTTP es único y
central. Nunca se devuelven stack traces, SQL ni mensajes que revelen
existencia de recursos de otro tenant.
