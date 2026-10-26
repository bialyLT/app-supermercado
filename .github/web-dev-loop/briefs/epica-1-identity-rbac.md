# Brief — Épica 1: Identity, RBAC y auditoría

## Contexto

La Fase 0 dejó un scaffold Next.js/Prisma/PostgreSQL con aislamiento
cross-tenant estructural, contratos Zod y un modelo inicial de usuarios y
roles. La autenticación todavía no existe.

## Decisión aprobada

Usar Better Auth como solución de autenticación para Next.js. La integración
debe conservar el aislamiento por tenant y no debe aceptar `tenantId` desde el
cliente como autoridad.

## Objetivo

Implementar autenticación y autorización mínima, segura y testeable para los
roles `CASHIER`, `SUPERVISOR`, `STOCK_MANAGER` y `ADMIN`, junto con auditoría
append-only de operaciones sensibles y rate limiting del acceso.

## Alcance

- Configuración de Better Auth y persistencia compatible con Prisma.
- Sesiones seguras con cookies HttpOnly, Secure en producción y SameSite
  apropiado.
- Registro/login/logout y protección de rutas server-side.
- Resolución del tenant desde la sesión/identidad autenticada.
- RBAC por tenant y branch, sin confianza en la UI.
- Auditoría de login, logout, denegaciones y cambios de permisos.
- Rate limiting de login y endpoints sensibles.
- Tests positivos y negativos de autenticación, tenant isolation, RBAC y
  auditoría.

## Fuera de alcance

- Catálogo, precios, inventario, ventas, caja y pagos.
- OAuth/social login, 2FA y recuperación de cuenta si no son necesarios para
  el flujo mínimo; documentar como deuda explícita.
- Despliegue productivo y gestión de secretos reales.

## Criterios de aceptación

```gherkin
Given credenciales válidas de un usuario activo
When inicia sesión
Then recibe una sesión segura y el servidor identifica su tenant

Given un usuario autenticado sin permiso ADMIN
When intenta ejecutar una operación administrativa
Then el servidor responde denegado y crea un audit log

Given un usuario del tenant A
When consulta o muta un recurso del tenant B
Then la operación falla sin revelar si el recurso existe

Given múltiples intentos inválidos de login
When se supera el límite configurado
Then el servidor bloquea temporalmente los intentos y no expone secretos

Given una operación sensible autorizada
When se confirma
Then se registra actor, tenant, acción, entidad, timestamp y valores relevantes
```

## Invariantes

- La sesión es la fuente de identidad; `tenantId` del body/query no concede
  acceso.
- Toda consulta operativa filtra por tenant derivado del servidor.
- Los permisos se verifican en servidor.
- Los audit logs no se actualizan ni eliminan desde la aplicación.
- Contraseñas y tokens nunca aparecen en respuestas, logs o fixtures.
- Rate limiting no permite bypass trivial por variar solo un campo de entrada.

## Paths permitidos

- `src/auth/`, `src/server/`, `src/domain/`, `app/api/`, `app/(auth)/`.
- `prisma/schema.prisma`, migraciones y tests relacionados.
- Configuración de Better Auth, seguridad, CI y documentación de la épica.

## Paths prohibidos

- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`.
- Catálogo, inventario, ventas, caja o pagos.
- Secretos reales, credenciales y archivos `.env`.
- Commits y push: quedan a cargo del orquestador después del gate.

## Gates

- `npm.cmd run db:generate`
- `npm.cmd run db:validate`
- `npm.cmd run db:migrate`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run test:coverage`
- `npm.cmd run build`
- `npm.cmd run test:e2e`
- `npm.cmd audit --audit-level=high`
- `git diff --check`

## Entregables

- Implementación mínima de Better Auth y autorización.
- Migración segura.
- Tests unitarios/integración/E2E de criterios.
- Informe persistente `.github/web-dev-loop/reports/epica-1-dev.md`.
- Sin commit ni push por parte del agente.
