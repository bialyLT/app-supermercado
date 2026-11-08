# Demo local — datos operativos ficticios

Estado: ENTREGADO: Next3000 está restaurado y `/` respondió HTTP200; los datos demo se preservaron. Los errores de POS y límites de navegador descritos abajo corresponden a la inspección inicial; la validación posterior está en los reportes POS.

## Alcance
Solicitud: «levanta el serivodr para que yopueda ver con un pool de datos bien completo, pasame los usuarios».
Durante el arranque inicial no se realizaron cambios de aplicación ni delivery. Next dev corría sobre HEAD5031d17 en localhost3000; PostgreSQL18 aislado en127.0.0.1:55450. Cambios de otros worktrees se preservaron. El estado final de T4/T5 está documentado más adelante.

## Archivos
- `.cache/demo/{setup,env,teardown}.sh`, `seed-template.ts`, `manifest.json`, `README.md`, cluster y paquetes locales.
- Harness temporal `tests/demo-pool.test.ts` eliminado tras ejecutar.
- `next-env.d.ts`: ruta dev generada por Next, sin edición manual.
- Este informe, que se incluye como documentación; no se agregan archivos de `.cache/`, logs, credenciales ni datos locales al commit.

## Resultados observados en la inspección inicial
- Migraciones y aprovisionamiento: exit0; 2 roles runtime/auth sin superuser/BYPASSRLS/CREATEDB/CREATEROLE.
- Seed Vitest:1/1,8.8s; repetición idempotente1/1(SKIP), conteos iguales. Restart setup sin drop/reset.
- Dataset:34productos/34variantes(6pesables),2sucursales,4ubicaciones,5categorías,3proveedores,3compras,2transferencias,2promociones,9ventas/9pagosARS,3cajas,1turnoabierto/2cerrados,2intakes(1pendiente/1confirmado),5usuarios.
- Reconciliación: exit0,0divergencias; RLS43/43 enabled+forced. 34productos con stock,78saldos positivos, cantidad total5045.2.
- Verificador independiente: bind loopback exclusivo3000/55450,env600,data700;5/5loginHTTP200 y sesiones válidas, roles confirmados por/api/me. ADMIN e INVENTARIO acceden/api/admin/context200; demás403 esperado.
- `/api/pos/context`: ADMIN/INVENTARIO409 POS_LOCATION_AMBIGUOUS; cajeros y supervisor400 REQUEST_FAILED. Error reproducido por HTTP, sin arreglar.
- Browser: formulario de login cargó1103ms; intento6 respondió429 tras5loginsHTTP. Navegación autenticada no ejecutada;33erroresCSP inline-style en dev,0pageerrors. No se afirma que sean inofensivos.
- Servidor reiniciado por padre (job39) para liberar ventana de login consumida por verificación, sin tocar datos ni controles de seguridad.
- ASSESS temporal: unassessable por.cache untracked; sin reviewDue ni revisión nativa iniciada. Escalación item5 cubierta por verificador independiente; verdict incompleto por browser y POS.
- Full suite/build NO EJECUTADOS para este arranque: no hay cambios de app, no se presenta evidencia de la tarea anterior como ejecución actual.

## Cierre
La corrección T4 de contexto/ubicación y el pase visual T5 fueron verificados después en el entorno de pruebas aislado; consultar `.github/web-dev-loop/reports/pos-auth-register-location.md` y `.github/web-dev-loop/reports/pos-visual-coherence.md`. La base demo no fue reseteada, sembrada ni mutada durante la verificación final. No se incluyen credenciales en este informe.
SUPUESTO: ARS, precios y topes son de juguete, solo esta DB ficticia; no son decisiones de negocio. Contraseñas sintéticas comunicadas al dueño, no incluidas en informe.

Risk: item 5 (entorno local; se limitó a loopback y no hubo instalación, publicación ni cambio de datos demo). La autenticación/POS se verificó posteriormente con E2E aislados, según los reportes enlazados arriba.
