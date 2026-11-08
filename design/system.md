# Sistema de diseño — Supermercado (sincronizado)

Qué es: tokens y reglas de componentes extraídos **solo de fuentes reales** del
proyecto para que los artboards de `design/` usen los mismos valores que la app.
No define valores nuevos: todo lo listado existe en el código fuente citado.

## Fuentes leídas

| Fuente | Contenido |
|---|---|
| `app/globals.css` | Tokens `:root`, reset, focus ring global, targets táctiles, `.sr-only` |
| `components/admin-shell.module.css` | Shell: sidebar 270 px, header 64 px, nav activa `#e0f2fe`/`#0369a1`, breadcrumbs |
| `app/admin/admin-dashboard.module.css` | Inicio: grilla de módulos `minmax(280px, 1fr)`, tarjetas, caja de atajos `#f0fdf4`/`#166534` |
| `components/purchases/purchases.module.css` | Compras: formulario, tablas, totales, botones, alertas, modal, responsive |
| `components/modal.module.css` | Modal genérico (ancho `min(100%, 42rem)`, radio 0.5rem) |
| `components/admin-navigation.ts` | Items de navegación reales, roles y atajos de teclado |
| `components/admin-shell.tsx` | Orden semántico: skip-link → sidebar → header → breadcrumbs → main |

## Colores (tokens `:root` — `app/globals.css`)

| Token | Valor | Uso observado en fuentes |
|---|---|---|
| `--color-bg` | `#f8fafc` | Fondo general de la app y hover de filas de tabla |
| `--color-surface` | `#ffffff` | Paneles, header, sidebar, formularios |
| `--color-surface-subtle` | `#f1f5f9` | Fondos suaves: footer del sidebar, encabezados de tabla, hover |
| `--color-border` | `#cbd5e1` | Bordes de tarjetas, inputs, botones secundarios |
| `--color-border-subtle` | `#e2e8f0` | Separadores suaves, bordes de filas de tabla |
| `--color-text` | `#0f172a` | Texto principal |
| `--color-text-muted` | `#475569` | Texto secundario, descripciones, etiquetas |
| `--color-primary` | `#0284c7` | Accentos grandes, enlaces en hover, bordes de foco de inputs, pestaña activa |
| `--color-primary-hover` | `#0369a1` | Hover de botón primario; **fondo seguro para botón primario con texto blanco** (AA) |
| `--color-primary-contrast` | `#ffffff` | Texto sobre primario |
| `--color-accent` | `#2563eb` | Foco visible global (`--focus-ring`) |
| `--color-success` | `#16a34a` | Estado positivo (solo texto grande / decorativo) |
| `--color-warning` | `#d97706` | Avisos |
| `--color-danger` | `#dc2626` | Errores, borrar, texto de campo inválido |
| `--color-danger-bg` | `#fef2f2` | Fondo de banner de error / acceso restringido |
| `--color-danger-border` | `#fecaca` | Borde de error / botón peligro |

### Colores de uso (valores reales fuera de `:root`, con su fuente)

| Valor | Uso | Fuente |
|---|---|---|
| `#e0f2fe` | Fondo de nav activa | `admin-shell.module.css` `.navLinkActive` |
| `#0369a1` | Texto de nav activa (coincide con `--color-primary-hover`) | `admin-shell.module.css` |
| `#f0fdf4` / `#bbf7d0` / `#166534` | Caja de atajos/éxito | `admin-dashboard.module.css` `.hintsBox`, `purchases.module.css` `.alertSuccess` |
| `#991b1b` | Texto de alerta de error | `purchases.module.css` `.alertBanner` |
| `#fee2e2` | Hover de botón peligro | `purchases.module.css` `.btnDanger:hover` |
| `#64748b` | Fallback de muted en módulos | `purchases.module.css`, `admin/*/loading.tsx` |
| `rgba(2,132,199,0.2)` | Anillo de foco de inputs | `purchases.module.css` |
| `rgba(15,23,42,0.6)` | Backdrop de modal | `purchases.module.css` `.modalBackdrop` |

## Tipografía (`app/globals.css` y módulos)

- Familia: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (`--font-sans`). Monospace solo en `kbd` y badges de atajo.
- Tamaños observados: 0.7 / 0.75 / 0.78 / 0.8 / 0.85 / 0.875 / 0.9 / 0.95 / 1 / 1.1 / 1.15 / 1.25 / 1.5 rem. Título de página 1.5rem; título de sección 1.1rem; tabla 0.9rem; labels 0.85rem.
- Pesos: 400 texto, 500 controles/labels, 600 títulos y nav activa, 700 título de página y total final.
- Números de dinero: `font-variant-numeric: tabular-nums` (`.numberCell`).

