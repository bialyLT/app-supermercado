# Épica 3 — Perfil tributario de razón social

Autorizado por el dueño: Argentina, ticket interno inicial, una razón social
con varias sucursales y soporte para monotributista y responsable inscripto.
Decisiones D-006, D-007 y alcance inicial de D-009 aprobados.

## Alcance y aceptación

- Perfil argentino por Store, no por sucursal ni por cajero; ambas condiciones
  disponibles, sin un tercer régimen «pendiente» ni selección predeterminada.
- Configuración exclusiva de administrador autenticado, con auditoría y RLS.
- Consulta desde sucursal autorizada; sucursales del mismo Store comparten perfil.
- Nueva venta de Store configurado conserva snapshot del perfil en transacción;
  cambiar configuración o reintentar venta no altera su contexto histórico.
- Migración nueva aditiva; legacy sin perfil conserva su comportamiento, sin
  backfill tributario. Ausencia legacy no es modalidad comercial del producto.
- Dominio fiscal puro separado de caja/pagos. HALF_UP por línea ya vigente.

## Fuera de alcance

Emisión ARCA, tasas/IVA, CUIT validado, impresora, numeración, pagos, arqueos,
UI y resto de Épica 3. Ticket interno no sustituye obligaciones fiscales.

## Verificación

Gates de `GATES.md` según superficie backend afectada. Integración con PostgreSQL
real descartable: permisos, tenants, sucursales, ambos regímenes, cambio de perfil,
snapshot protegido y replay idempotente. Sin leer .env real, commit ni push.
