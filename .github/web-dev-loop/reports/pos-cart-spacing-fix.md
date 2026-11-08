# Informe — Regresión de espaciado en el carrito del POS

**Fecha:** `2026-11-08` · **Base:** `a4d85a1` (rama `feat/admin-pos-visual-system`) · **Árbol final:** limpio en `2932962`

## Resultado

`ENTREGADO:` se corrigió la regresión que quitaba el espacio entre la etiqueta y la cantidad en cada línea del carrito, detectada por CI al publicar el rescate de WSL. El CI del commit correctivo pasó todas sus etapas. No se modificó dominio, API, schema ni migraciones.

## Causa raíz

La migración al sistema visual cambió el markup del carrito de un nodo de texto único a dos `span` hermanos dentro de un contenedor flex:

- Antes: `<li>{line.label} × {line.quantity}</li>` → texto `uuid × 1`.
- Después: `<li><span>{line.label}</span><span>× {line.quantity}</span></li>` → texto `uuid× 1`.

El `gap: 12px` de `.line` mantiene la separación visual, pero el `textContent` perdió el espacio. Los E2E de `tests/e2e/pos.spec.ts` verifican el texto accesible, por eso fallaron.

## Gates con números reales

| Gate | Comando / evidencia | Resultado |
|---|---|---|
| RED (remoto) | CI run [42458938288](https://github.com/bialyLT/app-supermercado/actions/runs/42458938288), rama `backup/wsl-epic7-visual-system` | typecheck, lint, tests, cobertura, ledger y build **ok**; E2E **34 passed / 2 failed** |
| Diagnóstico | Log de E2E del run 42458938288 | esperado `...174000 × 1`, recibido `...174000× 1` en `pos.spec.ts:103` y `:158` |
| Cambio | `app/pos/page.tsx:293` | **1** inserción / **1** eliminación: `{" "}` entre etiqueta y cantidad |
| Typecheck local | `npm run typecheck` | exit **0** |
| Lint local | `npm run lint` | exit **0**, sin salida |
| Test focalizado local | `vitest run tests/pos-shell.test.ts` | pasa |
| Test focalizado local | `vitest run tests/css-module-classes.test.ts` | **falla en Windows** por separadores de ruta (preexistente, ver WIN-TEST-01); en Linux CI pasa |
| Higiene de diff | `git diff --check HEAD~1 HEAD` | exit **0** |
| CI del fix | run [42459931121](https://github.com/bialyLT/app-supermercado/actions/runs/42459931121), commit `2932962` | todas las etapas **success** |
| Tests (CI) | `npm run test` | **58** archivos, **366/366** tests, 46.77 s |
| Cobertura (CI) | `npm run test:coverage` | statements **89.17 %**, branches **82.86 %**, functions **88.21 %**, lines **93.33 %** |
| E2E (CI) | `npm run test:e2e` | **36/36 passed**, 44.2 s (antes **34/36**) |
| Ledger / RLS (CI) | `npm run test:ledger` | exit **0** |
| Build (CI) | `npm run build` | exit **0** |
| Migraciones (CI) | `db:generate`, `db:validate`, `db:migrate`, `test:db:setup` | exit **0** |

## Findings o cambios

| ID | Severidad | Ubicación | Evidencia | Estado |
|---|---|---|---|---|
| POS-VIS-01 | Alta | `app/pos/page.tsx:293` | E2E 34/36 en run 42458938288; texto sin espacio entre etiqueta y cantidad | Arreglado; 36/36 en run 42459931121 |
| WIN-TEST-01 | Baja | `tests/css-module-classes.test.ts:41,58` | `relative()` devuelve `\` en Windows y la allowlist usa `/`; 4 falsos positivos | Abierto, preexistente, ajeno a este cambio (CI Linux verde) |

## Límites, residuos y próximo paso

- El E2E no se ejecutó localmente: `tests/e2e/pos.spec.ts` requiere `TEST_DATABASE_URL` y las runtime roles de la base de gate; en el entorno Windows no están provisionadas. La verificación E2E es la del CI remoto.
- No se ejecutó la suite completa local en Windows por la misma razón y por el fallo preexistente WIN-TEST-01.
- La rama `feat/admin-pos-visual-system` contiene los 10 commits rescatados de WSL más este fix; está **34 commits atrás** de `main` y requiere rebase antes de un PR.
- `backup/wsl-epic7-visual-system` se conserva como instantánea exacta del rescate (`a4d85a1`) y su CI queda rojo a propósito: no es rama de integración.
- No se creó PR, merge ni despliegue.
- Próximo paso: decidir si se rebasea `feat/admin-pos-visual-system` sobre `main` y se abre PR, o si el sistema visual se descarta por reemplazado.

## Desvíos y supuestos

- `AGENTS.md` reserva commit y push al orquestador; el dueño autorizó el rescate y la corrección.
- `SUPUESTO:` el nodo de texto con solo un espacio entre dos `span` no se renderiza como ítem flex anónimo (spec de flexbox), por lo que el `gap` visual no cambia y solo se restituye el espacio en `textContent`.
- `SUPUESTO:` la expectativa de los E2E (`uuid × 1`) representa el texto que debe leer un lector de pantalla; se corrigió el producto, no la prueba.
