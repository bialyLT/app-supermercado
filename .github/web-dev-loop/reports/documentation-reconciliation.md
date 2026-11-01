# Reconciliación documental y siguiente alcance

**Estado:** ENTREGADO: se reconciliaron los estados documentales de Wave 0,
Wave 1 y Épica 6; se seleccionó Wave 2 como próximo alcance planificado.

## Archivos modificados

- `ROADMAP.md`
- `odd/tasks/frontend-audit-remediation.md`
- `odd/tasks/epic6-scale-reports-deployment.md`
- Este informe.

## Resultado

- Wave 0: entregada según `frontend-audit-wave0.md`.
- Wave 1: entregada según `frontend-audit-wave1.md`; no quedan tareas dentro
  del alcance aprobado.
- Épica 6: entregada técnicamente; producción sigue sin desplegarse.
- Wave 2: seleccionada como próximo alcance planificado:
  `apiFetch`, expiración de sesión, estados de carga/error/reintento y
  visibilidad de la cola offline.

## Verificación

- Revisión documental: 4 archivos actualizados, 0 archivos de aplicación
  modificados.
- Tests/build/lint: NO EJECUTADOS; esta ola sólo actualiza documentación y
  estados, sin cambios de código.

## Límites y decisiones pendientes

- No se creó todavía el brief de implementación de Wave 2.
- No se implementa Wave 2 hasta contar con brief, criterios medibles y OK
  explícito.
- D-012 permanece `PROPUESTA`; esta reconciliación no inventa aprobación de
  negocio.
- La activación de producción y la configuración de branch protection siguen
  siendo acciones del dueño.
