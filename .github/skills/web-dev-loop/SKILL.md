---
name: web-dev-loop
description: Bootstrap y loop de desarrollo web por fases con roadmap aprobado, fan-out de testers adversariales, gates y cierre controlado. Usar para roadmaps, propuestas de trabajo, planificación/avance de fases y selección de testing.
---

# Web Dev Loop para Copilot

Aplicá el método original en español rioplatense con el usuario y en inglés en
el código. Esta adaptación reemplaza la invocación automática y los permisos
del runtime de OpenCode por instrucciones explícitas, perfiles `.agent.md`,
contexto en disco y control humano del chat. No cambia el método.

## Bootstrap: pedido → roadmap aprobado

1. **Clasificá**: roadmap con meta (bootstrap completo) o propuesta de tarea
   (bootstrap lite).
2. **Inventariá** antes de preguntar: leé las instrucciones del proyecto,
   `package.json`/scripts, herramientas de testing, skills disponibles y MCPs
   realmente configurados. No ofrezcas capacidades inexistentes.
3. **Preguntá una cosa por vez** qué testers quedan activos: interfaz/E2E,
   base de datos, calidad, seguridad, API/contratos, performance y responsive.
   Si no se elige ninguno, declaralo como hueco de cobertura automática.
4. Preguntá qué usan los devs de forma proactiva (documentación, memoria,
   exploración, revisión adversarial u otros recursos existentes).
5. Armá el plan de fan-out con dominio, herramienta, si escribe, recurso,
   superficie y ola.
6. Proponé un roadmap con objetivo, criterios medibles, invariantes, gates,
   testers por ola, dependencias y fuera de alcance. **Esperá OK explícito**
   antes de escribir código.

### Reglas de fan-out

- **R1 — un solo escritor**: dev y testers que arreglan van en serie.
- **R2 — read-only en paralelo**: seguridad y calidad pueden correr juntos sobre
  el árbol congelado.
- **R3 — recursos en serie**: navegador, base, servidor y otros locks
  compartidos no se usan simultáneamente.
- **R4 — solapamiento**: el segundo escritor re-corre las baterías del primero.
- **R5 — costo**: primero gates baratos, después UI/carga costosas.
- **R6 — autonomía**: cada agente recibe un brief completo y no se lo
  interrumpe para preguntarle estado.

Plan habitual:

```
Ola 0  dev (escritor)                    → entrega + árbol congelado
Ola 1  security-auditor + tester-quality → read-only, en paralelo
Ola 2  tester-ui + tester-db             → escritores, en serie
Ola 3  gate del orquestador + cierre     → docs, commit y push si corresponde
```

Reducí las olas si el proyecto no tiene ese dominio o herramienta, pero
declaralo en el roadmap.

## Loop por fase

### Brief

Creá un brief persistente en `.github/web-dev-loop/briefs/` (o en la ruta
acordada por el usuario) con repo, commit de partida, árbol congelado,
objetivo, paths permitidos/prohibidos, criterios medibles, invariantes,
contexto obligatorio, ataques del tester, comandos exactos, entregables e
informe esperado. Usá `references/templates/brief.md`.

### Dev

Usá el agente `dev`. Leé primero las instrucciones del proyecto, lessons,
adapters y brief. Implementá el mínimo completo, agregá un test por
comportamiento, auto-atacá entradas hostiles, doble submit, fechas, montos,
concurrencia y responsive cuando aplique. Corré gates con números reales.
Terminá con `ENTREGADO:` o `BLOQUEADO:` y **sin commit**.

### Testers

Usá los agentes especializados según el plan. Primero regresión, después
ataques nuevos. Los bugs deben fallar antes del arreglo. Los testers que
arreglan pueden editar código de aplicación, pero no schema/migraciones salvo
que el brief lo autorice. El auditor de seguridad y el tester de calidad son
read-only. Terminá con `VEREDICTO: VERDE|ROJO` o `HALLAZGOS:`.

### Gate y cierre

Corré sólo el delta que no quedó cubierto, sin repetir suites innecesariamente.
Verificá que el árbol medido sea el árbol final, actualizá informes con números
reales y revisá el diff. Sólo entonces el orquestador puede hacer **un commit**
convencional ASCII. No hagas push salvo que el usuario y el repositorio lo
pidan; si se pide, verificá `HEAD` contra el remoto. Si se pausa, dejá el
estado y próximo paso documentados.

## Fuentes y templates

- Método y fallos transversales: `skills/web-dev-loop/references/lessons.md`.
- Roles: `skills/web-dev-loop/references/roles.md`.
- Capacidades y selección: `skills/web-dev-loop/references/capabilities.md`.
- Brief, roadmap e informes Copilot: `.github/skills/web-dev-loop/references/templates/`.
- Los perfiles Copilot equivalentes: `.github/agents/*.agent.md`.

No uses `opencode.jsonc`, permisos `mode: subagent` ni comandos de memoria/MCP
que no existan en el entorno Copilot. La ausencia de una herramienta sólo
reduce cobertura; no se simula éxito.
