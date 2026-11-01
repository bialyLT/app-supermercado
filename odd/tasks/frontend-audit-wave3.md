# Brief — Frontend audit Wave 3: consistencia visual

**Repo:** `C:\Users\Usuario\Documents\trabajos\supermercado` · **Base:**
`5bd4adc` · **Árbol:** congelar antes de implementar · **Único escritor:** sí

## Objetivo y alcance

Unificar formato de datos, tokens visuales, contraste y copy en las pantallas
operativas sin cambiar contratos de dominio ni comportamiento de negocio.

Puede tocar:

- `app/`
- `components/`
- `src/` sólo helpers de presentación
- `tests/`
- `docs/`
- `.github/web-dev-loop/reports/`

No puede tocar:

- `prisma/schema.prisma`
- `prisma/migrations/`
- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`
- APIs, autorización, cálculos Decimal o semántica offline
- producción, despliegues o proveedores

Migraciones: no.

## Aceptación e invariantes

1. Fechas, horas, cantidades y monedas usan helpers de presentación
   consistentes; no se cambia el valor server-side ni se usa `number` para
   dinero.
2. Los colores de texto y controles cumplen contraste WCAG AA verificable
   (4.5:1 texto normal, 3:1 texto grande/controles) en superficies principales.
3. Los módulos CSS usan tokens compartidos; no se agregan literales hex nuevos
   fuera de la fuente de tokens.
4. No quedan estilos React inline salvo variables CSS justificadas; no se
   agrega `unsafe-inline`.
5. Los mensajes de las pantallas operativas usan copy claro y consistente,
   conservan estados loading/error/empty y no exponen datos sensibles.
6. La navegación keyboard-first, foco visible, targets táctiles y responsive
   de Wave 1/2 no regresan.

## Contexto obligatorio

- `AGENTS.md`, `DOMAIN_RULES.md`, `DECISIONS.md`, `GATES.md`
- `docs/audits/informe-auditoria-frontend.md`
- `odd/tasks/frontend-audit-remediation.md`
- `.github/web-dev-loop/reports/frontend-audit-wave2.md`
- `components/ui/`, `app/globals.css` y módulos CSS de las pantallas tocadas

## Ataques

- Comparar formatos en desktop y tablet sin overflow horizontal.
- Verificar foco visible y navegación por teclado en estados de error y retry.
- Medir contraste de texto, botones, placeholders y estados disabled.
- Forzar locale/timezone distintos y comprobar que la fecha visible no altera
  el payload enviado.
- Buscar `style={{` y literales hex en los módulos incluidos; revisar cada
  excepción en el informe.
- Ejecutar `prefers-reduced-motion` y comprobar que no se pierde información.

## Gates y entregables

| Gate | Comando | Resultado esperado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | exit 0 |
| Lint | `npm.cmd run lint` | 0 errores y 0 warnings nuevos |
| Tests | `npm.cmd test` | 0 fallos; pasados/total |
| Cobertura | `npm.cmd run test:coverage` con gate DB | umbrales de `GATES.md` |
| Build | `npm.cmd run build` | exit 0 |
| E2E | `npm.cmd run test:e2e` | 0 fallos; pasados/total |
| Higiene | `git diff --check` | sin salida |

Informe: `.github/web-dev-loop/reports/frontend-audit-wave3.md`.
Respuesta final: `ENTREGADO:` o `BLOQUEADO:`.

No hacer commit, push ni reset destructivo durante la ronda. Requiere
aprobación explícita del dueño antes de escribir código.
