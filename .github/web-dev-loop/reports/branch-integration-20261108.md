# Informe — Integración de ramas a `main` (2026-11-08)

**Fecha:** `2026-11-08` · **Base:** `origin/main` `b94384f` · **Árbol final:** limpio en la rama `docs/integration-20261108`

## Resultado

`ENTREGADO:` todas las ramas con trabajo pendiente quedaron integradas en `main` mediante PR con CI verde. El remoto quedó con una sola rama de integración (`main`). No se modificó dominio, API ni persistencia fuera de lo ya mergeado.

## Integración

| Rama | Contenido | PR | Merge commit | CI |
|---|---|---|---|---|
| `feat/pos-auth-register-location` | Auth de POS, ubicación de caja, snapshot en turno, selector de caja | #18 | `693ec3f` | run [42461874326](https://github.com/bialyLT/app-supermercado/actions/runs/42461874326) pass |
| `feat/admin-pos-visual-system` | Sistema visual compartido, shell con rail/drawer, POS y compras migrados, merge de `main` | #19 | `30b6a64` | runs [42464926548](https://github.com/bialyLT/app-supermercado/actions/runs/42464926548) y [42464930036](https://github.com/bialyLT/app-supermercado/actions/runs/42464930036) pass |
| `backup/wsl-docs-20261108` | Informes de consolidación WSL, `handoffs.json`, rescate documentado | #20 | `b94384f` | runs [42465415443](https://github.com/bialyLT/app-supermercado/actions/runs/42465415443) y [42465429911](https://github.com/bialyLT/app-supermercado/actions/runs/42465429911) pass |
| `backup/wsl-epic7-visual-system` | Instantánea de los 10 commits rescatados | — | contenido en `main` vía #19 (`a4d85a1` es ancestro) | CI rojo histórico; rama eliminada tras verificar ancestría |

## Gates del merge visual (run 42464926548)

| Gate | Resultado |
|---|---|
| `npm test` | **70** archivos, **435/435** tests, 70.55 s |
| `npm run test:coverage` | statements **88.38 %**, branches **81.55 %**, functions **87.47 %**, lines **92.48 %** |
| `npm run test:e2e` | **59/59**, 1.4 min |
| `db:generate`, `db:validate`, `db:migrate`, `test:db:setup` | exit **0** |
| `typecheck`, `lint`, `test:ledger`, `build` | exit **0** |

## Resolución del merge `main` → sistema visual

| Archivo | Resolución |
|---|---|
| `app/pos/layout.tsx` | Exige sesión de servidor (`redirect("/")`) y envuelve el POS en `AdminShell` modo rail |
| `app/pos/page.tsx` | Layout visual + contadores de cola offline, reintento y evento de sesión vencida de `main` |
| `app/pos/pos.module.css` | Estilos del sistema visual; foco con `outline` tokenizado en lugar de `outline: none` |
| `components/admin-shell.tsx` | Shell visual + banner de sesión vencida |
| `components/admin-navigation.ts` | `group` e `icon` para los ítems nuevos; iconos nuevos `inventory`, `alerts`, `sales` |
| `components/admin-navigation.test.ts` | Expectativas de rutas por rol actualizadas al conjunto fusionado (18 ítems) |

## Ajustes de contrato E2E

| Commit | Ajuste | Motivo |
|---|---|---|
| `c7b5a7a` | Copy del POS a `Atajos:` | `main` ya validaba ese texto; el layout visual decía `Keyboard-first` |
| `ab80169` | Estado de conexión dentro del `role="status"` de la cola | Evita dos regiones `status` y conserva el contrato de `main` |
| `8d21ad7` | `Agregar (F4)` en variante secundaria; primario `#0369a1`; foco con `outline: 2px` | Coincide con el sistema visual aprobado (AA 5.93:1) y con el foco accesible global |

Ningún ajuste eliminó aserciones: se mantienen visibilidad, tamaño táctil de 44 px, foco de 2 px y estado deshabilitado.

## Límites y residuos

- El build y el E2E no se ejecutaron localmente: el worktree usa un junction de `node_modules` y Turbopack rechaza compilar fuera del workspace. La evidencia es el CI remoto.
- La consolidación del workspace WSL sigue pendiente: el worktree del PR está en `~/workspaces/.operational-ui-move` y `supermercado-archive` conserva el `.git` común de los worktrees.
- El checkout de Windows sigue en `feat/operational-ui-completeness` con 15 rutas sucias que duplican contenido ya mergeado del PR #13; no se tocó en esta intervención.
- No se creó despliegue.

## Desvíos y supuestos

- `AGENTS.md` reserva commit, push y merge al orquestador; el dueño autorizó explícitamente la integración de todas las ramas.
- `SUPUESTO:` los ajustes de E2E reflejan el contrato visual aprobado y no debilitan la verificación; se documentan commit por commit.
- `SUPUESTO:` la rama de respaldo puede eliminarse porque `a4d85a1` quedó como ancestro de `main` y ningún commit se pierde.

## Próximo paso

- Decidir el siguiente corte: Ola 2 de remediación frontend (estados y errores) o Épica 6 (escala, reportes y despliegue).
- Limpiar el checkout de Windows y completar la consolidación de worktrees en WSL.
