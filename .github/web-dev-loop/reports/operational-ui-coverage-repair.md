# Informe — Reparación de cobertura operativa

Estado: ENTREGADO: reparación mergeada en PR #13; CI de push y PR pasaron para `b801fb6`. No hubo cambios de producto ni despliegue.

## Alcance y archivos

Rama: `feat/operational-ui-completeness`; commit `b801fb6`; PR #13 hacia `main`, mergeado el 2026-11-03 en `8d55d55`.
Worktree usado: `/home/bialylt/workspaces/.operational-ui-move`.
El original Windows permanece intacto.

- `tests/integration/operational-read.test.ts`: pruebas públicas de lecturas operativas, validación y aislamiento; corregidos filtro temporal fijo y actor sin permiso de ventas.
- `tests/integration/intake-alerts.test.ts`: cobertura de recibos y consultas de intakes.
- `odd/tasks/operational-ui-ci-repair.md`: continuidad y evidencia.
- Este informe. Sin cambios de producción, umbrales ni exclusiones de cobertura.
- Se restauró únicamente el cambio generado por Next en `next-env.d.ts` a su estado previo.

## Resultados observados

| Comando / comprobación | Resultado |
| --- | --- |
| CI anterior 41542053076 | 397/397 tests; cobertura falló: funciones 78.58%, ramas 78.30% |
| npm ci | exit 0; 548 paquetes; audit reportó 16 vulnerabilidades moderadas |
| db:generate / db:validate | exit 0 ambos |
| db:migrate sobre DB nueva | exit 0; todas las migraciones aplicadas |
| test:db:setup | exit 0; 2 roles sin superuser/BYPASSRLS/CREATEDB/CREATEROLE |
| Integración focalizada RED | 3 pasados / 2 fallados, 4.23 s |
| Integración focalizada GREEN | 5/5, 4.02 s |
| test:coverage | exit 0; 64/64 archivos, 400/400 tests, 166.18 s |
| Cobertura global | statements 88.74%, branches 82.06%, functions 88.43%, lines 92.85% |
| Cobertura dominio | statements 97.41%, branches 92.64%, functions 97.22%, lines 98% |
| test:ledger | exit 0; 0 divergencias; RLS 43/43 tablas |
| build | exit 0; 60 s |
| test:e2e (4 workers) | exit 1; 28 pasados / 8 fallados, 4 min |
| Diagnóstico E2E serial | exit 0; 3/3, 39 s |
| test:e2e -- --workers=1 | exit 0; 36/36, 2.1 min |
| CI push 41569627210 | success; typecheck, lint, tests, coverage, ledger, build, Playwright y cleanup de containers completados |
| CI PR 41569632852 | success para `b801fb638f56303790bb398c8dfad3147bbf8d26` |
| PR #13 | MERGED; merge commit `8d55d553df8551107026f243e2bcc48ac6e78aac` |
| typecheck / lint independientes | intento inicial: timeout 30 s cada uno; repetición secuencial autorizada: exit 0 ambos, 46 s combinados, límite 300 s por comando |
| git diff --check | exit 0 antes del cierre documental |

## Límites de evidencia

La ejecución local E2E con cuatro workers falló 8/36; serial pasó 36/36. La causa de las fallas paralelas no se estableció y no se cambió la configuración de Playwright. El CI remoto posterior sí pasó el job E2E con su configuración normal.
Un intento inicial de cobertura antes de configurar DB agotó 30 s; no aporta evidencia válida del gate completo.
Un typecheck prematuro falló con exit 127 (tsc no disponible antes de npm ci).
No se ejecutó un gate independiente nuevo de auditoría ni de concurrencia repetida.
La revisión nativa no se pudo evaluar: `gentle-ai review mode status` terminó en 127, comando no disponible. No se creó ni modificó ninguna lineage.

## Baja del entorno temporal

PostgreSQL 18 se extrajo en la caché ignorada del worktree sin instalación de sistema.
Se usó exclusivamente una DB nueva `supermercado_gate` en loopback:55449 con roles separados.
Se detuvo con pg_ctl (exit 0) y se eliminaron datos, binarios y paquetes temporales.
Las conexiones a 55449 (DB) y 3109 (web E2E) devolvieron ECONNREFUSED.
Se preservaron dependencias npm instaladas, artefactos de tests y el .env local ignorado; no son servicios activos.

## Cierre posterior

El dueño pidió sincronizar `main` y cerrar la documentación tras indicar que todo estaba mergeado. Se verificó PR #13 (`MERGED`, `mergedAt` 2026-11-03T03:10:30Z), `origin/main` en `8d55d55`, y que `b801fb6` es ancestro de `main`. Los runs de push y PR fueron exitosos. No se hizo merge adicional, nuevo PR ni despliegue.

La revisión nativa no se ejecutó: el comando local `gentle-ai` no estaba disponible y terminó en exit 127. El cierre documental no afirma que se haya realizado review nativo.

SUPUESTO: éxito E2E serial no equivale a prueba de causa de los timeouts paralelos.
Risk: none (diff limitado a pruebas y documentación; sin cambios de producción).
