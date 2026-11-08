# Selector de caja para abrir turnos — T8 / S8

ENTREGADO: el ingreso manual de UUID fue reemplazado por un selector nativo accesible, con opciones obtenidas desde identidad autenticada y alcance persistido. E2E, suite completa, cobertura, ledger y build post-T8 pasaron; diff-check pasó. Next3000 fue restaurado y responde HTTP200; la base demo no fue modificada.

## Alcance implementado

- `components/cash-shifts/cash-shifts-manager.tsx`: selector accesible con nombre de caja y sucursal; agrega ubicación configurada a la etiqueta cuando existe; UUID solo como valor interno. Incluye estados de carga, vacío, error y reintento.
- `components/cash-shifts/cash-shifts-manager.module.css`: estilos para estados, reintento y foco visible.
- `app/api/admin/cash-shifts/route.ts`: nuevo `GET` de opciones. El `POST` existente y sus acciones permanecen sin cambios.
- `src/server/cash.ts`, `src/server/repositories/cash.ts`: consulta autenticada `cash.session.open`, limitada al tenant y sucursales persistidas; sin fallback tenant-wide ni filtro por disponibilidad.
- `tests/cash-shifts-ui.test.ts`, `tests/integration/cash-shifts-options.test.ts`, `tests/e2e/cash-shifts.spec.ts`: contrato UI, aislamiento de opciones y apertura con `registerId` interno.
- `docs/cash-shifts.md`: contrato, alcance y límites documentados.

No se modificaron esquema, migraciones, dependencias ni datos demo. Toda escritura de pruebas ocurrió en `supermercado_pos_t4_20261104_gate` con identidades sintéticas.

## RED / GREEN / preservación y verificación final

| Comando / evidencia | Resultado numérico |
| --- | --- |
| RED `npm test -- tests/cash-shifts-ui.test.ts` | Exit 1: 1 fallado / 2; input anterior todavía requería UUID |
| RED `npm test -- tests/integration/cash-shifts-options.test.ts` | Exit 1: 2 fallados / 2; consulta de opciones aún no implementada |
| Primera ejecución conjunta posterior a implementación | Exit 1: 1 UI assertion fallida por incluir otro input requerido; se acotó la aserción |
| Foco inicial UI/opciones | Exit 0: 5/5 tests, 2/2 archivos, 2.31 s |
| Preservación cash closure/location | Exit 0: 21/21 tests, 2/2 archivos, 14.64 s |
| Foco inicial final | Exit 0: 26/26 tests, 4/4 archivos, 13.44 s |
| Regresión: rama del mismo tenant sin autorización | Exit 0: 2/2 tests en `cash-shifts-options.test.ts`, 2.86 s |
| E2E primer intento | Exit 1: T4 ubicación 2/2; el test T8 usó CASHIER y el `AdminShell` existente bloqueó `/admin` antes de renderizar el selector. No se modificó el límite de rol. |
| E2E corregido, usando SUPERVISOR autorizado | Exit 0: 3/3 en27.1s (selector1, ubicación/snapshot2). Verifica etiqueta legible, UUID interno en POST y apertura exitosa. |
| E2E final post-loader-refactor: selector+retry y ubicaciones | Exit 0: 4/4 en30.8s (T4 location/snapshot2; T8 apertura/retry2) |
| Foco UI/integración post-loader-refactor | Exit0: 13/13 tests,3 archivos,8.87s |
| Suite completa final `npm test` | Exit0: 68/68 archivos,425/425 tests,139.39s |
| Revisión estática independiente final | PASS,0 blockers para T4/T8; el verifier no reejecutó tests/build/typecheck/lint; comprobó los logs del orquestador |
| Final `npm run typecheck` | Exit0,10s |
| Final `npm run lint` | Exit0,19s;0 errores,1 warning de `sessionA` sin usar en `.cache/demo/seed-template.ts` |
| Final Gentle ASSESS | High/item2, nativeRisk unassessable por paths untracked no declarados; plan indicó verifier independiente, que pasó. No se retornó reviewDue/continuation; no se inició native review |
| `npm run test:coverage` | Exit 0: statements88.38%, branches81.55%, functions87.47%, lines92.48% |
| `npm run test:ledger` | Exit 0: 0 divergences; RLS activa/forzada en43/43 tablas |
| `npm run build` post-loader-refactor | Exit0,20s; producción compiló y generó28 páginas estáticas |
| `git diff --check` | Exit0: tracked diff limpio;14 archivos de texto no rastreados revisados, `.cache/` excluido |

Vitest emitió la advertencia conocida sobre el loader de config y dos advertencias deprecadas de `pg`; la suite final no tuvo fallos. Next demo se restauró con `npm run dev`; el sondeo local respondió HTTP200 en1s. No se ejecutó setup ni se escribió en la base demo.

## No ejecutado / decisiones pendientes

- Typecheck y lint finales pasaron después del refactor y la prueba de retry. El único warning es del archivo generado bajo `.cache/`; no se modificó.
- ASSESS final fue high/nativeRisk unassessable por selección de untracked no declarada. Su plan requería verifier independiente, que pasó sin blockers; no se devolvió reviewDue/continuation y no se inició un native review. No se reclama recibo nativo.
- Next demo3000 se restauró tras el build final y respondió HTTP200 en1s; la base demo permanece intacta.
- No se configuraron asignaciones ni se cerró/abrió un turno en la base demo. El turno demo existente conserva `locationId = NULL`.

## SUPUESTO, límites y riesgo

SUPUESTO: la descripción opcional de ubicación agrega código/nombre ya configurados; no agrega un selector de ubicación ni una alternativa para cajas sin asignación.

La lista mantiene cajas sin ubicación o con turno activo; las validaciones de apertura existentes siguen siendo autoritativas. CASHIER conserva su restricción existente de no entrar a `/admin`; el E2E verifica el selector como SUPERVISOR, sin conceder permisos nuevos.

Risk: item 2 (los identificadores y opciones dependen del alcance autorizado); cubierto por la consulta autenticada/branch-scoped, la prueba negativa de rama, la revisión independiente y los E2E.
