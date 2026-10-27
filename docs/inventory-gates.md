# Épica 2: conexiones y gates reproducibles

## Conexiones separadas

- `MIGRATION_DATABASE_URL`: propietario de esquema, solo para Prisma CLI.
- `DATABASE_URL`: LOGIN de aplicación miembro de `supermercado_app`, sin propiedad de tablas, SUPERUSER, BYPASSRLS, CREATEDB o CREATEROLE.
- `AUTH_DATABASE_URL`: LOGIN de autenticación miembro de `supermercado_auth`. Solo tiene acceso al bootstrap de identidad y tablas de Better Auth; no tiene acceso a inventario.
- `TEST_DATABASE_URL`: propietario de una base descartable, usado exclusivamente por fixtures y ataques de integración. No usar una base con datos operativos.

Las migraciones crean los roles de grupo NOLOGIN, permisos, políticas y triggers. Las credenciales LOGIN se provisionan fuera del esquema. No se reutiliza la conexión de migraciones en runtime. La ausencia de las URLs permite importar módulos, generar/validar Prisma y construir Next; una operación real exige su conexión configurada.

## Ejemplo local de gate (PowerShell)

Este contenedor es descartable y usa autenticación trust solo en el puerto de loopback de pruebas. No usar esta configuración para la aplicación desplegada.

```powershell
docker run --detach --name supermercado-epic2-gate --publish 127.0.0.1:55439:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=supermercado_gate postgres:16-alpine
$env:MIGRATION_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/supermercado_gate'
$env:TEST_DATABASE_URL = $env:MIGRATION_DATABASE_URL
$env:DATABASE_URL = 'postgresql://supermercado_gate_runtime@127.0.0.1:55439/supermercado_gate'
$env:AUTH_DATABASE_URL = 'postgresql://supermercado_gate_auth@127.0.0.1:55439/supermercado_gate'
npm.cmd run db:migrate
npm.cmd run test:db:setup
npm.cmd test
npm.cmd run test:coverage
npm.cmd run test:ledger
npm.cmd run test:concurrency
npm.cmd run test:e2e
```

`test:db:setup` solo acepta localhost/127.0.0.1 y una base cuyo nombre termine en `_gate`. No se conecta a un entorno remoto. `test:concurrency` falla si falta el entorno de integración: omitir 20 tests no cuenta como gate aprobado. Las rondas también forman parte de `test` y `test:coverage`; no es necesario repetirlas si ya se ejecutaron sobre el mismo árbol final.

Los tests crean tenants únicos sin TRUNCATE global. La base y el contenedor se descartan al terminar su uso. E2E levanta su propio servidor en `127.0.0.1:3109`, sin reutilizar servidores ajenos.

## Contrato interno de inventario

Los servicios conservan sus nombres y reciben `(actor, input, clock?)`. `Actor` se obtiene con `getServerActor()` desde Better Auth; el repositorio vuelve a comprobar sesión, usuario activo, roles y sucursales persistidos. `tenantId`, `actorUserId`, `role`, `sessionId` y permisos no pertenecen al comando. Las claves idempotentes son obligatorias. El resultado estable es `{ id, type, total? }`, con importes como string.

Los comandos validados se normalizan antes del hash SHA-256. Se incluye tipo de operación y usuario; renovar la sesión no cambia la identidad del comando. Una clave histórica del ledger que no tenga hash verificable se bloquea con `LEGACY_IDEMPOTENCY_REVIEW_REQUIRED`: nunca se reejecuta silenciosamente.

Las transacciones toman un advisory lock por tenant para serializar presupuestos y deduplicación. Los levels se bloquean en orden determinista y se descuentan con UPDATE condicional. Es una implementación conservadora de Épica 2; no es una medición de capacidad para supermercado.

Sin `branchId`, la consulta de precio devuelve únicamente un precio global del
tenant. Con una sucursal autorizada, prioriza su precio y usa el global como
fallback. Esto evita consultar implícitamente precios de otras sucursales.

## Cierre posterior de las dependencias

- `configureInventoryPolicy(actor, input)` define moneda, tope monetario, modo y topes de cantidad. Requiere permiso de administración. No hay moneda ni monto inicial predeterminados.
- `openRegisterSession`/`closeRegisterSession` implementan el ciclo mínimo: una abierta por caja y cajero, sucursal autorizada y cierre inmutable. Toda venta nueva exige la sesión abierta de su actor; renovar login no reinicia presupuesto.
- Los precios se consultan en servidor, con moneda explícita y prioridad de sucursal. El precio del comando es una comprobación, no autoridad. Precios legacy sin moneda se rechazan hasta su configuración explícita.
- `setSupervisorPin` configura el PIN propio de un supervisor autenticado. Se guarda scrypt con sal aleatoria; 5 errores bloquean 15 minutos. Emitir más de 10 aprobaciones por minuto se bloquea también con PIN correcto.
- `approveInventorySale` emite token opaco de 90 s ligado al solicitante, sesión de caja y venta exacta. No admite autoaprobación; comprueba rol/sucursal del aprobador tanto al emitir como al consumir. El token se consume en la transacción de venta; si esta falla, la aprobación no se pierde.
- Un `approvalToken` válido habilita la excepción de vencimiento o REQUIRE_SUPERVISOR. No omite topes de cantidad/valor. Los reenvíos del mismo comando devuelven el resultado original, incluso después de consumido el token.
- `listInventoryAlerts` deriva alertas de casos PENDING_REVIEW con edad estrictamente mayor a N días (default 7), y volumen por cajero, con aislamiento de tenant/sucursal. No agrega correo, push ni un scheduler.

Son servicios backend internos; pagos, arqueos, fiscalidad, interfaz POS y rutas
POS versionadas siguen el roadmap de Épica 3/4. Informe vigente:
`.github/web-dev-loop/reports/epica-2-closure.md`.
