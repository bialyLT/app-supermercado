# Sistema visual compartido Administración + POS

Implementa la dirección elegida `design/admin-experience/01-sidebar-classic.html` en
producción: navegación lateral refinada y POS con el mismo sistema visual. Sin
capacidades nuevas.

## Specs

- **S1 — Sistema visual único.** Un cambio de token en `app/globals.css` afecta
  tanto `/admin` como `/pos`. Los módulos de POS y administración consumen
  `var(--…)`; no duplican colores literales para roles ya tokenizados.
- **S2 — Navegación lateral refinada (dirección 01).** Sidebar de 270 px con
  grupos de navegación, item activo fondo `#e0f2fe` / texto `#0369a1`, alto
  mínimo 44 px, foco visible y `aria-current="page"`.
- **S3 — Tablet.** A 1024 px o menos el sidebar se convierte en drawer con
  apertura explícita, cierre con Escape, foco contenido y restaurado; sin scroll
  horizontal en las acciones principales.
- **S4 — POS con barra lateral colapsada.** `/pos` se renderiza dentro de la shell
  para conservar navegación y contexto (badge Admin/POS), con la barra lateral en
  modo rail de 72 px que muestra solo iconos y se expande al recibir foco, hover o
  mediante un botón explícito. En tablet el rail conserva el comportamiento de
  cajón. La operación de caja mantiene su distribución y no pierde ancho útil a
  820 px. Esta spec revisa la decisión anterior de dejar el POS fuera de la shell
  (ver L6).
- **S5 — Contraste AA.** Texto blanco sobre `#0369a1` (5.93:1) para el botón
  primario; `#0284c7` solo en texto grande, iconos y bordes. Ningún texto normal
  por debajo de 4.5:1.
- **S6 — Sin regresiones funcionales.** Atajos existentes (F1–F12 del POS,
  `Alt+P`/`Alt+H`) y navegación por rol siguen funcionando. Suites existentes y
  E2E pasan.
- **S7 — CSP estricta (D-026).** Todo estilo vive en CSS Modules y tokens; no se
  agregan `style={{}}` ni `<style>` inline en producción.
- **S8 — Sin alcance nuevo.** Sin gráficos (D-023), sin capacidades backend y sin
  cambios de contrato de API.

## Tasks

| ID | Specs | Route | Estado | Commit |
|---|---|---|---|---|
| T1 | S1, S5, S7 | worker | hecho | `a238d53` |
| T2 | S2, S3, S4 | worker | hecho | `7a866a6` |
| T3 | S1, S4, S6 | worker | hecho | `59275fb` |
| T4 | S1, S5 | worker | hecho | `8c65e18` |
| T5 | S6, S8 | inline | hecho | pendiente de commit |
| T6 | S4, S6, S7 | worker | hecho | pendiente de commit |

### Cortes de revisión (continuación)

- T6 — POS dentro de la shell con rail de 72 px (~370 líneas): `app/pos/layout.tsx`
  nuevo, `AdminShell` con modo rail, iconos `components/ui/nav-icons.tsx` y
  `tests/pos-shell.test.ts` (8 tests).

### Cortes de revisión

- `759b3e1` — sistema de diseño sincronizado y tres direcciones visuales
  (artefactos de diseño, sin código de producción).
- `a238d53` — tokens compartidos y primitivas accesibles (~300 líneas).
- `7a866a6` — navegación agrupada y drawer en tablet (~250 líneas).
- `59275fb` — POS con el sistema compartido (~315 líneas).
- T4 — compras adopta primitivas y tokens (~480 líneas, incluido un test que
  fija el contrato de envío del modal de proveedor).
- T5 — verificación final; sin cambios de código, sólo este documento.

### Verificación final (T5)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | 0 errores, exit 0 |
| `npm test` | 32 archivos pasaron / 24 omitidos; **197 tests pasaron**, 160 omitidos (requieren base de datos), **0 fallaron** |
| `npm run build` | exit 0 |
| `npm run test:e2e` | **7 pasaron**, 28 omitidos, **1 falló** |
| `npm run lint` | rojo global preexistente: 31 258 problemas originados en `.cache/` sin seguimiento; alcance dirigido sobre los archivos cambiados: exit 0 |

**Rojo preexistente del E2E, reportado aparte (no se corrige sin brief):**
`tests/e2e/smoke.spec.ts` «sensitive routes reject unauthenticated callers»
espera 401 y recibe 400. Se reprodujo aislado y es determinista bajo el
servidor de desarrollo que usa Playwright. El mismo POST con el mismo cuerpo
contra el build de producción (`next start`) responde **401 UNAUTHENTICATED**
correcto. La ruta `app/api/admin/settings/route.ts` es idéntica al commit
anterior al rediseño (`git diff` vacío en `app/api`, `src/` y `prisma/`), por lo
que el fallo no proviene de este trabajo: es un defecto del gate en modo dev.

### Revisión independiente

El verificador independiente dictaminó **RED** por una regresión real que la
evidencia del agente no detectó: `app/admin/purchases/loading.tsx` usaba
`styles.header` y `styles.titleGroup`, selectores eliminados del módulo de
compras, por lo que ambos quedaban `undefined` en tiempo de ejecución.

Corrección aplicada: se restauran ambos selectores, el esqueleto de carga pasa a
clases propias y pierde sus tres estilos inline, y se agrega
`tests/css-module-classes.test.ts`, que verifica que todo `styles.X` referenciado
exista en el módulo importado (con una lista explícita de 4 huecos preexistentes
ajenos a este cambio). Gates tras la corrección: typecheck 0, **198 tests
pasaron**, 0 fallaron, eslint 0 errores.

### Pendiente fuera de este corte

Adopción de las primitivas compartidas en `reports`, `transfers`,
`admin-operations`, `suppliers`, `cash-shifts` y `promotions` (S1/S5). Queda
como corte siguiente: toca seis módulos y no cabe en una revisión razonable.

T4 se acota al módulo de compras como representante denso; la adopción en el
resto de los módulos densos queda como corte siguiente para no inflar la
revisión.

## Log

- **L1** (solicitud original, literal): «/gentle:design empecemos a trabajar en
  mejorar las vistas de este proyecto entero»
- **L2** (literal): «necesito algo antes de elegir cual implementar, resulta que
  la vista pos, no funciona en ninguna, esta en otro lado? porque desde que
  inicie el proyecto todos los cambios de diseño es como que no le afectan a esa
  vista, necesito que deje de pasar eso de aca en adelante, o tenes preparado
  otra cosa para eso?»
- **L3** (literal): «completa nuevamente las propuestas asi me aseguro de que
  esta vez por fin se modifique eso»
- **L4**: el dueño eligió la dirección 01 «Navegación lateral refinada» e indicó
  continuar con la implementación, incluida la vista POS.
- **L5** (diseño): `design/system.md` sincronizado y tres artboards en
  `design/admin-experience/`; elegido `01-sidebar-classic.html`; los otros dos
  quedan como alternativas.
- **L6** (literal): «Implement the design artboard design/admin-experience/01-sidebar-classic.html».
  El artboard muestra el POS dentro de la shell con badge Admin/POS, mientras la
  implementación previa lo dejaba fuera. Ante la diferencia, el dueño eligió
  «POS con barra lateral colapsada»: la shell se conserva, la barra pasa a rail de
  iconos que se expande al foco o hover.
