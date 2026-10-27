# Brief — Refuerzo de Épica 2

## Contexto

- Repositorio: `bialyLT/app-supermercado`
- Rama: `main`
- Base: commit actual al iniciar la ronda
- Épica: 2 — catálogo, precios e inventario
- Decisiones aprobadas: D-003b, D-004 y D-005

## Objetivo

Cerrar el addendum de Épica 2 sin avanzar a Épica 3. La implementación debe
preservar las APIs existentes, reforzar aislamiento multi-tenant y hacer
explícitos los invariantes de stock, idempotencia, intake, lotes y códigos
pesables.

## Alcance obligatorio

1. Repositorios/`Actor` y regla de boundary que impida Prisma fuera de ellos.
2. RLS PostgreSQL y tests negativos de aislamiento.
3. `CHECK` de saldos, UPDATE condicional atómico, retry de serialización/deadlock
   y reconciliación ledger/level.
4. Append-only de movimientos y auditoría a nivel de base.
5. Idempotencia por tenant y clave, incluyendo conflicto por hash distinto.
6. `UNVERIFIED_INTAKE` con `ALLOW_WITH_CAPS`, topes aprobados, permiso explícito,
   separación creador/revisor, estados inmutables y semántica `REJECTED`.
7. Parser puro EAN-13 pesable con prefijo configurable por tenant.
8. FEFO y bloqueo de lotes vencidos salvo autorización auditada.
9. Concurrencia real ejecutada 20 veces y pruebas de regresión.

## Invariantes y prohibiciones

- No aceptar `tenantId`, actor, sucursal ni totales del cliente como autoridad.
- No editar migraciones existentes; agregar migraciones nuevas.
- No usar `any`, mocks para integración PostgreSQL ni `Date.now()` en dominio.
- No modificar `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`.
- No dejar movimientos parciales ante errores de topes, idempotencia o permisos.

## Gates

Ejecutar los comandos de `GATES.md`: generación/validación/migración Prisma,
typecheck, lint, unitarias, cobertura, build, E2E, audit y `git diff --check`.
Agregar reconciliación sin divergencias, aislamiento por tabla, append-only,
conflicto de idempotencia y batería de concurrencia 20×.

## Entregables

- Código y migraciones nuevas.
- Tests positivos y negativos por cada criterio.
- Informe actualizado en `.github/web-dev-loop/reports/epica-2-dev.md` con
  resultados numéricos, política aprobada y riesgos residuales.
- Sin commit desde el agente implementador.
