# Condición tributaria argentina por razón social
Objetivo: configuración tributaria separada de ventas/caja, con contexto histórico de ticket interno.
Rama: feat/argentina-tax-profiles. Commit y push autorizados posteriormente por el dueño; publicación en curso. Runner: Windows npm.cmd; entrega acotada, estimación 380 líneas nuevas.

## Specs
S1. «1: argentina, 2: ticket interno, 3: una sola razon social con varias sucursales 4: si apruebo». Se ratifica HALF_UP por línea y suma de líneas.
S2. «es que el dato no es dedsconocido, el sistema deberia estar preparado para las dos condiciones de la manera mas escalable posible». Soportar monotributista y responsable inscripto por razón social, no condición pendiente como modalidad comercial.
S3. «excelente hagamos eso». Alcance aprobado: separar reglas tributarias de ventas/caja/pagos, contexto histórico de venta conservado, ticket interno inicial sin emisión fiscal.

## Tasks
T1 | S1-S3 | inline | done | Registrar decisiones y brief de alcance; commit: no autorizado.
T2 | S2-S3 | gentle-ai-worker (context backstop emitido por runtime) | done | Implementar configuración por Store y snapshot de venta con migración aditiva y pruebas RED/GREEN; Risk: item 2 (nuevo permiso/configuración tenant). Commit: no autorizado.
T3 | S1-S3 | inline + gentle-ai-verify | done | Verificar PostgreSQL aislado, regresiones, tipado y lint; informar límites. Commit: no autorizado.

## Log
L8. Autorización posterior: usuario «bien pusheamos y continuamos» y «ok, despues continua con ventas, caja y pagos». Los estados «no autorizado» de T1-T3 son evidencia histórica, reemplazada por esta autorización. Se publica fiscal como segundo commit tras ca220e0; este documento viaja con la unidad fiscal.
L7. Cierre T3: verificador26/26 (11.24s), sin bloqueos S1-S3; padre23/23 (5.96s). SQL tamper rechazado con rollback. Docs/arquitectura/reglas/roadmap actualizados. Higiene Linux falló por CRLF, comprobación cr-at-eol y enlace pasan. Review nativa no ejecutada (ASSESS unassessable por untracked previo); E2E sin cambios UI/HTTP, CI/deploy/audit no repetidos. Se conserva DB Docker de pruebas supermercado-fiscal-session-gate en loopback55449, sin tocar bases operativas. Sin commit ni push. Este lote NO entrega ventas/pagos/arqueos completos.
L6. Corrección T2 recibida: 23/23 pruebas fiscales, 134/134 suite con PostgreSQL, 14/14 migraciones, RLS28/28, ledger0; typecheck/lint/build aprobados, cobertura líneas98.90%. Readback confirma permiso por sucursal y triggers nuevos. T3 pendiente de verificación independiente y spot-check del padre; sin commit/push.
L1. Usuario: «excelente hagamos eso».
L2. Contexto literal: «1: argentina, 2: ticket interno, 3: una sola razon social con varias sucursales 4: si apruebo»; «no se sabe, podria ser monotributista y responsable inscripto,»; corrección: «es que el dato no es dedsconocido, el sistema deberia estar preparado para las dos condiciones de la manera mas escalable posible».
L3. Reanudación: árbol con cambios previos extensos sin commit; no se incorporarán ni revertirán. Runner WSL falla por binding Rolldown Windows; runner Windows comprobado: contracts 3/3. Docker Windows 29.9.1 disponible. No se leyó .env real.
L5. T2 devolvió 126/126 tests y 28/28 RLS, pero readback halló protección DB ausente, lectura sin validar asignación a sucursal, internalTicket=false fuera de alcance e idempotencia de configuración ausente. Se requiere una corrección acotada antes de T3; no se acepta T2 todavía. ASSESS: nativo unassessable por untracked; escalado item 2 exige verificador independiente.
L4. Alcance técnico: perfil separado vinculado a Store; ventas de inventario legacy sin perfil conservan comportamiento y no reciben condición inventada. No se agregan tasas IVA, cálculos fiscales, numeración, CUIT validado, emisión ARCA ni backend completo de Épica 3. El perfil admite únicamente las dos condiciones aprobadas. Datos legacy ausentes no constituyen tercer régimen.
