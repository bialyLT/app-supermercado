# GATES — Verificación y estándares de prueba

Fuente única de los gates. Los briefs no repiten la lista: dicen "gates de
`GATES.md`" y agregan solo los específicos de la épica.

## 1. Gates base

Se ejecutan con `npm run <script>` (en PowerShell de Windows `npm.cmd run`).

| Gate | Comando | Pasa si |
|---|---|---|
| Prisma generate | `db:generate` | exit 0 |
| Prisma validate | `db:validate` | exit 0 |
| Migración desde cero | `db:migrate` sobre base vacía | exit 0, sin pasos manuales |
| Typecheck | `typecheck` | 0 errores |
| Lint | `lint` | 0 errores y 0 warnings nuevos |
| Tests | `test` | 0 fallos; se reporta pasados/total |
| Cobertura | `test:coverage` | dominio ≥ 90 % líneas y ramas críticas; global ≥ 80 % (umbrales ajustables en `DECISIONS.md`) |
| Build | `build` | exit 0 |
| E2E | `test:e2e` | 0 fallos; se reporta pasados/total |
| Auditoría de dependencias | `audit --audit-level=high` | 0 vulnerabilidades altas/críticas |
| Higiene de diff | `git diff --check` | sin salida |

Además, desde Épica 2:

| Gate | Pasa si |
|---|---|
| Reconciliación del ledger | `on_hand == SUM(quantity_delta)` en todos los levels tras la batería |
| Concurrencia | batería ejecutada ≥ 20 veces seguidas sin fallo ni dato parcial |
| Aislamiento de tenant | test automático por tabla con `tenant_id`: 0 fugas |
| Boundaries | sin importaciones prohibidas entre módulos ni de Prisma fuera de repositorios |

## 2. Estándares de prueba

- **Base real.** Integración y concurrencia corren contra PostgreSQL real
  (Docker Compose o Testcontainers), con base o esquema aislado por worker. Un
  mock de base no prueba concurrencia ni restricciones.
- **Concurrencia.** N ≥ 20 operaciones en paralelo con conexiones distintas
  (`Promise.all`). Se verifican **invariantes** (stock ≥ 0, suma exacta,
  movimientos completos), nunca tiempos ni orden.
- **Propiedades.** `fast-check` para dinero, redondeo, conversiones de unidad y
  parseo de códigos pesables: la suma de líneas redondeadas es el total, ningún
  camino produce `NaN` ni pérdida de precisión.
- **Negativos primero.** Cada permiso tiene un test de denegación; cada ruta
  tiene un test sin sesión, con rol insuficiente y con tenant ajeno.
- **Append-only.** Tests que intentan UPDATE/DELETE sobre ledger y audit con el
  rol de aplicación y esperan fallo.
- **Idempotencia.** Reenviar el mismo comando 5 veces produce un único efecto;
  mismo id con payload distinto produce 409.
- **Determinismo.** Reloj y generadores de id inyectados; sin `sleep` para
  sincronizar.
- **Bug ⇒ reproducción.** Primero el test que falla, después el arreglo.

## 3. Reglas de reporte

- Sin número no hay gate verde: "tests: 142/142, cobertura dominio 93.4 %".
- Si un gate no pudo ejecutarse, se reporta `NO EJECUTADO` con el motivo; no se
  marca verde ni se simula.
- Un gate rojo preexistente se reporta aparte; no se oculta ni se "arregla" sin
  brief.

## 4. Seguridad (por PR)

Zod en toda entrada; ningún total, precio ni `tenantId` aceptado como
autoridad; cookies HttpOnly/Secure/SameSite; CSRF en mutaciones con cookie;
rate limit en login y endpoints sensibles; CSP y headers; sin secretos en
repositorio, logs o fixtures; revisión OWASP Top 10 al cerrar cada épica.
