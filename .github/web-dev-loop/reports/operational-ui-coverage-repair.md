# Informe — Reparación de cobertura operativa

Estado: ENTREGADO: reparación local de cobertura verificada, con E2E serial, build, typecheck y lint aprobados. No equivale a CI remoto verde: E2E paralelo y revisión nativa conservan los límites detallados abajo. No se hizo commit, push ni merge.

## Alcance y archivos

Rama: `feat/operational-ui-completeness`, PR #13, base `ea864e6`.
Worktree: `/home/bialylt/workspaces/.operational-ui-move`.
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
| typecheck / lint independientes | intento inicial: timeout 30 s cada uno; repetición secuencial autorizada: exit 0 ambos, 46 s combinados, límite 300 s por comando |
| git diff --check | exit 0 antes del cierre documental |

## Límites de evidencia

La ejecución serial apoya la hipótesis de contención en E2E, pero no demuestra la causa raíz ni vuelve verde el comando predeterminado con cuatro workers. No se modificó la configuración de Playwright.
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

## Decisión requerida

El dueño autorizó la repetición secuencial con «haz todo lo que te parezca mejor»: typecheck y lint pasaron. Antes de publicar, resolver el gate E2E paralelo (la variante serial sí pasó) y la revisión nativa no disponible. No se alteró silenciosamente la configuración ni se declara el CI remoto verde.

SUPUESTO: éxito E2E serial no equivale a prueba de causa de los timeouts paralelos.
Risk: none (diff limitado a pruebas y documentación; sin cambios de producción).
