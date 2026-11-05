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
- **S4 — POS propio y accesible.** `/pos` conserva una distribución de atención a
  caja y NO usa el sidebar administrativo. Comparte con administración tokens,
  tipografía, radios y controles. El acceso a POS desde el shell se rige por los
  permisos existentes; no se agrega autorización nueva.
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
| T1 | S1, S5, S7 | inline | pendiente | — |
| T2 | S2, S3, S4 | worker | pendiente | — |
| T3 | S1, S4, S6 | worker | pendiente | — |
| T4 | S1, S5 | worker | pendiente | — |
| T5 | S6, S8 | inline | pendiente | — |

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
