# Publicar cierre de Épica 2 y perfiles tributarios
Objetivo: separar los avances existentes en dos commits y publicar la rama feat/argentina-tax-profiles, sin tocar main ni abrir PR.
Verificación: evidencias funcionales registradas, inspección de cada índice y evaluación nativa por candidato; no alterar el árbol de trabajo para separar commits.

## Specs
S1. «bien pusheamos y continuamos».
S2. «ok, despues continua con ventas, caja y pagos». Aprobación de incluir cierre de Épica 2 y perfiles tributarios en commits separados y pushear la rama actual.

## Tasks
T1 | S1-S2 | inline delivery | done | Épica 2 independiente sin perfiles fiscales; commit ca220e08fc33e25cb132baeb41698a930d2049a7; verificador 15/15. Risk: item 2 (cierre previo de seguridad).
T2 | S1-S2 | inline delivery | in_progress | Commit fiscal y publicación no forzada de la rama; commit pendiente. Risk: item 2 (permisos fiscales).
T3 | S2 | read-only planning | pending | Revisar alcance de ventas/caja/pagos y resolver decisiones comerciales necesarias, sin inventarlas.

## Log
L5. Commit A ca220e08fc33e25cb132baeb41698a930d2049a7: 79 archivos, 3921 adiciones/625 eliminaciones, 12 migraciones. Verificador confirma corte independiente sin referencias fiscales, gate puro15/15. Integración de este corte no repetida: evidencia previa111/111. ASSESS del commit: unassessable por untracked fiscal, escalado item2 satisfecho por verificador independiente; sin aprobación nativa. Acceso GitHub Linux falló por credenciales; Windows cmd.exe git ls-remote exitoso. Fronteras acordadas: A Épica2, B fiscal; commits heredados grandes, sin PR ni main.
L1. Usuario: «bien pusheamos y continuamos».
L2. Usuario: «ok, despues continua con ventas, caja y pagos».
L3. Rama actual feat/argentina-tax-profiles, HEAD c936deb. Origin https://github.com/bialyLT/app-supermercado.git. Base de trabajo contiene cierre previo sin commits y cambios de EOL. Se excluyen cambios solamente de EOL y referencia reusable protegida sin revertirlos. Son dos unidades heredadas mayores que 400 líneas: la separación honesta acordada es Épica2 y fiscal; no se abre PR ni se presume aprobación para merge.
L4. Verificación previa: suite134/134, verificador fiscal26/26, spot padre23/23, build/typecheck/lint verdes. Runner Windows cmd.exe, Docker postgres descartable loopback55449. Fuente: .github/web-dev-loop/reports/epica-3-tax-profiles.md.
