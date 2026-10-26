# Supermercado — Master Plan

**Estado:** aprobado para iniciar el bootstrap
**Alcance:** ciclo completo, desde arquitectura hasta despliegue y operación inicial
**Fuente de requisitos:** [iniciar-proyecto.md](./iniciar-proyecto.md)
**Contexto reutilizable:** [REUSABLE_RETAIL_SYSTEM_CONTEXT.md](./REUSABLE_RETAIL_SYSTEM_CONTEXT.md)

## Objetivo

Construir un sistema POS/ERP web para un kiosco, con una base arquitectónica
que pueda crecer a supermercado: múltiples sucursales, cajas concurrentes,
depósitos, pesables, lotes, vencimientos, roles, auditoría y operación
tolerante a cortes breves de conectividad.

## Principios no negociables

- TypeScript strict; no `any`.
- Validación server-side con Zod.
- Totales, precios, impuestos y descuentos se recalculan en servidor.
- Stock trazable mediante ledger inmutable, no por sobrescritura silenciosa.
- Transacciones ACID y control explícito de concurrencia.
- Autorización server-side; ocultar botones no es seguridad.
- Auditoría de operaciones sensibles.
- Un solo escritor por ola; testers read-only en paralelo.
- No se implementa una fase sin brief, criterios medibles y OK.
- No se declaran gates verdes sin números y evidencia.

## Stack base propuesto

- Next.js App Router como modular monolith inicial.
- TypeScript strict.
- PostgreSQL.
- Prisma ORM.
- Zod.
- Tailwind CSS, shadcn/ui, Radix y Lucide.
- TanStack Query.
- IndexedDB/PWA para cola local y tolerancia offline.
- Vitest para unit/integration.
- Playwright para E2E y responsive.
- Docker Compose para desarrollo y despliegue reproducible.

La elección final se valida durante la Épica 0 contra los requisitos de
hardware, offline, facturación y hosting. No se introducirán microservicios de
entrada.

## Benchmarking — 10 decisiones transferibles

1. Separar catálogo, inventario, ventas, caja y fiscalidad.
2. Modelar recepciones como movimientos de stock.
3. Mantener stock por ubicación.
4. Separar producto, variante y atributos.
5. Distinguir reservado de disponible.
6. Diseñar caja como sesión controlada.
7. Permitir contabilización inmediata o diferida.
8. Congelar precio, descuento e impuesto en cada transacción.
9. Auditar desde el flujo del ticket.
10. Separar operación local offline de sincronización central idempotente.

Fuentes: [OSPOS](https://github.com/opensourcepos/opensourcepos),
[WallacePOS](https://github.com/WallacePOS/WallacePOS),
[ChromisPOS](https://github.com/ChromisPos/ChromisPOS),
[ERPNext POS](https://docs.frappe.io/erpnext/point-of-sale),
[Bagisto](https://docs.bagisto.com/) y
[Medusa](https://github.com/medusajs/medusa).

## Cobertura de testing aprobada

- Interfaz/E2E y responsive.
- Base de datos, invariantes y concurrencia.
- Calidad de código.
- Seguridad y OWASP.
- API y contratos.
- Performance y carga.

Exploración estructural será proactiva. La memoria persistente externa queda
pendiente de configurar; hasta entonces, las decisiones y resultados viven en
este repositorio.

## Entregables de ciclo completo

- Arquitectura y ADRs.
- Scaffold reproducible y configuración de entorno.
- Esquema Prisma y migraciones no destructivas.
- API, autenticación, RBAC y auditoría.
- Catálogo, precios, inventario y Kardex.
- POS keyboard-first y cola offline.
- Caja, pagos, cierres y reportes.
- Tests unitarios, integración, E2E, seguridad y performance.
- Docker, CI/CD, backups, observabilidad, runbook y checklist de release.
- Documentación operativa y de instalación.