## Espaciado y layout

| Valor | Uso | Fuente |
|---|---|---|
| `--min-touch-target: 44px` | Alto mínimo de controles | `globals.css` |
| Sidebar 270 px; header 64 px | Shell admin | `admin-shell.module.css` |
| Contenido principal `max-width: 1400px`; padding 24 px | Shell | `admin-shell.module.css` |
| Compras `max-width: 1280px`; gap 24 px entre bloques | Compras | `purchases.module.css` |
| Grilla de módulos `repeat(auto-fill, minmax(280px, 1fr))`, gap 20 px | Inicio | `admin-dashboard.module.css` |
| Formulario: grillas `grid3`/`grid2` gap 16 px → 2 col ≤900px → 1 col ≤640px | Compras | `purchases.module.css` |
| Paddings de tarjeta 24 px; fila de tabla 12 px; celda de tabla 8–10 px | Varios | `purchases.module.css` |

## Radio, sombras y foco

- Radios: `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px` (`globals.css`). Modal genérico usa 0.5rem (`modal.module.css`).
- Sombras observadas: `0 1px 3px rgba(0,0,0,0.05)` (formulario), `0 4px 6px -1px rgba(0,0,0,0.1)` (skip link/dropdown), `0 6px 12px -2px rgba(0,0,0,0.08)` (card hover), `0 20px 25px -5px rgba(0,0,0,0.1)` (modal), `0 20px 50px rgb(15 23 42 / 25%)` (modal genérico).
- Foco global: `--focus-ring: 2px solid #2563eb` con offset 2 px (`globals.css`). En componentes: `2px solid #0284c7` (tabs/botones) y anillo `rgba(2,132,199,0.2)` en inputs.

## Reglas de componentes

| Componente | Regla (observada) |
|---|---|
| Botón primario | Fondo `--color-primary` con texto blanco es la regla actual de producción, pero **no pasa AA en texto normal (4.10:1)**. Para artboards accesibles usar fondo `--color-primary-hover` `#0369a1` con blanco (5.93:1) o fondo blanco con texto `#0369a1`. `#0284c7` queda para texto grande (≥18.66px bold), iconos, bordes y anillos. |
| Botón secundario | Fondo blanco, borde `--color-border`, texto `--color-text`, hover `--color-surface-subtle`. Min-height 44 px. |
| Botón peligro | Borde `#fecaca`, texto `#dc2626` sobre blanco (4.83:1, pasa AA). |
| Nav | Item 44 px de alto, radio md, activa con fondo `#e0f2fe` y texto `#0369a1` (5.17:1). |
| Tabla | Encabezado fondo `--color-surface-subtle`, texto muted; filas con borde `--color-border-subtle`; números a la derecha con tabular-nums. |
| Input/select | Borde `--color-border`, radio md, foco con borde `#0284c7` + anillo; error con borde/texto `#dc2626`. |
| Alerta | Error: fondo `#fef2f2`, borde `#fecaca`, texto `#991b1b`. Éxito: `#f0fdf4`/`#bbf7d0`/`#166534`. |
| Modal | Ancho `min(100%, 42rem)`, radio 8px, backdrop `rgba(15,23,42,0.6)`. |
| kbd / badge | Monospace, fondo `--color-surface-subtle`, borde `--color-border`, radio 4px, texto muted. |

## Contraste medido (cálculo WCAG 2.x, verificación numérica local)

| Combinación | Ratio | Veredicto |
|---|---|---|
| Blanco sobre `#0369a1` (primary-hover) | 5.93:1 | AA normal |
| Blanco sobre `#2563eb` (accent) | 5.17:1 | AA normal |
| Blanco sobre `#0284c7` (primary) | 4.10:1 | AA solo texto grande |
| `#0284c7` sobre blanco | 4.10:1 | AA solo texto grande |
| `#0369a1` sobre blanco | 5.93:1 | AA normal |
| `#0369a1` sobre `#e0f2fe` | 5.17:1 | AA normal |
| `#0f172a` sobre `#ffffff` | 17.85:1 | AA normal |
| `#475569` sobre `#ffffff` | 7.58:1 | AA normal |
| `#dc2626` sobre `#ffffff` | 4.83:1 | AA normal |
| `#166534` sobre `#f0fdf4` | 6.81:1 | AA normal |
| `#991b1b` sobre `#fef2f2` | 7.60:1 | AA normal |

## Checklist de sincronización

- [x] Tokens leídos de fuentes reales (globals.css + módulos CSS de componentes)
- [x] Sin valores inventados; colores de uso citados con su archivo
- [x] Regla de contraste para botón primario documentada con ratios medidos
- [x] `design/system.html` renderiza estos tokens a 1440 px
