# Informe — Cierre de dependencias mínimas de Épica 2

Fecha: 2026-10-26. Brief: `../briefs/epica-2-closure.md`.

## Estado

ENTREGADO: implementados y verificados los cuatro pendientes del hardening:
sesión de caja mínima, step-up de supervisor, presupuesto monetario por turno
y alertas de antigüedad. Cierre técnico listo para aceptación del orquestador.
Sin commit ni push. No se declara implementada la Épica 3 completa.

## Autorización y decisiones

- El usuario pidió «continua» tras identificar esos cuatro bloqueos.
- Eligió expresamente «Configuración obligatoria»: moneda y tope de dinero se
  definen por tenant antes de abrir caja. Registrado como D-015 y agregado a
  DOMAIN_RULES. No se inventó moneda, país ni monto inicial.
- Defaults de cantidad aprobados conservados: 10 por línea, 30 por sesión y
  20 por variante/día, configurables. `XTS` y demás monedas/montos de pruebas
  son fixtures sintéticos, no configuración comercial del producto.

## Implementación

1. **Caja:** CashRegisterSession con tenant, caja, sucursal, cajero, moneda,
   timestamps UTC, cierre e índices únicos parciales de sesión abierta por
   caja y usuario. Cierre inmutable en DB. Actor/roles/sucursales se recomprueban
   en servidor; otra caja/tenant no se acepta como autoridad del cliente.
2. **Presupuesto real por turno:** la venta deriva la sesión abierta del actor
   en la sucursal de ubicación. Intakes conservan referencia a esa sesión,
   moneda y valor snapshot; presupuesto suma cantidades y valores de ese turno.
   Renovar login no lo reinicia; un turno nuevo legítimo sí tiene presupuesto
   independiente. Cambiar moneda con turnos incompatibles abiertos se deniega.
3. **Precio servidor:** selección efectiva por fecha/sucursal, con fallback
   global; precio declarado debe coincidir. Valores y totales usan HALF_UP a la
   precisión de moneda. Decimal financiero dedicado con precisión 48; columnas
   monetarias ampliadas a Decimal(22,4), sin reducir capacidad de enteros previa.
4. **Supervisor:** PIN scrypt N=32768/r=8/p=1, sal aleatoria, permisos propios;
   5 intentos fallidos bloquean 15 minutos, persistidos en PostgreSQL. La
   denegación se devuelve dentro de la transacción y se lanza después del commit,
   evitando que un rollback borre el contador. También se limita emisión a 10
   aprobaciones/minuto por solicitante.
5. **Aprobación:** token aleatorio de 256 bits; solo hash SHA-256 en DB; TTL 90 s.
   Atado a operación, comando completo, solicitante y sesión de caja; aprobador
   distinto, activo, con permiso y asignación de sucursal. Se revalida al consumir.
   Consumo condicional y venta en una transacción. Fallo de venta revierte el
   consumo; duplicado idempotente no repite el efecto. Audit incluye ambos
   actores y motivo, sin PIN, hash de PIN ni token.
6. **Alertas:** consulta derivada de pendientes con edad >N días, default 7,
   configurable; excluye resueltos y scopes ajenos. Devuelve volumen por cajero,
   separando monedas y valores legacy desconocidos.

## Evidencia antes del arreglo

- Venta sin caja y precio del llamador: 2/2 pruebas fallaron previamente;
  después pasan. Se conservaron como regresiones.
- Precisión monetaria alta: 1/1 falló por pérdida de milésimas y falso exceso
  de presupuesto; ahora pasa con FinancialDecimal48, sin mutar configuración
  global de decimal.js.
- Auditor read-only detectó rango de precio de catálogo de 18 enteros contra
  15 en venta/aprobación. Regresión falló por Zod antes del arreglo y luego pasó
  con precio de 16 enteros y reconciliación. Auditor revalidó el delta y cerró
  su único hallazgo nuevo. No ejecutó DB ni suites.
- Pruebas de aceptación de funciones nuevas (PIN, ciclo de caja, alertas) se
  agregaron junto a la implementación; no se afirma una ejecución previa en
  rojo independiente para cada función nueva.

## Gates del árbol final

Entorno: Windows/PowerShell, PostgreSQL 16 local descartable, roles runtime
separados y restringidos; base final `supermercado_closure_cert_gate` creada
vacía. No se usó ni leyó un .env real.

