# Brief — Fase 0: Fundación y decisiones

## Contexto

El proyecto está vacío salvo por la documentación de requisitos y la
configuración de Copilot. La meta es crear una base ejecutable para un POS/ERP
retail, sin implementar todavía ventas completas ni inventario operativo.

## Objetivo

Crear un scaffold reproducible con Next.js App Router, TypeScript strict,
Prisma/PostgreSQL, Zod, Vitest, Playwright, Docker y CI base; dejar contratos
iniciales de tenant, sucursal, caja, usuario, rol y auditoría.

## Criterios medibles

- Instalación limpia documentada desde cero.
- `typecheck`, `lint` y tests ejecutables con scripts explícitos.
- Migración Prisma reproducible contra una base vacía.
- Al menos un test por aislamiento de tenant y autorización server-side.
- Un smoke de Playwright que arranque y compruebe la ruta base.
- `git diff --check` limpio.
- Ningún secreto, `any` o gate simulado.

## Paths permitidos

- Todo el scaffold nuevo del proyecto.
- `package.json`, configuración de TypeScript/lint/test/build.
- `prisma/`, `src/`, `app/`, `tests/`, `docker-compose.yml`,
  `.github/workflows/`.
- Documentación directamente relacionada.

## Paths prohibidos

- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`.
- Cambios destructivos o borrado de documentación existente.
- Implementación de ventas, pagos, stock real u offline completo.
- Commits, pushes, resets o cambios en otros repositorios.

## Invariantes iniciales

- Todo acceso operativo debe quedar preparado para tenant isolation.
- Los permisos se validan en servidor.
- La auditoría es append-only a nivel de contrato.
- Los importes futuros usan Decimal/string, nunca float.
- Las migraciones son versionadas y no destructivas.

## Comandos esperados

El agente debe definir y documentar los comandos reales al crear el scaffold.
No debe afirmar gates verdes si no pudo ejecutar PostgreSQL, Playwright u otra
dependencia.

## Entregables

- Código y configuración del scaffold.
- Esquema Prisma inicial y migración.
- Tests y smoke mínimos.
- Informe con archivos, comandos ejecutados, números, limitaciones y estado
  `ENTREGADO:` o `BLOQUEADO:`.
