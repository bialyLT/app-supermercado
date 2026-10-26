# Informe de desarrollo — Épica 1

## Entregado

- Integración de Better Auth 1.7.13 con `@better-auth/prisma-adapter` 1.7.13 y Prisma 7.10.1.
- Sesiones server-side con cookies HttpOnly, SameSite Strict y Secure en producción.
- Login/logout, endpoint de identidad (`/api/me`) y registro administrativo de usuarios.
- Resolución de tenant desde la sesión; los endpoints sensibles rechazan `tenantId` enviado por el cliente.
- RBAC por tenant y branch para `CASHIER`, `SUPERVISOR`, `STOCK_MANAGER` y `ADMIN`.
- Auditoría append-only para login, logout, altas de usuario, cambios sensibles y denegaciones implícitas por endpoint.
- Rate limiting por IP para login, logout y endpoints sensibles.
- Headers de seguridad básicos y CSP.
- Tablas Better Auth (`Account`, `Session`, `Verification`) y asignación tenant/branch (`UserBranch`).
- Trigger PostgreSQL que impide UPDATE/DELETE sobre `AuditLog`.
- Tests unitarios, integración de FKs cross-tenant y E2E positivos/negativos.

No se tocaron catálogo, inventario, ventas, caja ni pagos. `REUSABLE_RETAIL_SYSTEM_CONTEXT.md` no fue modificado. No se hizo commit ni push.

## Decisiones

1. Se mantuvo `User` como entidad Better Auth y de negocio para conservar las FKs compuestas existentes.
2. El alta pública está deshabilitada. El alta mínima se realiza por un administrador autenticado, deriva el tenant de la sesión y nunca acepta tenant del body.
3. La contraseña se almacena únicamente en el `Account` de Better Auth mediante `hashPassword`; no se devuelve ni se registra.
4. El rate limiter es memoria local. Es seguro contra bypass por variar campos de entrada, pero debe migrarse a un store compartido antes de escalar horizontalmente.
5. OAuth, 2FA y recuperación de cuenta quedan fuera de alcance, como indica el brief.

## Comandos y resultados

Todos se ejecutaron sobre `main` actual, con PostgreSQL local de Docker y variables de entorno efímeras (sin crear `.env`):

| Gate | Resultado |
|---|---|
| `npm.cmd run db:generate` | PASS — Prisma Client 7.10.1 generado |
| `npm.cmd run db:validate` | PASS — schema válido |
| `npm.cmd run db:migrate` | PASS — 3 migraciones, 0 pendientes al repetir |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd test` | PASS — 3 archivos, 12 tests |
| `npm.cmd run test:coverage` | PASS — 100% statements/branches/functions/lines sobre 2 archivos cubiertos |
| `npm.cmd run build` | PASS — build Next.js 16.4.3 |
| `npm.cmd run test:e2e` | PASS — 3 tests Chromium |
| `npm.cmd audit --audit-level=high` | PASS — 0 vulnerabilidades |
| `git diff --check` | PASS |

El warning de Vitest sobre `configLoader: native` es informativo y no altera el resultado.

## Riesgos y próximos pasos

- El rate limiting en memoria no comparte estado entre réplicas; usar Redis o equivalente antes de producción.
- La CSP mínima deberá ajustarse cuando se incorporen assets, fuentes o superficies UI adicionales.
- La auditoría de intentos inválidos de login no puede asociar actor/tenant antes de autenticar; el endpoint queda limitado y Better Auth no expone secretos. Conviene agregar un evento anónimo con IP truncada en la siguiente iteración.
- Las migraciones usan `User.email` globalmente único para que el login sea determinista; si el producto requiere el mismo correo en tenants distintos, habrá que introducir un identificador de login explícito sin debilitar el aislamiento.
