# Brief — Cierre de dependencias mínimas de Épica 2

## Autorización y precedencia

El usuario pidió «continua» después del informe de hardening y eligió
«Configuración obligatoria» para moneda/tope monetario por tenant. Este brief
extiende el hardening anterior únicamente con los prerrequisitos necesarios
para cerrar sus cuatro bloqueos. Adelanta sesiones mínimas y step-up; no inicia
el resto del backend fiscal, pagos, arqueos, offline ni UI de Épica 3/4.
DOMAIN_RULES, decisiones aprobadas y GATES mantienen su precedencia.

## Alcance

1. Sesión persistida de caja con tenant, caja, sucursal, cajero, apertura/cierre
   UTC e inmutabilidad una vez cerrada. A lo sumo una abierta por caja y por
   cajero; vender exige la sesión abierta del actor en la sucursal de ubicación.
2. Política administrable por tenant: moneda y máximo monetario sin defaults
   de negocio. Abrir caja exige configuración completa. Cantidades conservan
   los defaults aprobados 10/30/20. Topes reales por sesión, sin reset por login.
3. Precio efectivo consultado en servidor con moneda explícita; el precio
   declarado por el comando no es autoridad. Valor de intake = faltante × precio
   servidor, redondeado según moneda HALF_UP. Snapshot de moneda/valor/sesión.
4. PIN de supervisor hasheado con scrypt; intentos y bloqueo persistidos.
   Token opaco de un uso, TTL 90 s, ligado a operación de venta completa,
   entidad, solicitante y sesión de caja. Aprobador distinto, activo, con permiso
   y asignado a la sucursal. Audit registra ambos, nunca PIN/hash/token.
5. Consumir aprobación y vender en la misma transacción. Expiración, doble uso,
   cambio de payload/sucursal/solicitante y carreras se deniegan sin stock parcial.
6. Alertas backend derivadas de casos pendientes con antigüedad > N días,
   N configurable por tenant, default 7. Consulta automática al leer alertas,
   filtrada por tenant/sucursales autorizadas; no se agrega infraestructura de
   notificaciones ni scheduler.

## Criterios medibles

- Venta sin sesión, sesión cerrada/ajena, otra sucursal y rol insuficiente:
  denegación y 0 efectos de inventario/venta/comando.
- 20 aperturas concurrentes de una caja: exactamente 1 sesión; cierre
  idempotente y sesión cerrada inmutable en base.
- Topes por cantidad y valor exactos con Decimal; cambiar login no los reinicia;
  sesión nueva válida tiene presupuesto independiente. Cambios de moneda no
  mezclan valores con una sesión ya abierta.
- PIN incorrecto 5 veces bloquea 15 minutos; intentos comprometidos persisten.
  Sin aprobación apropiada no se venden vencidos ni se elude REQUIRE_SUPERVISOR.
- 20 usos paralelos del mismo token en comandos distintos no producen más de
  un efecto autorizado. Mismo comando reenviado conserva resultado original.
- Token vencido a 90 s, reusado o de otro actor/comando: 0 efectos; auditoría
  relaciona al aprobador y al solicitante sin secretos.
- Caso de 7 días exactos no alerta; >7 sí; resuelto y caso ajeno no aparecen.
- RLS y pruebas por todas las tablas nuevas, y reconciliación global en 0.
- Gates de GATES.md, cobertura dominio ≥90%, global ≥80%, concurrencia 20×.

## Implementación y verificación

Un escritor. Reproducciones negativas antes del arreglo; migraciones nuevas,
incluidas ampliaciones no destructivas para precisión monetaria y vínculos
legacy opcionales. Los datos previos no se imputan a una caja inventada.
Servicios internos con Actor verificado y reloj inyectado; no se publica una UI
POS ni un contrato fiscal anticipado. Auditoría de seguridad read-only sobre
árbol congelado, correcciones en serie y re-ejecución de baterías afectadas.

## Entregables

Código, pruebas reales PostgreSQL, migraciones y configuración sin secretos;
informe `.github/web-dev-loop/reports/epica-2-closure.md` con números, cambios,
supuestos y decisiones pendientes. No commit/push.
