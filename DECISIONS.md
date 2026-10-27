# DECISIONS — Registro de decisiones

Estados: **APROBADA** (vinculante), **PROPUESTA** (recomendada, a la espera de
OK del dueño del producto) y **PENDIENTE** (falta información de negocio).
Un agente solo trata como vinculantes las APROBADAS. Ante una PROPUESTA aplica
la recomendación como `SUPUESTO:` reversible.

| ID | Decisión | Estado | Necesaria antes de |
|---|---|---|---|
| D-001 | Modular monolith en Next.js App Router, sin microservicios | APROBADA | — |
| D-002 | Better Auth para autenticación | APROBADA | — |
| D-003 | `UNVERIFIED_INTAKE` atómico con revisión posterior | APROBADA | — |
| D-003b | Semántica de REJECTED y topes/política por tenant (ver `DOMAIN_RULES.md` §5) | APROBADA | — |
| D-004 | Aislamiento de tenant: repositorios + RLS de PostgreSQL | APROBADA | — |
| D-005 | Stock: ledger + `level` materializado con UPDATE condicional atómico y CHECK en base | APROBADA | — |
| D-006 | `store` = entidad fiscal del tenant; `branch` = sucursal física | PROPUESTA | Épica 3 |
| D-007 | Redondeo `HALF_UP` por línea; total = suma de líneas | PROPUESTA | Épica 3 |
| D-008 | Política offline: ventana máxima, qué se permite sin red, conflictos | PENDIENTE | Épica 4 |
| D-009 | Fiscalidad: país, condición tributaria, facturación electrónica, impresora | PENDIENTE | Épica 3 (esquema de venta) |
| D-010 | Proveedor de despliegue y región | PENDIENTE | Épica 6 |
| D-011 | Memoria persistente externa | PENDIENTE | cuando convenga |
| D-012 | Override de supervisor por PIN con token de un solo uso | PROPUESTA | Épica 3 |
| D-013 | Fuera de alcance: e-commerce, delivery, picking, fidelización | PROPUESTA | — |
| D-014 | Idempotencia por `(tenant, command_id)` + hash de payload; comandos POS como REST versionado | PROPUESTA | Épica 4 |
| D-015 | Moneda y tope monetario de intake obligatorios por tenant, sin valores de negocio por defecto; bloqueo hasta configurar | APROBADA | Apertura de sesión de caja |

## Fundamento de las propuestas

- **D-015:** El dueño eligió explícitamente «Configuración obligatoria» en la
  continuación del cierre de Épica 2. No se adopta país, moneda ni importe
  inicial implícito. El mínimo de sesiones y step-up autorizado para este
  cierre está delimitado en `.github/web-dev-loop/briefs/epica-2-closure.md`;
  no aprueba fiscalidad ni pagos.

- **D-003b:** Se aprueba `ALLOW_WITH_CAPS` como política inicial por tenant,
  con topes de 10 unidades por línea, 30 unidades por sesión de caja y 20
  unidades por variante por día. `REJECTED` no revierte el ledger: crea una
  discrepancia asociada y un ajuste posterior autorizado.
- **D-004:** Prisma no impone filtros por sí mismo; un `where` olvidado filtra
  datos entre tenants. Las tablas de Épica 2 recién se crean, es el momento
  más barato de activar RLS. El costo es envolver cada operación en una
  transacción que fije el tenant.
- **D-005:** Decidirlo ahora evita rediseñar tras pruebas de carga. Con 10
  cajas el cuello de botella son las filas calientes, y la actualización
  condicional atómica las resuelve sin bloqueos largos. Las pruebas de carga
  pasan a **validar** esta decisión, no a elegirla.
- **D-006:** En muchos países cada punto de venta fiscal cuelga de una razón
  social. Sin `store` como entidad fiscal el nivel es redundante con `tenant`.
  Si el negocio nunca tendrá más de una, se elimina el nivel.
- **D-009:** Condiciona documentos de venta, numeración, tasas e impresión.
  Deciderlo en Épica 5 obligaría a migrar el esquema de ventas.
- **D-013:** `REUSABLE_RETAIL_SYSTEM_CONTEXT.md` describe canal online y
  fulfillment; sin esta decisión un agente puede deslizarse hacia ese alcance.

## Preguntas que solo puede responder el dueño del producto

1. ¿País y condición tributaria del negocio? ¿Hace falta factura electrónica
   desde el primer día o alcanza un ticket interno al inicio?
2. ¿Cuántas cajas y sucursales a 12 meses? ¿Cuántos SKU aproximados?
3. ¿Hay balanza con etiqueta impresa? ¿Qué formato de código (peso o precio
   incrustado) y qué marca/modelo?
4. ¿Cuánto tiempo de corte de red hay que tolerar vendiendo (minutos, horas)?
5. ¿Se aceptará alguna vez stock negativo, o `UNVERIFIED_INTAKE` es la única
   válvula? ¿Qué topes son razonables para el kiosco?
6. ¿Precios distintos por medio de pago, por horario o por cliente?
7. ¿Hay actualización masiva de precios frecuente (inflación)? Si sí, se
   necesita una herramienta de cambio masivo auditada antes de Épica 3.
8. ¿Hardware: impresora térmica, cajón, escáner, display?

## Cómo agregar una decisión

Nueva fila con ID correlativo, estado y "necesaria antes de". Al aprobarse,
cambiar el estado y, si altera una regla, actualizar `DOMAIN_RULES.md` en el
mismo cambio. No se borran decisiones: se marcan `REEMPLAZADA por D-xxx`.
