# Informe — Rescate de trabajo único del workspace WSL

**Fecha:** `2026-11-08` · **Base:** `origin/main` `0d10140` · **Árbol final:** checkout de Windows sin cambios; rescate publicado en dos ramas de `origin`

## Resultado

`ENTREGADO:` se auditó el workspace WSL (`/home/bialylt/workspaces/supermercado`, ext4), se confirmó que 10 commits y 7 archivos no existían en ningún remoto, y se respaldaron en `origin` en dos ramas. No se modificó código de producto, schema, migraciones ni datos.

## Contexto

El checkout de Windows (`C:\Users\Usuario\Documents\trabajos\supermercado`, sobre `/mnt/c`, 9p) y el workspace WSL (`~/workspaces/supermercado`, ext4) son checkouts distintos del mismo repositorio, no el mismo directorio:

| Evidencia | Windows | WSL |
|---|---|---|
| Filesystem / dispositivo | `/mnt/c` (9p), `69:7318349394511892` | ext4 (`/dev/sdd`), `2096:90353` |
| `.git` | repositorio propio | worktree de `~/workspaces/supermercado-archive/.git` |
| `md5(package.json)` | `d403c6029e91c0b33063fa9c7c8ad1ce` | `c6d7b28b3a2ec89b079c46ca5acaa6eb` |

El único path de WSL que apunta a este checkout de Windows es `/mnt/c/Users/Usuario/Documents/trabajos/supermercado`.

## Gates con números reales

| Verificación | Comando | Resultado |
|---|---|---|
| Unicidad por contenido | `git -C ~/workspaces/supermercado cherry -v origin/main HEAD` | **10/10** commits con `+` (ninguno aplicado en `main` por patch-id) |
| Presencia en GitHub | `gh api repos/bialyLT/app-supermercado/commits/a4d85a1` | HTTP **422**, `No commit found for SHA` |
| Ramas remotas existentes | `gh api repos/bialyLT/app-supermercado/branches` | **2**: `main` y `feat/pos-auth-register-location` |
| Bundle de rescate | `git bundle create` + `git bundle verify` | **59 KB**, sha256 `df9559264ca4a80a6783ef1cd6d42abdd43b2e182be95c830b2fc2e8d62b457d`, `ok`; prerequisito `a4f76a1` presente en Windows |
| Importación del bundle | `git fetch <bundle> HEAD:refs/heads/backup/wsl-epic7-visual-system` | **1** ref nueva; `rev-list --count origin/main..rama` = **10** |
| Push rama A | `git push -u origin backup/wsl-epic7-visual-system` | exit **0**; `git ls-remote` devuelve `a4d85a1` |
| Documentación única del worktree `main` | `git diff --stat` | **4** archivos, **+35/−13** |
| Archivos sin versionar rescatados | `ls -l` | **3** archivos: 3603 B + 2956 B + 685 B |
| Patch aplicado sobre `origin/main` | `git apply` | **4** archivos, sin conflictos |
| Push rama B | `git push -u origin backup/wsl-docs-20261108` | exit **0**; `git ls-remote` devuelve el mismo SHA que el commit de este informe |
| Higiene de diff | `git diff --check` | exit **0**, sin salida |
| Tests / typecheck / lint / build / E2E | — | `NO EJECUTADO`: no se modificó código en esta intervención |
| PostgreSQL / ledger / RLS / concurrencia | — | `NO EJECUTADO`: sin cambios de persistencia |

## Findings o cambios

| ID | Severidad | Ubicación | Evidencia | Estado |
|---|---|---|---|---|
| WSL-UNIQUE-01 | Alta | rama `feat/epic7-operations-ui` @ `a4d85a1` | 10 commits, 35 archivos, **+4413/−598**; ninguno aplicado en `main` ni presente en GitHub | Rescatado en `backup/wsl-epic7-visual-system` |
| WSL-UNIQUE-02 | Media | 4 documentos del worktree `main` | **+35/−13** no presentes en `origin/main` (cierre de Épica 7 y reparación de cobertura) | Rescatado en `backup/wsl-docs-20261108` |
| WSL-UNIQUE-03 | Baja | 3 archivos sin versionar | informe y task de consolidación WSL + `design/admin-experience/handoffs.json` | Rescatado en `backup/wsl-docs-20261108` |
| WSL-NOISE-01 | Baja | `supermercado-archive` | 60 archivos, **+12026/−12010** con patrón de fin de línea (`.gitignore` idéntico salvo CRLF) | No rescatado: ruido de line endings |
| WSL-STATE-01 | Media | worktrees WSL | consolidación bloqueada; worktree del PR en `~/workspaces/.operational-ui-move`; `supermercado-archive` contiene el `.git` común | Abierto |

### Contenido de la rama A (`backup/wsl-epic7-visual-system`)

`a4d85a1` revert del submit del login · `bbb5280` fix del submit del login · `4cf6e09` cajero dentro del shell con rail colapsable · `94db9fd` fix de clases/skeleton de compras · `b311716` cierre documental del sistema visual · `8c65e18` compras sobre primitives y tokens · `59275fb` POS con sistema visual · `7a866a6` sidebar agrupado y drawer de tablet · `a238d53` tokens y primitives accesibles · `759b3e1` sincronización del sistema de diseño.

Incluye `components/ui/` (button, alert, tabs, page-header, nav-icons), `design/system.md`, `design/admin-experience/` y los tests `pos-shell`, `css-module-classes`, `purchases-ui` y `admin-navigation`.

## Límites, residuos y próximo paso

- Los commits rescatados **no pasaron gates de calidad en este informe**. `handoffs.json` declara «206 tests unitarios pasando, typecheck 0, build exitoso» (2026-11-06), pero no se adjuntó log ni se re-ejecutó.
- WSL no resuelve DNS (`ssh: Could not resolve hostname github.com`), por eso el push se hizo desde Windows vía bundle.
- La rama A está **10 adelante / 34 atrás** de `origin/main`: requiere rebase antes de integrarse.
- No se creó PR, merge ni despliegue.
- El bundle quedó en `C:\Users\Usuario\AppData\Local\Temp\opencode\wsl-unique-commits.bundle`; las ramas de `origin` son el respaldo durable.
- El checkout de Windows conserva 15 rutas sucias que duplican el contenido ya mergeado del PR #13; no se tocó.
- Próximo paso: decidir si el sistema visual se integra (rebase + gates) o se descarta, y luego completar la consolidación de worktrees en WSL.

## Desvíos y supuestos

- `AGENTS.md` reserva commit y push al orquestador; el dueño del producto autorizó explícitamente este rescate.
- `SUPUESTO:` los 10 commits son trabajo único y no una versión previa ya reemplazada. La comparación por patch-id prueba unicidad de contenido, no autoría ni vigencia funcional.
- `SUPUESTO:` el diff masivo de `supermercado-archive` es ruido de fin de línea (misma cantidad de altas y bajas, sin cambios semánticos).
- Decisión requerida: para integrar la rama A, ¿rebase y PR, o se descarta por considerarse reemplazada? Esta intervención no la decide.