| Comando/gate | Resultado numérico |
|---|---|
| `npm.cmd run db:generate` sin URLs | exit 0; Prisma7.10.1; 823 ms. |
| `npm.cmd run db:validate` sin URLs | exit 0; 0 errores. |
| `npm.cmd run db:migrate` desde cero | exit 0; 12/12 migraciones aplicadas, sin reparación manual. |
| `npm.cmd run test:db:setup` | exit 0; 2 roles LOGIN verificados sin SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE. |
| `npm.cmd run typecheck` | exit 0; 0 errores. |
| `npm.cmd run lint` | exit 0; 0 errores/warnings. |
| `npm.cmd test -- --reporter=dot` sin conexiones | exit 0; 23 pasados, 88 omitidos; 7 suites pasadas, 11 omitidas; 21.99 s. No certifica integración. |
| `npm.cmd run test:coverage -- --reporter=dot` con PostgreSQL | exit 0; 111/111 tests, 18/18 suites, 0 omitidos; 116.65 s. Incluye la batería completa de test. |
| Cobertura global | líneas98.80%, ramas93.04%, statements96.96%, funciones98.49%. |
| Cobertura dominio | líneas100%, ramas98.63%; umbral ≥90% en ambas. |
| Concurrencia | 20/20 rondas ×20 ventas, saldos exactos y caseId compartido; además 20 aperturas simultáneas, cierre/replay y 20 usos paralelos de token. |
| `npm.cmd run test:ledger` después de integración y E2E | exit 0; 0 divergencias globales; RLS27/27 tablas con tenantId habilitado y forzado. |
| Aislamiento | 27/27 tablas con tenantId recorridas con fixtures presentes; 0 lecturas cruzadas, escrituras ajenas denegadas/sin efectos. Tenant raíz conserva su política adicional. |
| `npx.cmd prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | exit 0; 0 diferencias. |
| `npm.cmd run build` sin URLs ni secreto | exit 0; compilación4.1s, TypeScript15.2s, 6/6 páginas generadas. |
| `npm.cmd run test:e2e` | exit 0; 5/5 Chromium, 0 omitidos; 22.6 s. Autenticación, permisos, usuario nuevo y logout. |
| `npm.cmd audit --audit-level=high` | exit 0; 0 vulnerabilidades. |
| `git diff --check` | exit 0; 0 errores de whitespace; avisos LF/CRLF del entorno. |

La batería completa se ejecutó también antes del último delta: 106/106; el
resultado vigente es 111/111, posterior a las correcciones y nuevas negativas.

## Archivos creados

- `.github/web-dev-loop/briefs/epica-2-closure.md` y este informe.
- `prisma/migrations/20261026193000_cash_stepup_closure/migration.sql`.
- `src/domain/cash.ts`, `src/domain/approval.ts`.
- `src/server/cash.ts`, `src/server/supervisor.ts`.
- `src/server/repositories/cash.ts`, `src/server/repositories/approval.ts`.
- `tests/cash-domain.test.ts`.
- `tests/integration/closure-reproduction.test.ts`, `cash-closure.test.ts`,
  `supervisor-closure.test.ts`, `intake-alerts.test.ts`.

## Archivos modificados

- `prisma/schema.prisma`; `src/domain/actor.ts`, `inventory.ts`.
- `src/server/inventory.ts`; repositorios `inventory.ts`, `catalog.ts`.
- Fixtures y regresiones `tests/integration/fixtures.ts`,
  `epic2-concurrency.test.ts`, `inventory-hardening.test.ts`,
  `catalog-regressions.test.ts`, `rls-boundaries.test.ts`.
- `DECISIONS.md`, `DOMAIN_RULES.md` (D-015), `ARCHITECTURE.md`, `ROADMAP.md`,
  `docs/inventory-gates.md`, informes previos con enlace al resultado vigente.
- `next-env.d.ts` es regenerado por Next al alternar dev/build y ya tenía
  cambios antes de estas olas. No se revirtió trabajo previo.

No se editaron migraciones aplicadas, reusable, credenciales reales ni configuración Git.

## No ejecutado / límites

- CI remoto y despliegue no ejecutados; pruebas locales, sin commit/push.
- No se creó un clon limpio ni se repitió npm ci: el entorno sin variables y
  las migraciones de base vacía sí se verificaron.
- Nuevas capacidades son servicios internos. Los E2E prueban las rutas ya
  expuestas; los flujos nuevos se verifican con integración real PostgreSQL.
- Alertas son derivadas al consultar; correo/push/scheduler no son parte del brief.
- No se certifica aún capacidad de carga de supermercado ni backend completo
  de pagos, arqueos, numeración o fiscalidad. El advisory lock por tenant sigue
  siendo conservador; el presupuesto ya no es acumulado por usuario de por vida.

## SUPUESTO y decisiones restantes

- SUPUESTO técnico conservador: una sola sesión abierta por cajero y caja;
  un supervisor autorizado puede cerrar una sesión ajena de su sucursal,
  registrando al cajero y al cerrador.
- SUPUESTO técnico: TTL90s, bloqueo tras5 fallos durante15min y límite10/minuto.
  Respetan DOMAIN_RULES y están explícitos, sin datos monetarios inventados.
- No se asigna sesión/moneda retroactiva a ventas o casos legacy; se conservan
  campos nuevos opcionales y errores controlados si falta contexto necesario.
- D-006/D-007/D-009 siguen siendo prerrequisitos del backend completo de Épica3:
  entidad fiscal, redondeo ratificado y país/tributación/facturación. No se
  tomó una decisión fiscal ni comercial implícita para avanzar este mínimo.

## Key Learnings:

1. Lanzar una excepción antes del commit elimina también intentos y lockouts:
   las denegaciones de PIN deben persistirse antes de elevar el error.
2. Decimal sin precisión interna suficiente puede perder milésimas. Ampliar
   la escala SQL requiere alinear precisión aritmética y rango de contratos.
