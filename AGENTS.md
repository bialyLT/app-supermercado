# AGENTS.md — Punto de entrada obligatorio

Todo agente (Copilot, Claude, Codex u otro) lee este archivo **primero, en cada
sesión**, antes de planificar o tocar código.

## 1. Orden de lectura

1. `AGENTS.md` (este archivo)
2. `DOMAIN_RULES.md` — reglas de dominio que no se negocian
3. `DECISIONS.md` — qué está decidido, qué es propuesta y qué está pendiente
4. `GATES.md` — cómo se verifica y cómo se reporta
5. `ARCHITECTURE.md` y `ROADMAP.md` — forma del sistema y estado actual
6. El brief de la épica activa (y su addendum, si existe)

Solo bajo demanda y **nunca como fuente de verdad**:
`MASTER_PLAN.md` (histórico), `REUSABLE_RETAIL_SYSTEM_CONTEXT.md` (referencia
de otro proyecto: Supabase/RLS/delivery no aplican salvo lo que `DECISIONS.md`
adopte), `iniciar-proyecto.md` (origen de requisitos).

## 2. Precedencia ante contradicciones

`DOMAIN_RULES.md` > `DECISIONS.md` (aprobadas) > `ARCHITECTURE.md` >
brief/addendum de la épica > `ROADMAP.md` > `MASTER_PLAN.md` > reusable.

Un brief **no puede debilitar** `DOMAIN_RULES.md`. Si dos documentos del mismo
nivel se contradicen, no elijas en silencio: detené el trabajo afectado,
reportá `BLOQUEADO:` con la contradicción citada y seguí con lo no afectado.

## 3. Alcance del producto

Es un POS/ERP para kiosco con arquitectura que escala a supermercado.
**Fuera de alcance hasta decisión explícita en `DECISIONS.md`:** e-commerce,
delivery, picking/packing, fidelización, marketplaces, microservicios.

## 4. Reglas de trabajo

- Un solo escritor por ola. Los testers son read-only salvo que se indique.
- No se implementa nada sin brief, criterios medibles y OK.
- Sin commit ni push: los hace el orquestador tras el gate.
- Si falta una decisión de negocio, **no la inventes**: marcá `SUPUESTO:` en
  el informe, elegí la opción más conservadora y reversible, y listala en
  "Decisiones requeridas".
- Bug encontrado: primero una prueba que falle, después el arreglo, luego se
  re-ejecutan las baterías afectadas.
- Cambios de esquema: solo migraciones nuevas y no destructivas. Nunca editar
  una migración ya aplicada.
- Nada de secretos, `.env` reales, ni datos personales en fixtures o logs.
- No tocar `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`.

## 5. Prohibido en código

`any`, `as unknown as`, `@ts-ignore`/`eslint-disable` sin comentario que lo
justifique, `number`/`float` para dinero o cantidades, `Date.now()` o
`new Date()` dentro del dominio (inyectar reloj), consultas Prisma fuera de la
capa de repositorio, confiar en `tenantId`/`branchId`/totales del cliente.

## 6. Informe obligatorio de cada ola

Archivo en `.github/web-dev-loop/reports/` con:

- Estado: `ENTREGADO:` o `BLOQUEADO:` + una línea de motivo.
- Archivos creados/modificados.
- Comandos ejecutados con **resultado numérico** (tests pasados/fallados,
  cobertura, tiempos). Sin número no hay gate verde.
- Qué no se pudo ejecutar y por qué.
- Desvíos respecto del brief.
- `SUPUESTO:` asumidos y decisiones requeridas al dueño del producto.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
