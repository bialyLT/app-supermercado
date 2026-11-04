# Arqueos y turnos

## Apertura con cajas por nombre

La pantalla `/admin/cash-shifts` reemplaza el ingreso manual del UUID de caja por un `<select>` nativo con etiqueta accesible **Caja**. Cada opción muestra:

- nombre de la caja;
- nombre y código de su sucursal;
- nombre y código de la ubicación configurada, cuando existe.

El UUID permanece como `value` interno de la opción y es el `registerId` enviado en el `POST` de apertura. La interfaz no selecciona una caja arbitraria ni ofrece entrada libre para escribir UUID. Mientras carga, ante un error y cuando no hay opciones, la apertura queda deshabilitada; los errores ofrecen **Reintentar cajas** y el estado vacío explica que no hay cajas en las sucursales autorizadas.

## Fuente autorizada de opciones

`GET /api/admin/cash-shifts` responde `{ "registers": [...] }`. Deriva identidad, tenant y sucursales de la sesión y de las asignaciones persistidas del actor. El repositorio verifica el permiso existente `cash.session.open` dentro de la transacción con tenant/RLS; no reutiliza el endpoint ADMIN de asignación de ubicaciones, no agrega permisos y no acepta tenant o sucursal desde query/body.

La consulta no excluye cajas sin ubicación, con sesión abierta ni otras condiciones que impidan abrir turno. Esto evita convertir el selector en una segunda política de disponibilidad. El `POST /api/admin/cash-shifts` conserva toda la validación existente: tenant, sucursal persistida, permiso, ubicación activa de la misma sucursal, sesión única, configuración monetaria, importes, motivo e idempotencia. Por tanto, una caja visible puede ser rechazada al confirmar según las reglas vigentes.

Los UUID de turno de las demás operaciones no cambian en este alcance. Los contratos y las acciones `open`, `movement`, `blind-close` y `close` permanecen en el mismo endpoint.
