# Web Dev Loop en VS Code/Copilot

Este repositorio conserva una adaptación local del método `web-dev-loop` para
Copilot. Cuando una tarea pida un roadmap, una propuesta de trabajo, avanzar una
fase o elegir testers, seguí la skill
`.github/skills/web-dev-loop/SKILL.md`.

## Reglas del proyecto

- Trabajá por fases y no empieces a implementar una fase sin un OK explícito.
- Mantené el fan-out de la skill: un solo escritor, read-only en paralelo,
  recursos compartidos serializados y recorrida de baterías cuando hay
  solapamiento.
- El dev y los testers dejan cambios sin commit. Sólo el orquestador puede
  commitear o pushear, y sólo después del gate de cierre.
- Todo hallazgo debe tener una reproducción que falle antes del arreglo,
  evidencia, severidad y verificación posterior.
- No inventes frameworks, capas, comandos ni MCPs: descubrí los del proyecto y
  usá sus convenciones.
- No incluyas secretos, PII ni credenciales reales en código, fixtures, logs o
  informes.
- Si una instrucción del usuario contradice estas reglas o el alcance del brief,
  detenete y pedí una decisión.

Los perfiles especializados están en `.github/agents/`. Los templates y el
procedimiento completo están dentro de la skill; las fuentes OpenCode del
repositorio se conservan para compatibilidad, pero no son necesarias para usar
Copilot.
