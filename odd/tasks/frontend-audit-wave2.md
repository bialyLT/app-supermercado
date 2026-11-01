# Brief — Frontend audit Wave 2: estados y errores

**Repo:** `C:\Users\Usuario\Documents\trabajos\supermercado`  
**Base:** `effe3ec`  
**Árbol:** documentación reconciliada; congelar antes de implementar  
**Único escritor por ola:** sí  
**Despliegue/producción:** fuera de alcance; no levantar ni publicar el sistema

## Objetivo y alcance

Hacer visibles, recuperables y consistentes los estados de carga, error,
reintento, expiración de sesión y cola offline en las superficies operativas
existentes, sin trasladar autoridad de tenant, permisos, totales o idempotencia
al cliente.

### Puede tocar

- `components/`
- `app/`
- `src/` sólo para helpers de sesión/API estrictamente necesarios
- `tests/`
- `docs/`
- `.github/web-dev-loop/reports/`
- Este brief y la documentación de planificación de la auditoría frontend

### No puede tocar

- `prisma/schema.prisma`
- `prisma/migrations/`
- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`
- despliegues, cuentas remotas, producción o configuración de proveedores
- contratos de dominio existentes salvo que una regresión demostrable lo exija

### Migraciones

No autorizadas. Esta ola no cambia el esquema.

## Superficies prioritarias

1. Helper compartido `apiFetch` o equivalente, si ya existe; no duplicar
   mapeos HTTP por pantalla.
2. Expiración/ausencia de sesión: respuesta 401, limpieza segura y retorno al
   login sin mostrar autoridad administrativa.
3. Estados loading, empty, error y retry en shell, compras, transferencias,
   reportes, promociones, configuración y POS.
4. Cola offline: cantidad pendiente, estado de replay, conflicto, error
   recuperable y acción explícita de reintento/resolución.
5. Preservación de formularios: un error de red, 401 o conflicto no debe borrar
   datos ingresados sin confirmación.

## Aceptación e invariantes

1. Cada pantalla incluida diferencia loading, empty, error y retry; un error no
   se presenta como lista vacía.
2. Un 401 redirige al acceso y limpia la sesión visible sin fallback ADMIN.
3. Un 403, 409 y error de red muestran mensajes distintos y accionables, sin
   exponer SQL, stack traces, secretos ni datos de otro tenant.
4. Reintentar conserva el mismo comando/idempotency key cuando corresponde; no
   duplica ventas, compras, transferencias ni replays offline.
5. La cola offline muestra pendientes, procesando, completados y conflictos;
   ningún comando se elimina silenciosamente ante error.
6. El cliente no acepta `tenantId`, `branchId`, totales, permisos ni stock como
   autoridad.
7. Los estados funcionan con teclado, foco visible y viewport de escritorio y
   tablet; no aparece scroll horizontal en acciones principales.
8. No se agrega `unsafe-inline`, secreto, PII ni dependencia innecesaria.

## Ataques de testers

- Forzar 401 durante una mutación y verificar retorno al login sin pérdida
  silenciosa de datos.
- Simular 403, 409, 422, 500 y desconexión; verificar mensajes y retry.
- Repetir retry cinco veces y comprobar un único efecto server-side.
- Interrumpir replay offline y verificar que el comando queda recuperable.
- Enviar payloads con `tenantId`, `branchId` o totales inventados y comprobar
  que la UI no los convierte en autoridad.
- Abrir/cerrar estados con teclado y en 820×1180 y 1180×820.
- Verificar que errores de sesión o configuración no se transformen en 400,
  lista vacía o navegación ADMIN.

## Fan-out y recursos

| Dominio | Herramienta existente | Escribe | Recurso | Superficie | Ola |
|---|---|---:|---|---|---:|
| Desarrollo | `.github/agents/dev.agent.md` | sí | árbol | `components/`, `app/`, `src/`, `tests/` | 0 |
| Seguridad/sesión | `.github/agents/security-auditor.agent.md` | no | árbol congelado | auth, API, errores, cola | 1 |
| Calidad | `.github/agents/tester-quality.agent.md` | no | árbol congelado | tipos, lint, cobertura, duplicación | 1 |
| UI/E2E | `.github/agents/tester-ui.agent.md` | sí sólo para correcciones autorizadas | navegador serializado | pantallas, teclado, responsive | 2 |
| Base de datos | `.github/agents/tester-db.agent.md` | no | PostgreSQL serializado | idempotencia, RLS, ausencia de efectos | 2 |
| Gate/cierre | orquestador | sí | documentación y diff | informes y roadmap | 3 |

Reglas aplicadas: R1 un solo escritor · R2 read-only en paralelo · R3 recursos
compartidos en serie · R4 re-correr baterías tras solapamiento · R5 gates
baratos antes de navegador/base · R6 agentes autónomos.

## Gates y entregables

| Gate | Comando | Resultado esperado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | 0 errores |
| Lint | `npm.cmd run lint` | 0 errores y 0 warnings nuevos |
| Tests | `npm.cmd test` | 0 fallos; pasados/total |
| Cobertura | `npm.cmd run test:coverage` | umbrales de `GATES.md` |
| Build | `npm.cmd run build` | exit 0 |
| E2E | `npm.cmd run test:e2e` | 0 fallos; pasados/total |
| Ledger/RLS | `npm.cmd run test:ledger` | 0 divergencias y RLS reportado |
| Higiene | `git diff --check` | sin salida propia |

Informe esperado: `.github/web-dev-loop/reports/frontend-audit-wave2.md`,
cerrado con `ENTREGADO:` o `BLOQUEADO:` y números reales.

## Fuera de fase

- Producción, Vercel, Neon y backups.
- Cambios de esquema o nuevas tablas.
- Nuevas reglas fiscales, pagos, promociones o inventario.
- Rediseño visual general de Wave 3.
- Cambiar la semántica de negocio de offline; sólo hacerla visible y
  recuperable según los contratos ya aprobados.

**Estado:** brief preparado en `odd/tasks/`; esperando OK explícito antes de implementar.
