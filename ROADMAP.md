# Roadmap operativo

**Estado:** bootstrap aprobado; Fase 0 pendiente de ejecución

## Ola y gates

| Ola | Responsable | Tipo | Orden |
|---|---|---|---|
| 0 | Agent-DB/Backend | escribe scaffold y contratos | primero |
| 1 | Agent-SecQA + tester-quality | read-only | paralelo |
| 2 | Agent-Frontend/UI + API/performance | puede escribir | serie por recurso |
| 3 | Orquestador | gate, documentación y cierre | último |

La base de datos, el servidor y el navegador se serializan. Todo tester que
arregle código deja primero una reproducción fallida y luego re-ejecuta las
baterías afectadas.

## Épica 0 — Fundación y decisiones

- **Objetivo:** convertir requisitos en scaffold ejecutable y contratos.
- **Entregables:** arquitectura, ADRs, Next.js/TypeScript, Prisma/PostgreSQL,
  Zod/env, Docker, CI base, registry de testing y briefs.
- **Gates:** instalación limpia, typecheck, lint, tests mínimos y migración
  desde cero.
- **Fuera:** ventas reales, pagos y despliegue productivo.

## Épica 1 — Identity, RBAC y auditoría

- **Objetivo:** proteger tenant, sucursal y operaciones sensibles.
- **Entregables:** usuarios, roles, sesiones, permisos, audit log y rate limit.
- **Criterios:** una solicitud sin permiso falla server-side; cada cambio
  sensible deja actor, terminal, timestamp y valores relevantes.

## Épica 2 — Catálogo, precios e inventario

- **Objetivo:** catálogo extensible y Kardex concurrente.
- **Entregables:** variantes, códigos pesables, lotes, vencimientos,
  ubicaciones, recepciones, reservas, movimientos y ajustes autorizados.
- **Criterios:** ninguna venta puede producir stock negativo sin regla explícita;
  dos operaciones concurrentes no pierden movimientos.

## Épica 3 — POS keyboard-first y offline

- **Objetivo:** cobrar con teclado/escáner y tolerar microcortes.
- **Entregables:** búsqueda, atajos, lector, carrito, cola local, reintentos,
  idempotencia y responsive.
- **Criterios:** flujo principal sin mouse; targets móviles >=44px; comandos
  duplicados no duplican ventas.

## Épica 4 — Caja, pagos y arqueos

- **Objetivo:** controlar apertura, movimientos, pagos y cierre ciego.
- **Entregables:** sesiones, ingresos/retiros, medios de pago, diferencias,
  autorización de supervisor y reporte.
- **Criterios:** no se cierra dos veces; diferencia queda explicada y auditada.

## Épica 5 — Escala, reportes y despliegue

- **Objetivo:** operar múltiples sucursales y publicar con seguridad.
- **Entregables:** compras, transferencias, reportes, observabilidad, backups,
  CI/CD, staging, producción, rollback y runbook.
- **Criterios:** release reproducible, migración reversible cuando sea posible,
  backup restaurable probado y health checks.

## Sprint 1 — listo para ejecutar

### Objetivo

Crear la base ejecutable sin inventar dominio innecesario: scaffold, entorno,
contratos, tenant/sucursal/caja, RBAC mínimo, auditoría y gates.

### Criterios Gherkin

```gherkin
Given una base vacía
When ejecuto la migración inicial
Then el esquema se crea desde cero sin pasos manuales

Given un usuario sin permiso de administración
When intenta modificar una configuración sensible
Then el servidor rechaza la operación y registra el intento

Given dos tenants distintos
When consultan sus recursos
Then cada uno solo recibe datos de su tenant

Given una operación sensible autorizada
When se confirma el cambio
Then existe un audit log con actor, acción, timestamp y valores
```

### Entregables

- `package.json`, TypeScript strict y scripts documentados.
- Prisma schema y migración inicial.
- Configuración Zod de entorno.
- Tenant, store, branch, cash register, user, role y audit log.
- Tests unitarios/integración de invariantes.
- Playwright smoke mínimo y pipeline de calidad.
- Briefs e informes de cada ola.

### Definition of Done

No hay secretos, `any`, migración manual, gate sin número ni permiso confiado
solo a la UI. El árbol final queda sin cambios no explicados; el orquestador
decide el commit solo después del gate.

## Decisiones pendientes

1. Proveedor de despliegue y región.
2. Proveedor de autenticación o implementación propia.
3. Requisitos fiscales y hardware de impresión/escáner.
4. Política exacta de operación offline y resolución de conflictos.
5. Herramienta de memoria persistente compatible con el entorno.
