# Informe de auditoría de frontend — app-supermercado

**Repositorio:** https://github.com/bialyLT/app-supermercado (rama por defecto, clon superficial del 31/10/2026)
**Tipo de trabajo:** solo auditoría. No se modificó ningún archivo del repositorio (`git status` limpio al finalizar).
**Alcance:** `app/`, `components/`, `next.config.ts`, `playwright.config.ts`, `package.json`, `AGENTS.md` y los nombres de los tests E2E. Backend (`src/`, `prisma/`) solo leído como contexto; no se propone ningún cambio fuera del frontend.

---

## 1. Resumen ejecutivo

El frontend tiene una base sensata (skip-link, `lang="es"`, tokens en `globals.css`, `aria-label` en tablas, atajos en el shell, indicadores de carga) y una buena disciplina de dominio (importes como string, `Decimal`). Los problemas reales están en cuatro frentes:

1. **Integridad de datos en pantalla:** dos formularios pueden enviar un producto distinto al que se ve (compras y transferencias), los reportes calculan "Hoy / Este mes" en UTC (Argentina es UTC-3) y varios campos de fecha se desplazan 3 h en cada edición.
2. **POS:** es la pantalla más importante y la menos terminada: pide un UUID de ubicación a mano, muestra UUID en el carrito, `Esc` vacía la venta sin confirmar, no tiene navegación por teclado en la búsqueda, ni cierre de sesión, ni sistema visual.
3. **Tablet / teclado:** tablas de hasta 1180 px de ancho mínimo, controles bajo los 44 px, drawer que sigue siendo "tabulable" cerrado, modales sin trampa de foco, combobox sin ARIA y 9 atajos anunciados que no existen.
4. **Producción:** la CSP de producción (`script-src 'self'`, `style-src 'self'`, sin nonce) probablemente rompe hidratación y estilos inline, y los E2E solo corren contra `next dev`, que usa otra CSP. **Esto no pude confirmarlo ejecutando** (ver SEG-01 y §7).

### Conteo por severidad

| Crítica | Alta | Media | Baja | Total |
|---|---|---|---|---|
| 3 | 27 | 38 | 11 | 79 |

### Las 12 cosas que atacaría primero

| # | ID | Qué | Por qué primero |
|---|---|---|---|
| 1 | SEG-01 | Confirmar CSP de producción con `next build && next start` | Si se confirma, la app no funciona en producción |
| 2 | DAT-01 | Variante desincronizada (compras y transferencias) | Movimiento de stock sobre un producto distinto al visible |
| 3 | DAT-02 | Reportes "Hoy/Mes/7 días" en UTC | Totales que no coinciden con la realidad del negocio |
| 4 | POS-01 | Ubicación por UUID escrito a mano | El cajero no puede vender sin conocer un UUID |
| 5 | POS-03 | `Esc` borra el carrito sin confirmar | Pérdida de venta en curso por una tecla |
| 6 | NAV-01 | `/admin/cash-shifts` enlazado pero inexistente | 404 para ADMIN y SUPERVISOR (SUPERVISOR casi no tiene otra cosa) |
| 7 | SEG-02 / SEG-03 | Shell fail-open a ADMIN y sin "Cerrar sesión" | Terminales compartidas sin salida de sesión |
| 8 | DAT-07 | Clave de idempotencia visible y regenerable | Riesgo de duplicar compras/transferencias tras un corte de red |
| 9 | DAT-06 | La coma decimal es rechazada | El teclado numérico es-AR de la tablet escribe coma |
| 10 | RSP-01 / RSP-03 | Tabla de compras de 1180 px y botones < 44 px | Pantalla principal de compras inusable en tablet |
| 11 | EST-01 | Errores de carga que se ven como "no hay datos" | El usuario crea duplicados o pierde confianza |
| 12 | QA-01 | Sin E2E de tablet, teclado, axe, producción ni offline | Nada de lo anterior se detectaría en CI |

---

## 2. Cómo leer este informe

Cada hallazgo tiene los seis campos pedidos: **Problema · Archivo y líneas · Impacto · Severidad · Recomendación · Cómo verificarlo**.

Marca de confianza junto al título:

- **✔** lo verifiqué yo leyendo el código y las líneas citadas.
- **◐** surge de una revisión delegada por módulo (transferencias, reportes/proveedores, administración/promociones); las citas fueron contrastadas con `cat -n` por quien las reportó y las más graves las re-leí yo.
- **⚠** requiere ejecutar la app para confirmarse; está declarado como tal.

Severidades: **Crítica** (datos incorrectos o app inutilizable), **Alta** (bloquea un flujo real o excluye usuarios), **Media** (degrada la experiencia o la accesibilidad), **Baja** (pulido / consistencia).

Rutas abreviadas: `PF` = `components/purchases/purchase-form.tsx`, `PM` = `components/purchases/purchase-manager.tsx`, `PH` = `components/purchases/purchase-history.tsx`, `TF/TM/TH/TY` = `components/transfers/transfer-form.tsx / transfer-manager.tsx / transfer-history.tsx / types.ts`, `RT` = `components/reports/types.ts`, `RF` = `components/reports/report-filters.tsx`, `RM` = `components/reports/reports-manager.tsx`.

---

## 3. Seguridad y sesión

### SEG-01 · CSP de producción probablemente rompe hidratación y estilos ⚠
- **Problema:** en producción la CSP es `default-src 'self'; script-src 'self'; style-src 'self'` sin nonce ni `'unsafe-inline'`. Las páginas del App Router incluyen scripts inline (arranque y payload RSC), y el repo renderiza ~135 atributos `style={{…}}` (ver VIS-03) más un `<style>` inline en `loading.tsx`. Con esa política el navegador los bloquea. En desarrollo la CSP es distinta (`'unsafe-inline'` y `'unsafe-eval'`), y los E2E solo corren en desarrollo.
- **Archivo y líneas:** `next.config.ts:5-10` (CSP), `playwright.config.ts:6` (`npm run dev`), `app/admin/loading.tsx:32-36`.
- **Impacto:** si se confirma, en producción login, POS y formularios quedan sin JavaScript (el formulario haría un envío nativo) y se pierden los estilos inline renderizados en servidor. Es la única cosa que puede hacer inútil todo lo demás.
- **Severidad:** Crítica (condicional a la verificación).
- **Recomendación:** (1) construir y servir en modo producción y mirar la consola. (2) Si se confirma, adoptar la estrategia de nonce de Next para esta versión (proxy/middleware que genere el nonce + renderizado dinámico) o declarar explícitamente una política con `'unsafe-inline'` para scripts; AGENTS.md exige leer `node_modules/next/dist/docs/` de la versión instalada (16.4.3) antes de decidir. (3) Mover todo `style={{}}` y el `<style>` de `loading.tsx` a CSS Modules. (4) Agregar `form-action 'self'`.
- **Cómo verificarlo:** `npm run build && npm start`, abrir `/` y `/pos` con DevTools; buscar "Refused to execute inline script" / "Refused to apply inline style"; comprobar que el botón "Ingresar" funciona. Agregar un test que escuche `securitypolicyviolation`.
- **Nota:** no pude ejecutarlo en este entorno (npm no logró instalar las dependencias), por eso queda sin confirmar.

### SEG-02 · El shell de admin y el POS son "fail-open" en cliente ✔
- **Problema:** si no hay identidad o falla su lectura, el layout asume `ADMIN` y renderiza el panel completo con datos vacíos; no hay redirección al login. Solo se usa `roles[0]`. No existe `proxy.ts`/`middleware.ts`. `/pos` es una página de cliente sin ninguna comprobación.
- **Archivo y líneas:** `app/admin/layout.tsx:16-29`, `components/admin-shell.tsx:263-277`, `app/pos/page.tsx:14`.
- **Impacto:** con la sesión vencida el usuario ve el panel de administrador y cada acción falla con errores genéricos. Un usuario con varios roles ve la navegación del primero. Los permisos reales siguen en el servidor (no es una fuga de datos), pero la UI miente sobre quién es el usuario.
- **Severidad:** Alta.
- **Recomendación:** en el layout (servidor) redirigir a `/` si no hay identidad; redirigir CASHIER a `/pos`; calcular el rol efectivo con todos los roles (o el de mayor alcance) y no caer a `ADMIN`. Hacerlo con cuidado: los gates/tests dependen hoy del fallback (comentario en el layout).
- **Cómo verificarlo:** borrar cookies y abrir `/admin`; hoy muestra el panel con navegación de ADMIN.

### SEG-03 · No existe "Cerrar sesión" en la interfaz ✔
- **Problema:** el único rastro de cierre de sesión es el endpoint `/api/auth/.../sign-out`; ni el shell ni el POS tienen botón.
- **Archivo y líneas:** `app/api/auth/[...all]/route.ts:20-30` (solo servidor); búsqueda sin resultados en `components/admin-shell.tsx` y `app/pos/page.tsx`.
- **Impacto:** en cajas compartidas un cajero no puede salir; el siguiente turno opera con su identidad. Además la cola offline y el catálogo cacheado quedan en el navegador (SEG-08).
- **Severidad:** Alta.
- **Recomendación:** botón "Cerrar sesión" en el pie del sidebar y en el encabezado del POS que llame al endpoint existente y luego redirija a `/`; avisar si hay ventas en cola sin sincronizar antes de cerrar.
- **Cómo verificarlo:** buscar el botón en `/admin` y `/pos`.

### SEG-04 · No hay manejo uniforme de sesión vencida (401) ✔◐
- **Problema:** cada componente interpreta errores a su manera; un 401 termina como "Error al…", "Permisos insuficientes" o un código crudo. En el POS el replay de la cola se detiene ante cualquier error no-409 y deja la cola trabada.
- **Archivo y líneas:** `app/pos/page.tsx:41-48`; `PM:159-182`; `RM:72-84`; `app/api/admin/settings/route.ts:30-39` (devuelve 401 ante cualquier error inesperado, lo que además hace que la UI diga "sesión no autenticada" ante un fallo de servidor ◐).
- **Impacto:** el operador no sabe que debe volver a iniciar sesión; las ventas offline no se sincronizan y no hay forma de verlo.
- **Severidad:** Alta.
- **Recomendación:** un único helper `apiFetch` en cliente: ante 401 mostrar "Tu sesión venció" con enlace a `/` (conservando datos del formulario y la cola offline); mapa único código→texto.
- **Cómo verificarlo:** invalidar la cookie y enviar un formulario / abrir el POS con ventas en cola.

### SEG-05 · Mensajes crudos del backend o del navegador llegan al usuario ✔◐
- **Problema:** se interpolan `data.error`, `data.detail`, `err.message`, códigos HTTP y, cuando el proxy devuelve HTML, el `SyntaxError` de `res.json()`.
- **Archivo y líneas:** `PM:165-195`; `components/purchases/supplier-modal.tsx:52-54`; `app/pos/page.tsx:197-204`; `app/admin/error.tsx:47`; `RM:72-84,133,141-146`; `components/suppliers/supplier-manager.tsx:119-131`; `components/admin-operations/users-manager.tsx:95-102`; `settings-manager.tsx:92-106`; `weighed-barcode-manager.tsx:112-123`; `app/admin/promotions/promotion-manager.tsx:66-67,78,85,122-144`; `TF:235-240`; `TM:69-79,117-119`.
- **Impacto:** textos como `REQUEST_FAILED`, `Unexpected token '<'` o `(403 FORBIDDEN)` para personal no técnico; además `INVALID_INPUT` cae en "Verifique su conexión" (`RT:274-288`), lo que es engañoso.
- **Severidad:** Media.
- **Recomendación:** `res.json().catch(() => ({}))` siempre; mapear códigos conocidos a copy en español con acción sugerida y mostrar un mensaje genérico para el resto; nunca mostrar `err.message`.
- **Cómo verificarlo:** simular un 502 con cuerpo HTML y un 400 `REQUEST_FAILED` desde DevTools → Network.

### SEG-06 · Cabeceras de seguridad incompletas
- **Problema:** solo hay `nosniff`, `X-Frame-Options`, `Referrer-Policy` y CSP. Faltan `form-action`, `Permissions-Policy` y HSTS (este último puede resolverlo el proxy).
- **Archivo y líneas:** `next.config.ts:15-20`.
- **Impacto:** endurecimiento básico ausente; bajo riesgo directo.
- **Severidad:** Baja.
- **Recomendación:** agregar `form-action 'self'` a la CSP, `Permissions-Policy` mínima (cámara/micrófono/geolocalización vacíos) y confirmar HSTS en el proxy (`docs/deployment.md`).
- **Cómo verificarlo:** `curl -I` de producción.

### SEG-07 · Alta de usuarios: contraseña sin atributos de gestor ni confirmación ◐
- **Problema:** el campo de contraseña temporal no declara `autoComplete="new-password"` y el email no evita el autocompletado; no hay mostrar/ocultar ni confirmación; el único requisito visible es la longitud.
- **Archivo y líneas:** `components/admin-operations/users-manager.tsx:186-200,225-241`.
- **Impacto:** el navegador puede rellenar las credenciales del propio administrador al crear a otra persona; errores de tipeo en una clave que no se ve.
- **Severidad:** Media.
- **Recomendación:** `autoComplete="new-password"` / `"off"`, botón mostrar/ocultar con `aria-pressed`, campo de confirmación; la contraseña ya se limpia tras el éxito (línea 119) y no se muestra, mantener así.
- **Cómo verificarlo:** inspeccionar los inputs y probar con un navegador con contraseñas guardadas.

### SEG-08 · Datos locales del POS persisten entre usuarios ✔
- **Problema:** el catálogo cacheado (`localStorage`) y la cola de ventas (IndexedDB) no se limpian ni se asocian a un usuario.
- **Archivo y líneas:** `app/pos/page.tsx:78,95`; `src/pos/offline-queue.ts:9-19` (solo lectura, contexto).
- **Impacto:** en terminal compartida, otro cajero hereda ventas pendientes ajenas; sin cierre de sesión (SEG-03) no hay punto natural para limpiar.
- **Severidad:** Media.
- **Recomendación:** al cerrar sesión, advertir si hay cola pendiente y limpiar solo el caché de catálogo; mostrar en la UI a qué usuario pertenece cada venta en cola.
- **Cómo verificarlo:** vender sin conexión, cambiar de usuario y observar `En cola: N`.

---

## 4. Integridad de datos en pantalla (formularios y fechas)

### DAT-01 · La variante visible no coincide con la que se envía (compras y transferencias) ✔
- **Problema:** al escribir en el buscador de producto solo cambia `variantName`; el `variantId` anterior se conserva y la validación solo comprueba que no esté vacío y sea UUID válido. Si no hay nombre, el input muestra el UUID crudo.
- **Archivo y líneas:** compras `PF:133-135,569-591` (valor en 573) y `components/purchases/types.ts:315-318`; transferencias `TF:110-112,142-151` y `TY:225-229`.
- **Impacto:** el operador selecciona "Leche", edita el texto a "Yerba" y envía; se ingresa o se transfiere stock de "Leche". Es un movimiento de inventario difícil de revertir.
- **Severidad:** Crítica.
- **Recomendación:** al cambiar el texto, limpiar `variantId` y `sku`; mostrar estado "sin seleccionar" y bloquear el envío hasta elegir de la lista; nunca mostrar el UUID como valor visible (si se permite pegar un UUID, resolver su nombre antes de aceptar).
- **Cómo verificarlo:** elegir un producto, editar el texto, enviar y leer el payload en DevTools → Network: sigue conteniendo el `variantId` anterior.

### DAT-02 · Presets de reportes calculados en UTC ✔
- **Problema:** "Hoy", "Este mes" y "Últimos 7 días" usan `getUTC*` / `Date.UTC`. En Argentina (UTC-3) "Hoy" va de las 21:00 de ayer a las 21:00 de hoy; "Este mes" empieza y termina a las 21:00 del día anterior. `custom` duplica `thisMonth`. La página del servidor también usa esta función.
- **Archivo y líneas:** `RT:77-150`; `app/admin/reports/page.tsx:39-45`.
- **Impacto:** los totales mezclan ventas de ayer y omiten las últimas 3 horas del último día; los números del reporte no coinciden con la caja.
- **Severidad:** Crítica.
- **Recomendación:** calcular los límites en la zona horaria del negocio (decisión requerida: `America/Argentina/Buenos_Aires` fija o la clave `timezone` de configuración del tenant) y serializar a ISO solo al final; mostrar el rango resuelto junto al reporte.
- **Cómo verificarlo:** con reloj en Buenos Aires a las 22:00, pulsar "Hoy" y comparar `from`/`to` en la URL con `03:00Z` de hoy y de mañana; hoy son `00:00Z`.

### DAT-03 · `datetime-local` desplaza la hora 3 h en cada edición (reportes y promociones) ✔
- **Problema:** el valor se arma con `toISOString().slice(0,16)` (UTC) y se interpreta luego como hora local.
- **Archivo y líneas:** `RF:43-54,56-71`; `app/admin/promotions/promotion-manager.tsx:40-42,52-53,99-100`.
- **Impacto:** en reportes el rango real queda adulterado sin aviso; en promociones, cada "Editar → Guardar" mueve `validFrom`/`validTo` 3 h, así que una promo puede empezar o terminar a deshora.
- **Severidad:** Alta.
- **Recomendación:** guardar en el estado el texto local `YYYY-MM-DDTHH:mm` y convertir a ISO solo al enviar; formatear con getters locales (o `Intl.DateTimeFormat` con la zona del negocio).
- **Cómo verificarlo:** crear una promoción con desde 10:00, pulsar Editar y Guardar sin tocar nada y comparar el valor.

### DAT-04 · Fechas "solo día" y rangos exclusivos ✔◐
- **Problema:** `new Date("YYYY-MM-DD").toISOString()` interpreta el día como medianoche UTC (el día anterior en hora local); el rango de reportes trata `to` como exclusivo, así que elegir "hasta 31/10 00:00" excluye todo el 31; el badge de período muestra el límite exclusivo (1/11) como si fuese el fin.
- **Archivo y líneas:** `PM:139,150`; `RF:106-137`; `RT:177-183`; `components/reports/report-summary.tsx:19-22`.
- **Impacto:** fecha de emisión corrida un día en los comprobantes; reportes que pierden el último día elegido.
- **Severidad:** Media.
- **Recomendación:** usar `type="date"` en los filtros de reporte y enviar `hasta + 1 día` a las 00:00 de la zona del negocio; rotular "inclusive"; para la fecha de emisión enviar el día en la zona del negocio.
- **Cómo verificarlo:** emitir un comprobante con fecha de hoy a las 22:00 y revisar el valor guardado; consultar con "Hasta" = hoy 00:00.

### DAT-05 · Importes y cantidades sin formato es-AR ✔◐
- **Problema:** los importes se muestran con `.toString()` / interpolación (`1234567.50 ARS`), sin separador de miles ni coma decimal; las cantidades pueden traer decimales largos; `formatCurrencyAmount` devuelve "0.00" sin moneda para `null`.
- **Archivo y líneas:** `PF:708,754-766`; `PH:111-117,220-261`; `RT:261-268`; `components/reports/report-summary.tsx:35-128`; `components/reports/report-branch-detail.tsx:58-68`; `TH:104-105`.
- **Impacto:** cifras difíciles de leer y comparar en un sistema cuyo trabajo es mostrar dinero.
- **Severidad:** Media.
- **Recomendación:** un único módulo de formato (importe, cantidad, fecha, hora) con `Intl.NumberFormat("es-AR")`; AGENTS.md prohíbe `number` para dinero: los motores actuales aceptan un string decimal en `Intl.NumberFormat.format` sin pasar por float (confirmar en los navegadores objetivo); si no, formatear sobre el string.
- **Cómo verificarlo:** cargar un total ≥ 1.000 y mirar la celda.

### DAT-06 · La coma decimal es rechazada ✔ (transferencias) / ⚠ (compras)
- **Problema:** las cantidades son `type="text"` con `inputMode="decimal"` (el teclado de tablet en es-AR escribe coma) y `Decimal("1,5")` lanza; no hay normalización. En compras no hay `replace(",", ".")` en `types.ts` (sin coincidencias en la búsqueda); falta confirmar el comportamiento en ejecución. En Configuración, `intake_cap` es texto libre ("500.000,00" se acepta, ver ADM-01).
- **Archivo y líneas:** `TF:498-506`; `TY:240-247`; `PF:623-649`.
- **Impacto:** "Cantidad no válida" ante el uso más natural; bloqueo frecuente en tablet.
- **Severidad:** Alta.
- **Recomendación:** normalizar `,`→`.` al validar y al armar el payload, rechazar separadores de miles ambiguos con un mensaje claro y mostrar el formato esperado bajo el campo.
- **Cómo verificarlo:** escribir "1,5" y enviar.

### DAT-07 · La clave de idempotencia está expuesta y se puede regenerar ✔◐
- **Problema:** la clave se muestra en el formulario (y en el modal e historial de transferencias) y hay un botón "Regenerar"/"Nueva clave".
- **Archivo y líneas:** `PF:222-224,488-518`; `TF:160-165,560-587,650-651`; `TH:113-115`.
- **Impacto:** tras un corte de red donde el servidor sí procesó el pedido, regenerar la clave y reenviar crea un segundo ingreso o despacho. Además es jerga técnica para el usuario.
- **Severidad:** Alta.
- **Recomendación:** quitar el campo y el botón; generar la clave al abrir el formulario, reutilizarla en los reintentos y renovarla solo tras un éxito o al cambiar el contenido; mostrar un botón "Reintentar" que reenvíe con la misma clave.
- **Cómo verificarlo:** cortar la red al enviar, pulsar "Regenerar", reenviar con la red y comprobar que se crean dos registros.

### DAT-08 · UUID crudos pedidos o mostrados al usuario ✔◐
- **Problema:** se pide escribir UUID de ubicación (POS), lote (transferencias), operador/variante/categoría (reportes), categoría y sucursal (promociones); se muestran UUID de sucursal/variante/ubicación en historiales y como `aria-label`.
- **Archivo y líneas:** `app/pos/page.tsx:218`; `TF:439,489,635,639`; `TH:47,76,98-99,114`; `RF:195-259`; `RT:252-259`; `app/admin/promotions/promotion-manager.tsx:159-166,207-208`; `PH:107,176-179,205,218`.
- **Impacto:** nadie memoriza UUID; un error de tipeo se descubre tras el rechazo del servidor; los lectores de pantalla leen 36 caracteres.
- **Severidad:** Alta.
- **Recomendación:** reemplazar por selectores/búsquedas con datos que el frontend ya recibe (sucursales y ubicaciones vía contexto; variantes vía `/api/pos/catalog`). Donde hoy no exista fuente de datos (categorías, lotes) no inventar un contrato: ocultar el filtro avanzado o dejarlo marcado como pendiente de decisión; mientras tanto mostrar "Sucursal desconocida" en lugar del UUID y el identificador corto con el completo en un detalle.
- **Cómo verificarlo:** abrir Filtros avanzados, Promociones y el historial de transferencias.

### DAT-09 · Modal "Nuevo proveedor" conserva los datos del alta anterior ✔
- **Problema:** `SupplierModal` queda montado dentro del formulario, solo devuelve `null` al cerrar; tras guardar con éxito no se reinician los campos ni el error.
- **Archivo y líneas:** `components/purchases/supplier-modal.tsx:13-23,57-58`; montaje en `PF:792-799`.
- **Impacto:** al reabrirlo aparecen los datos del proveedor recién creado; un Enter repite el alta (duplicado).
- **Severidad:** Media.
- **Recomendación:** reiniciar el estado al cerrar o desmontar el contenido interno; confirmar antes de descartar datos tipeados.
- **Cómo verificarlo:** crear un proveedor y volver a abrir el modal.

---

## 5. POS (`app/pos/page.tsx`, `app/pos/pos.module.css`)

> El POS tiene 236 líneas, una hoja de estilos de 30 líneas y casi todo el JSX en pocas líneas largas. Es la pantalla que más importa para la operación diaria.

### POS-01 · La ubicación se escribe a mano como UUID ✔
- **Problema:** campo "Ubicación" obligatorio, validado con regex UUID; no se recuerda entre ventas ni entre sesiones; los E2E lo llenan a mano.
- **Archivo y líneas:** `app/pos/page.tsx:161,218`; `tests/e2e/pos.spec.ts:49,103`.
- **Impacto:** un cajero real no puede vender sin conocer un UUID de ubicación.
- **Severidad:** Alta (bloqueante para salida a producción).
- **Recomendación:** selector de ubicación/sucursal de los datos del usuario (decisión requerida: `/api/me` ya existe y devuelve la identidad; confirmar si incluye sucursales/ubicaciones asignadas; no inventar un contrato) y recordar la última elección en el dispositivo.
- **Cómo verificarlo:** abrir `/pos` como CASHIER.

### POS-02 · El carrito muestra UUID y no permite editar ✔
- **Problema:** cada línea guarda `label: variantId`, así que el carrito muestra el UUID en vez del nombre aunque la sugerencia tenía nombre; no hay quitar línea, cambiar cantidad, precio ni total; la confirmación dice `Venta {uuid}`.
- **Archivo y líneas:** `app/pos/page.tsx:164,199,226`.
- **Impacto:** el cajero no puede verificar qué escaneó ni corregir un error sin vaciar todo.
- **Severidad:** Alta.
- **Recomendación:** guardar el nombre/SKU de la sugerencia en `label`; botones "Quitar" y edición de cantidad por línea (con confirmación o deshacer); mostrar importes solo si ya forman parte de la respuesta del catálogo (A VERIFICAR el contrato; si no, queda como decisión de producto).
- **Cómo verificarlo:** agregar una línea y mirar el carrito.

### POS-03 · `Esc` vacía la venta sin confirmar, incluso mientras se escribe ✔
- **Problema:** el manejador global de `keydown` limpia líneas, estado y vuelto al pulsar `Escape`, sin importar el foco.
- **Archivo y líneas:** `app/pos/page.tsx:65`.
- **Impacto:** una tecla común (cerrar sugerencias, salir de un campo) destruye una venta con muchas líneas.
- **Severidad:** Alta.
- **Recomendación:** que `Esc` cierre primero las sugerencias; vaciar solo con confirmación explícita (doble `Esc` visible o diálogo) y ofrecer "Deshacer".
- **Cómo verificarlo:** agregar tres líneas, escribir en "Cantidad" y pulsar `Esc`.

### POS-04 · Búsqueda: sin combobox ARIA, sin flechas, sin Enter sobre resultados ✔
- **Problema:** el mismo input (`variant`) funciona como texto de búsqueda y como id; los resultados son botones sin `role="listbox"`/`combobox`, sin `aria-activedescendant` y sin selección con teclado; con un EAN-13 normal hay que hacer clic en el resultado.
- **Archivo y líneas:** `app/pos/page.tsx:105-158,220-221`.
- **Impacto:** incumple el requisito keyboard-first; un lector de pantalla no anuncia resultados.
- **Severidad:** Alta.
- **Recomendación:** patrón ARIA combobox (flechas, Enter selecciona el resaltado, Escape cierra, `aria-live` con la cantidad de resultados, mensaje "sin resultados"); `Enter` con un único resultado lo selecciona.
- **Cómo verificarlo:** escribir dos letras y recorrer solo con teclado.

### POS-05 · El foco no vuelve al campo de escaneo ✔
- **Problema:** tras agregar con el botón o con F4 desde otro campo, y tras confirmar la venta, no se devuelve el foco a "Variante / código".
- **Archivo y líneas:** `app/pos/page.tsx:160-171,199,220`.
- **Impacto:** con lector de códigos, la siguiente lectura se pierde o cae en otro control.
- **Severidad:** Media.
- **Recomendación:** enfocar el campo de escaneo tras agregar, tras confirmar y al cerrar mensajes.
- **Cómo verificarlo:** agregar con el botón y escanear.

### POS-06 · Pago: select sin nombre accesible, valores crudos y no se pueden quitar medios ✔
- **Problema:** el `<select>` de medio de pago no tiene etiqueta ni `aria-label`; muestra `CASH`/`TRANSFER`/`CARD`/`WALLET`; "Agregar medio" siempre agrega `CARD`; no hay "Quitar medio"; el monto solo se valida como > 0.
- **Archivo y líneas:** `app/pos/page.tsx:11,177-182,228-230`.
- **Impacto:** falla de accesibilidad básica y de comprensión; un medio agregado por error no se puede eliminar.
- **Severidad:** Media.
- **Recomendación:** etiquetas en español ("Efectivo", "Transferencia"…), `aria-label` por fila, botón "Quitar", rellenar el importe pendiente cuando el contrato lo permita.
- **Cómo verificarlo:** inspeccionar el árbol de accesibilidad.

### POS-07 · Estado único y regiones `status` duplicadas ✔
- **Problema:** hay tres `role="status"` (encabezado, vuelto y mensaje inferior); el mismo texto mezcla éxito, error e información sin distinción visual ni `role="alert"` para fallos; el vuelto se muestra crudo.
- **Archivo y líneas:** `app/pos/page.tsx:214,231,234`.
- **Impacto:** lectores de pantalla anuncian ruido; el cajero no distingue un rechazo de una confirmación.
- **Severidad:** Media.
- **Recomendación:** una región live persistente para información y un `role="alert"` para errores, con estilos por tipo; formatear importes (DAT-05).
- **Cómo verificarlo:** forzar un error de checkout y mirar el mensaje.

### POS-08 · Checkout: respuesta no JSON y doble F10 ✔
- **Problema:** `response.json()` no tiene `catch` (un 502 con HTML muestra un `SyntaxError`); `checkoutRef` se actualiza en un efecto posterior al render, así que dos F10 rápidos pueden evaluar `busy` obsoleto (mitigado por la clave idempotente); los errores se muestran como código.
- **Archivo y líneas:** `app/pos/page.tsx:177-206,208-211`.
- **Impacto:** mensajes técnicos en caja; posible doble disparo.
- **Severidad:** Media.
- **Recomendación:** `res.json().catch(() => ({}))`, un guard síncrono con `useRef` además de `busy`, y mapa de errores (SEG-05).
- **Cómo verificarlo:** responder 502 HTML desde `page.route` y pulsar F10 dos veces seguidas.

### POS-09 · Modo offline: caché de catálogo inservible y cola sin interfaz ✔
- **Problema:** (a) el "catálogo local" es el resultado de la **última búsqueda** (`setItem` sobrescribe), no un catálogo; (b) `JSON.parse` del caché sin `try/catch`; (c) la cola solo se reenvía estando en `/pos` y se dispara también desde `online` y el montaje, pudiendo duplicar el replay; (d) un 409 detiene toda la cola y solo muestra un texto, sin pantalla para ver, descartar o reintentar; (e) las ventas offline se envían con `allowUnverifiedIntake: true` fijo; (f) no hay aviso al cerrar la pestaña con ventas pendientes.
- **Archivo y líneas:** `app/pos/page.tsx:34-58,77-80,95,201-203,214`.
- **Impacto:** offline-first es solo aparente: se puede vender solo lo buscado hace un momento, y una venta en conflicto bloquea las demás sin salida visible.
- **Severidad:** Alta.
- **Recomendación:** pantalla "Cola de ventas" (estado, error, reintentar, descartar con permiso), `beforeunload` con cola pendiente, guard para un único replay, `try/catch` en el caché y límites de tamaño; para el catálogo local y `allowUnverifiedIntake` registrar una decisión de producto (qué se cachea y qué ve el cajero) antes de implementar.
- **Cómo verificarlo:** buscar un producto, cortar la red y buscar otro; vender con un 409 simulado y ver la cola.

### POS-10 · Sin sistema visual ni diseño para tablet ✔
- **Problema:** `pos.module.css` (30 líneas) no usa los tokens ni tiene `@media`; los controles dependen de `margin: 4px`; no hay botón primario destacado ni barra de pago fija; la lista de sugerencias no tiene estilos; el aspecto es distinto al del panel.
- **Archivo y líneas:** `app/pos/pos.module.css:1-30`; `app/pos/page.tsx:213-235`.
- **Impacto:** pantalla de uso intensivo, táctil y con teclado virtual sin jerarquía visual; el teclado en pantalla puede tapar "Confirmar".
- **Severidad:** Alta.
- **Recomendación:** diseñar el POS como pantalla propia: columnas (búsqueda/carrito/pago), barra de total y "Confirmar" fija, tamaños táctiles grandes, estados visibles; probarlo en 1024×768 y 1180×820.
- **Cómo verificarlo:** abrir en emulación iPad horizontal.

### POS-11 · El POS no muestra contexto ni salida ✔
- **Problema:** no se ve usuario, sucursal, caja/turno ni enlace al panel; los atajos del shell (Alt+P) llevan al POS pero no hay camino de vuelta.
- **Archivo y líneas:** `app/pos/page.tsx:213-215`.
- **Impacto:** el cajero no sabe con qué identidad ni en qué sucursal está vendiendo.
- **Severidad:** Media.
- **Recomendación:** encabezado con usuario, sucursal y estado de conexión; enlace al panel solo para roles con acceso y "Cerrar sesión" (SEG-03).
- **Cómo verificarlo:** abrir `/pos`.

### POS-12 · Campo de escaneo sin ajustes para lector de códigos y tablet ✔
- **Problema:** el input no declara `autoComplete="off"`, `inputMode`, `enterKeyHint` ni `autoCapitalize`; el teclado virtual se abre en cada foco.
- **Archivo y líneas:** `app/pos/page.tsx:220`.
- **Impacto:** el autocompletado del navegador tapa el campo y el teclado de la tablet molesta con lector físico.
- **Severidad:** Media.
- **Recomendación:** `autoComplete="off"`, `autoCapitalize="off"`, `spellCheck={false}` y un conmutador "teclado virtual" que use `inputMode="none"` cuando se escanea.
- **Cómo verificarlo:** probar con un lector USB y en una tablet.

---

## 6. Shell, navegación y páginas de admin

### NAV-01 · `/admin/cash-shifts` está en la navegación pero no existe ✔
- **Problema:** "Arqueos y Turnos" se muestra a ADMIN y SUPERVISOR (en la barra, en el tablero y en las migas), pero no hay `app/admin/cash-shifts`; tampoco hay `not-found.tsx`.
- **Archivo y líneas:** `components/admin-navigation.ts:76-82,144`; `app/admin/page.tsx:7,29-43`; listado de `app/admin/` (sin esa carpeta).
- **Impacto:** 404 para SUPERVISOR en su única función propia, además de Inicio y POS.
- **Severidad:** Alta.
- **Recomendación:** ocultar el ítem hasta que exista o publicar una página "Próximamente" con estado vacío; agregar `app/not-found.tsx` en español con enlaces útiles.
- **Cómo verificarlo:** entrar como SUPERVISOR y pulsar "Arqueos y Turnos".

### NAV-02 · Nueve atajos anunciados no existen y varios chocan ✔◐
- **Problema:** la barra lateral muestra `Alt+C/V/T/R/N/U/G/B/S`, pero el shell solo implementa `Alt+H/P/M/K`. Además Alt+N/Alt+G (navegación) son distintos de Alt+N/Alt+G que usan Usuarios y Configuración, y Alt+C/E/L (reportes), Alt+N/A/G/S (compras), Alt+N/D (transferencias) y Alt+N/F (proveedores) usan `window` sin guardas. Todos usan `event.key`, que en macOS con Option produce otro carácter.
- **Archivo y líneas:** `components/admin-navigation.ts:18,25,32,39,46,53,60,67,74,81,88,115-121`; `components/admin-shell.tsx:67-82,143-145`; `PF:259-276`; `TF:185-200`; `RM:198-216`; `components/suppliers/supplier-manager.tsx:42-69`; `components/admin-operations/users-manager.tsx:42-55`; `settings-manager.tsx:40-53`.
- **Impacto:** la promesa "keyboard-first" no se cumple y el mismo atajo hace cosas distintas según la pantalla; Alt+D es además el atajo del navegador para la barra de direcciones.
- **Severidad:** Alta.
- **Recomendación:** un único registro de atajos con ámbito (global/pantalla/diálogo); navegación global con un esquema que no choque (p. ej. secuencia "g" + letra) y acciones de pantalla con otro prefijo; usar `event.code`, ignorar `event.repeat`, respetar `defaultPrevented`, el foco en campos y los diálogos abiertos; mostrar en pantalla solo atajos reales.
- **Cómo verificarlo:** en `/admin/settings` pulsar Alt+G (enfoca el valor en vez de ir a Configuración); en macOS probar Option+N.

### NAV-03 · El encabezado siempre dice "Sin sucursales asignadas" ✔
- **Problema:** el layout no pasa `branches` ni `tenantName` al shell; el selector de sucursal (cuando existe) cambia solo un estado local que nadie lee.
- **Archivo y líneas:** `app/admin/layout.tsx:29`; `components/admin-shell.tsx:34,187-209`.
- **Impacto:** mensaje falso para todos los usuarios; si se llenara, el selector parecería filtrar datos y no lo haría.
- **Severidad:** Media.
- **Recomendación:** pasar sucursales (el servidor ya obtiene el contexto en cada página) o quitar el bloque; si se mantiene el selector, propagarlo por contexto a los módulos.
- **Cómo verificarlo:** abrir `/admin`.

### NAV-04 · Redirección por rol y jerga en etiquetas ✔
- **Problema:** el login siempre navega a `/admin`; CASHIER aterriza en "Acceso no autorizado"; la insignia de rol muestra el enum (`STOCK_MANAGER`) y la descripción usa "Tenant-wide".
- **Archivo y líneas:** `components/auth/login-form.tsx:42`; `components/admin-shell.tsx:215-220,263-274`; `components/admin-navigation.ts:92-113`.
- **Impacto:** el cajero ve un error en su primer paso del día.
- **Severidad:** Media.
- **Recomendación:** que el servidor redirija por rol (SEG-02) o consultar `/api/me` tras el login; etiquetas en español para roles y alcance.
- **Cómo verificarlo:** iniciar sesión como CASHIER.

### NAV-05 · Drawer de tablet: cerrado sigue en el orden de tabulación ✔
- **Problema:** en ≤1024 px el menú se oculta solo con `transform`; no hay `inert`/`visibility:hidden`, ni foco inicial/retorno, ni trampa de foco al abrirlo.
- **Archivo y líneas:** `components/admin-shell.module.css:457-466`; `components/admin-shell.tsx:109-162`.
- **Impacto:** con teclado externo en tablet, `Tab` recorre enlaces invisibles; al abrir, el foco no entra al menú.
- **Severidad:** Alta.
- **Recomendación:** marcar el aside como `inert` (o `visibility:hidden`) cuando está cerrado en modo drawer; al abrir, enfocar el primer enlace; al cerrar, devolver el foco al botón de menú.
- **Cómo verificarlo:** a 820 px, `Tab` desde el principio de la página.

### NAV-06 · Diálogo de atajos sin gestión de foco ✔
- **Problema:** se abre sin mover el foco, sin trampa ni retorno; usa `h3` sin un `h2` previo; el contenedor del foco es la página.
- **Archivo y líneas:** `components/admin-shell.tsx:282-328`.
- **Impacto:** el foco queda detrás del diálogo; un lector de pantalla no lo anuncia como modal real.
- **Severidad:** Media.
- **Recomendación:** componente `Modal` compartido (ver A11Y-02).
- **Cómo verificarlo:** abrir con `?` y pulsar `Tab`.

### NAV-07 · Ítem activo solo en coincidencia exacta ✔
- **Problema:** `pathname === item.href` deja sin resaltar las rutas anidadas.
- **Archivo y líneas:** `components/admin-shell.tsx:131`.
- **Impacto:** la ubicación se pierde en subrutas futuras.
- **Severidad:** Baja.
- **Recomendación:** comparar por prefijo de segmento.
- **Cómo verificarlo:** abrir una subruta.

### NAV-08 · Cabecera de altura fija en tablet ⚠
- **Problema:** `.header` tiene `height: 64px` hasta 640 px, pero `.headerRight` hace `flex-wrap`; entre 640 y 1024 px con selector, rol y ayuda puede desbordar.
- **Archivo y líneas:** `components/admin-shell.module.css:175-184,209-214,483-489`.
- **Impacto:** controles superpuestos o recortados en tablet vertical.
- **Severidad:** Media.
- **Recomendación:** `min-height` en lugar de `height` y reorganizar el contenido en una línea de 1024 a 768.
- **Cómo verificarlo:** 768×1024 con sucursales cargadas.

### NAV-09 · `<main>` anidado y landmarks incorrectos ✔◐
- **Problema:** el shell ya define `<main id="admin-main">`; compras, transferencias y promociones agregan otro; compras además le da `role="region"` y usa `<aside>` (landmark complementario) para un aviso de éxito.
- **Archivo y líneas:** `components/admin-shell.tsx:262`; `PM:234,308,331`; `TM:220,233`; `app/admin/promotions/promotion-manager.tsx:151,220`.
- **Impacto:** dos landmarks principales; la navegación por regiones se vuelve ambigua.
- **Severidad:** Media.
- **Recomendación:** `<section aria-labelledby>` o `<div>`; el aviso de éxito va en una región `role="status"`.
- **Cómo verificarlo:** `document.querySelectorAll('main').length` en esas rutas (hoy 2).

### NAV-10 · Metadatos y títulos ✔
- **Problema:** la descripción global es "Retail foundation scaffold"; el POS no define título propio.
- **Archivo y líneas:** `app/layout.tsx:5-8`; `app/pos/page.tsx:1`.
- **Impacto:** pestañas con título genérico, difícil de distinguir con varias abiertas.
- **Severidad:** Baja.
- **Recomendación:** título por ruta ("POS — Supermercado") y una descripción real.
- **Cómo verificarlo:** mirar la pestaña de `/pos`.

---

## 7. Formularios y acciones

### FRM-01 · Errores de campo sin asociación ni foco ✔◐
- **Problema:** los `<span class="errorText">` no tienen `id`; los campos no tienen `aria-describedby` (solo algunos `aria-invalid`); tras validar no se mueve el foco al primer error; el texto de ayuda tampoco está asociado; los errores no se limpian al corregir; los asteriscos de "obligatorio" son CSS sin texto accesible.
- **Archivo y líneas:** `PF:340-350,380,415,617-648`; `TF:437-482,487-509,557`; `RF:121-123,139-141`; `components/suppliers/supplier-manager.tsx:86-89,304-308,445`; `components/admin-operations/users-manager.tsx:201,219,240,260,281`; `settings-manager.tsx:227-228`; `weighed-barcode-manager.tsx:229,246,264,284,302`; `components/auth/login-form.tsx:77`.
- **Impacto:** quien usa teclado o lector de pantalla no sabe qué campo falló; en tablet el error queda fuera de la vista.
- **Severidad:** Alta.
- **Recomendación:** componente `Field` compartido (etiqueta, ayuda, error con `id`, `aria-describedby`, `aria-invalid`, `aria-required`); al enviar con errores, enfocar el primer campo inválido y resumir los errores en un `role="alert"`; no deshabilitar el envío por campos vacíos (en proveedores el mensaje es inalcanzable con el botón deshabilitado).
- **Cómo verificarlo:** enviar un formulario vacío y observar a dónde va el foco.

### FRM-02 · Doble envío por atajo ✔◐
- **Problema:** el atajo de enviar llama a `handleSubmit` con un evento falso sin comprobar `isSubmitting`; en reportes, `Alt+C`/`Alt+E` se disparan aunque haya una consulta en curso; mantener la tecla repite.
- **Archivo y líneas:** `PF:226-256,259-276`; `TF:185-200,596`; `RM:198-216`.
- **Impacto:** la segunda llamada comparte la clave de idempotencia y puede mostrar "Conflicto de idempotencia" después de un éxito (`PM:168-169`); en reportes se pisan respuestas (EST-07).
- **Severidad:** Media.
- **Recomendación:** guard síncrono (`useRef`) y `if (isSubmitting || e.repeat) return`; tratar el "mismo registro ya creado" como éxito en la UI cuando el contrato lo indique.
- **Cómo verificarlo:** mantener `Alt+G` pulsado al enviar.

### FRM-03 · Pérdida de datos al cambiar de pestaña, cerrar o recargar ✔◐
- **Problema:** compras y transferencias montan el formulario o el historial de forma condicional; al cambiar de pestaña se pierden líneas, motivo y clave. No hay aviso de cambios sin guardar en ningún formulario ni al cerrar modales con datos.
- **Archivo y líneas:** `PM:308-330`; `TM:221-232`.
- **Impacto:** el operador que carga 20 líneas y mira "Historial" las pierde.
- **Severidad:** Alta.
- **Recomendación:** mantener ambos paneles montados con `hidden` o elevar el estado del formulario; `beforeunload` con cambios pendientes; guardar un borrador local opcional.
- **Cómo verificarlo:** cargar tres líneas, ir a "Historial" y volver.

### FRM-04 · Acciones de alto impacto sin confirmación ni deshacer ✔◐
- **Problema:** desactivar una promoción, crear usuarios ADMIN, guardar la configuración de balanza (afecta el escaneo del POS) o cambiar moneda/tope se hacen con un clic; en compras "Registrar" ingresa stock directamente mientras transferencias sí confirma; eliminar una línea no tiene deshacer.
- **Archivo y líneas:** `app/admin/promotions/promotion-manager.tsx:134-148,212`; `users-manager.tsx:247-259,286-292`; `weighed-barcode-manager.tsx:83-131,306-314`; `settings-manager.tsx:253-259`; `PF:729-738,780-787`; `TF:512-532`.
- **Impacto:** errores irreversibles por un toque accidental en tablet.
- **Severidad:** Media.
- **Recomendación:** diálogo de confirmación que nombre el objeto ("Desactivar «2×1 Bebidas»") y resumen previo en compras, balanza y rol ADMIN; "Deshacer" en eliminar línea.
- **Cómo verificarlo:** pulsar "Desactivar" y ver que actúa de inmediato.

### ADM-01 · Configuración: texto libre sin validación y valor de otro preset ◐
- **Problema:** todas las claves son texto libre (200 caracteres); `intake_cap`, `timezone` y `fiscal_currency` solo tienen placeholder; al cambiar de preset no se limpia el valor ("500000.00" puede guardarse como zona horaria); no se muestra el valor actual.
- **Archivo y líneas:** `components/admin-operations/settings-manager.tsx:19-25,179,215-226,253-259`.
- **Impacto:** configuración errónea aceptada y auditada.
- **Severidad:** Alta.
- **Recomendación:** validadores por clave (decimal con `inputMode="decimal"`, zona horaria de `Intl.supportedValuesOf('timeZone')`, moneda ISO de 3 letras), resetear el valor al cambiar de preset, mostrar el formato esperado y el valor vigente (solo si ya se puede leer sin nuevo contrato).
- **Cómo verificarlo:** elegir `intake_cap`, escribir "abc" y enviar.

### ADM-02 · Balanza: el simulador valida de más y de menos ◐
- **Problema:** el simulador marca "Descomposición correcta" sin validar el dígito verificador EAN-13; el ejemplo por defecto `2012345005007` tiene un dígito verificador incorrecto; el botón Guardar queda deshabilitado sin explicar el motivo cerca; los inputs numéricos fuerzan 1 al borrar.
- **Archivo y líneas:** `components/admin-operations/weighed-barcode-manager.tsx:25,66,75,203-209,258,278,296,306-314,340-365`.
- **Impacto:** falsa confirmación en una configuración que impacta el escaneo en caja.
- **Severidad:** Media.
- **Recomendación:** calcular el dígito verificador en el cliente y avisar "dígito inválido (esperado N)"; cambiar el ejemplo; explicar por qué Guardar está deshabilitado con `aria-describedby`.
- **Cómo verificarlo:** abrir la pantalla con el valor por defecto.

### ADM-03 · Promociones: sin estilos del sistema, sin validación, sin foco ◐
- **Problema:** `promotion-manager` es HTML sin clases (botones, checkbox y tabla con tamaño nativo, sin scroll horizontal); no valida N>M ni desde≤hasta; "Editar" no mueve el foco ni hace scroll al formulario; los botones repetidos "Editar"/"Desactivar" no nombran la promoción; la página no exporta `metadata`; el estado mezcla carga, éxito y error (y si falla la lista dice "No hay promociones configuradas").
- **Archivo y líneas:** `app/admin/promotions/promotion-manager.tsx:61,77-79,84-86,90-103,124-128,150-221`; `app/admin/promotions/page.tsx:1-5`.
- **Impacto:** la pantalla más "cruda" del admin, con objetivos táctiles pequeños y reglas inválidas que solo rechaza el servidor.
- **Severidad:** Alta.
- **Recomendación:** reutilizar las clases de `admin-operations.module.css`, `aria-label="Editar {nombre}"`, enfocar el primer campo al editar, validar reglas simples en cliente y separar los estados de lista y de guardado.
- **Cómo verificarlo:** abrir `/admin/promotions` a 768 px y medir los botones.

### ADM-04 · El foco se pierde tras guardar (campos `disabled`) ◐
- **Problema:** `focus()` se llama mientras los inputs siguen `disabled={isSubmitting}`; el foco cae a `body`; en promociones el botón "Desactivar" desaparece al pulsarlo.
- **Archivo y líneas:** `users-manager.tsx:121,124-126,199`; `settings-manager.tsx:120,123-125,225`; `promotion-manager.tsx:212`.
- **Impacto:** quien usa teclado pierde su posición en cada alta o guardado.
- **Severidad:** Media.
- **Recomendación:** usar `aria-disabled`/`readOnly` durante el envío o enfocar en un efecto cuando `isSubmitting` pasa a `false`; devolver el foco a un elemento estable.
- **Cómo verificarlo:** enviar con Enter y comprobar `document.activeElement === document.body`.

### ADM-05 · Usuarios: listas de sesión y roles con jerga ◐
- **Problema:** la tabla de "creados" es solo estado local y se pierde al recargar (puede confundirse con un directorio); muestra la hora sin fecha; roles y alcance con enums y "Tenant-wide".
- **Archivo y líneas:** `users-manager.tsx:38,112,254-258,274,297-337`; `settings-manager.tsx:114,264-298`.
- **Impacto:** confusión sobre qué usuarios existen y qué rol se asigna.
- **Severidad:** Baja.
- **Recomendación:** rotular "Creados en esta sesión", `<caption>`/`scope`, etiquetas de rol en español con descripción y aviso al elegir un rol no-ADMIN sin sucursal.
- **Cómo verificarlo:** crear un usuario y recargar.

---

## 8. Accesibilidad y teclado

### A11Y-01 · Combobox/listbox sin ARIA ni teclado (compras, transferencias, POS) ✔◐
- **Problema:** los inputs de búsqueda no son `role="combobox"` ni tienen `aria-expanded`/`aria-controls`/`aria-activedescendant`; los `<li role="option">` solo responden a clic, con `aria-selected="false"` fijo; el estado "Buscando…" no es una región live; no hay flechas ni Escape propio.
- **Archivo y líneas:** `PF:569-616`; `TF:435-478`; `app/pos/page.tsx:221`; estilos de foco en `components/purchases/purchases.module.css:316-323`, `components/transfers/transfers.module.css:298-304`.
- **Impacto:** inutilizable con teclado y lector de pantalla en la tarea más repetida.
- **Severidad:** Alta.
- **Recomendación:** un único componente `ProductCombobox` con el patrón ARIA (flechas, Enter, Escape, `aria-live`), que sirva a compras, transferencias y POS.
- **Cómo verificarlo:** navegar solo con teclado; probar con NVDA/VoiceOver.

### A11Y-02 · Modales sin trampa de foco, foco inicial, retorno ni Escape ✔◐
- **Problema:** el modal de proveedor no tiene manejo de Escape; los modales de detalle de compra, confirmación de transferencia (con `autoFocus` en "Confirmar y Despachar") y alta de proveedor tampoco gestionan foco ni inertizan el fondo; Escape cierra incluso con envío en curso.
- **Archivo y líneas:** `components/purchases/supplier-modal.tsx:66-67`; `PH:137-144`; `TF:193-196,604-677`; `components/suppliers/supplier-manager.tsx:42-69,278-285`; `components/admin-shell.tsx:282-328`.
- **Impacto:** `Tab` sale al fondo; al cerrar se pierde el foco; la acción destructiva queda como foco inicial.
- **Severidad:** Alta.
- **Recomendación:** un componente `Modal` basado en `<dialog>` con `showModal()` (trampa de foco, Escape y fondo inerte nativos) que guarde y restaure el elemento activo, enfoque el título o "Cancelar" y bloquee cierre durante el envío.
- **Cómo verificarlo:** abrir cada modal y pulsar `Tab` diez veces.

### A11Y-03 · Pestañas sin patrón ARIA ✔◐
- **Problema:** compras usa botones con `aria-current` dentro de un `<nav>`; transferencias usa `role="tab"` sin `tablist`/`tabpanel`/`aria-controls` ni flechas.
- **Archivo y líneas:** `PM:284-305`; `TM:196-220`.
- **Impacto:** semántica inconsistente y sin el comportamiento de teclado esperado.
- **Severidad:** Media.
- **Recomendación:** componente `Tabs` con `tablist`/`tab`/`tabpanel`, `aria-selected`, roving tabindex y flechas.
- **Cómo verificarlo:** árbol de accesibilidad de DevTools.

### A11Y-04 · Contraste insuficiente en el color de marca ✔◐
- **Problema:** texto blanco sobre `#0284c7` da 4,10:1 (cálculo propio) y se usa en botones primarios, enlaces y títulos de tarjeta; otros pares: `#059669` con blanco ≈3,8:1, `#d97706` ≈3,2:1, `#94a3b8` sobre blanco ≈2,6:1.
- **Archivo y líneas:** `app/globals.css:10`; `components/auth/login-form.module.css:26-35`; `components/reports/reports.module.css:274-281`; `components/admin-operations/admin-operations.module.css:171-172,365-379`; `app/admin/admin-dashboard.module.css:52-57`; `components/transfers/transfers.module.css:263`.
- **Impacto:** no cumple WCAG 1.4.3 (AA) en la acción principal de casi cada pantalla.
- **Severidad:** Media.
- **Recomendación:** oscurecer `--color-primary` (p. ej. el valor de hover `#0369a1`) y los verdes/ámbar, y reemplazar literales por tokens.
- **Cómo verificarlo:** axe/Lighthouse sobre login, compras y reportes.

### A11Y-05 · Indicadores de foco debilitados ✔◐
- **Problema:** varias reglas quitan el `outline` global (`.input:focus`, `.tableInput:focus`, opciones de listas) y lo reemplazan por un borde y una sombra de baja opacidad; el contenedor de presets con `overflow:hidden` recorta el foco; algunos `:hover`/`:focus` de opciones usan un fondo casi blanco.
- **Archivo y líneas:** `components/purchases/purchases.module.css:206-212,274-280,316-323`; `components/transfers/transfers.module.css:176-189,298-304`; `components/reports/reports.module.css:113-144`; `app/globals.css:43-46`.
- **Impacto:** en un flujo keyboard-first el elemento activo puede ser casi invisible.
- **Severidad:** Media.
- **Recomendación:** mantener el anillo global (`:focus-visible`, 2 px) y no anularlo; para opciones de lista, resaltado con contraste ≥3:1.
- **Cómo verificarlo:** recorrer los formularios con `Tab`.

### A11Y-06 · Nombres accesibles, emojis y botones repetidos ✔◐
- **Problema:** emojis decorativos sin `aria-hidden` (🛒, ⌨️, 🧾, 📋); el botón de duplicar línea es solo un emoji; "Ver detalle", "Editar" y "Desactivar" se repiten sin indicar el objeto; el `aria-label` de "Exportar" no contiene el texto visible; el de "Despachar" tapa "Despachando…".
- **Archivo y líneas:** `components/admin-shell.tsx:116,231`; `PH:23,120-127`; `PF:714-728`; `RF:274-282`; `TF:597-600,642`.
- **Impacto:** nombres poco útiles o contradictorios con lo que se ve (WCAG 2.5.3).
- **Severidad:** Media.
- **Recomendación:** `aria-hidden` en emojis, iconos SVG con texto oculto, `aria-label="Ver detalle del comprobante FAC-…"`, y etiquetas que contengan el texto visible.
- **Cómo verificarlo:** revisar el árbol de accesibilidad.

### A11Y-07 · Tablas sin `caption`/`scope` y contenedores con scroll no enfocables ◐
- **Problema:** varias tablas no tienen `<caption>` ni `scope`; los nombres de fila son `<td>` en vez de `<th scope="row">`; los contenedores con `overflow-x:auto` no tienen `tabindex`, `role="region"` ni nombre; no hay orden por columna ni paginación.
- **Archivo y líneas:** `components/reports/report-summary.tsx:31-131`; `components/reports/report-branch-detail.tsx:33-47`; `components/suppliers/supplier-manager.tsx:218-229`; `PH:64-134`.
- **Impacto:** con teclado no se puede desplazar una tabla ancha; un lector de pantalla no asocia nombre y valor.
- **Severidad:** Baja.
- **Recomendación:** `<caption>` visible o `sr-only`, `scope`, contenedor `tabIndex={0}` con `role="region"` y `aria-label`; `aria-sort` si se agrega orden.
- **Cómo verificarlo:** `Tab` hasta una tabla ancha a 768 px.

### A11Y-08 · Regiones live y avisos mal planteados ✔◐
- **Problema:** regiones `role="status"` que se montan ya con su contenido (pueden no anunciarse); `role="alert"` junto a `aria-live="assertive"` (redundante); `aria-busy` fijo en un nodo que se desmonta; el reporte anterior desaparece al recargar.
- **Archivo y líneas:** `PM:226,233-237`; `components/reports/reports-manager.tsx:274-292`; `components/admin-operations/users-manager.tsx:165-175`; `settings-manager.tsx:151-161`; `weighed-barcode-manager.tsx:153-163`; `app/admin/loading.tsx:5-8`.
- **Impacto:** resultados y errores que un lector de pantalla no anuncia.
- **Severidad:** Media.
- **Recomendación:** una región live persistente en cada módulo (siempre en el DOM) y mantener el contenido anterior visible con `aria-busy` mientras recarga.
- **Cómo verificarlo:** consultar con NVDA/VoiceOver y escuchar qué se anuncia.

### A11Y-09 · Movimiento reducido y temas ✔
- **Problema:** no existe ningún `prefers-reduced-motion`, `prefers-color-scheme` ni `forced-colors` (búsqueda sin resultados en `app/` y `components/`).
- **Archivo y líneas:** `app/admin/loading.tsx:26`; `components/reports/reports.module.css:492-499`; `app/admin/admin-dashboard.module.css:42-50`.
- **Impacto:** animaciones forzadas y sin modo de alto contraste.
- **Severidad:** Baja.
- **Recomendación:** `@media (prefers-reduced-motion: reduce)` global y evaluar tema oscuro/alto contraste cuando se unifiquen los tokens (VIS-01).
- **Cómo verificarlo:** activar "reducir movimiento" en el sistema operativo.

---

## 9. Responsive y tablet

### RSP-01 · Tabla de líneas de compra de 1180 px mínimos ✔
- **Problema:** las columnas fijadas por estilos inline suman 35+260+110+120+95+100+120+130+120+90 = **1180 px**; el área útil con sidebar es ≈862 px en iPad horizontal (1180) y ≈772 px en vertical (820).
- **Archivo y líneas:** `PF:539-554`; `components/purchases/purchases.module.css:232-237`.
- **Impacto:** scroll horizontal anidado en el formulario más usado por STOCK_MANAGER en tablet; inputs y dropdown recortados (RSP-04).
- **Severidad:** Alta.
- **Recomendación:** en ≤1180 px pasar a "tarjeta por línea" (campos apilados en dos columnas) o reducir columnas por defecto y dejar IVA/lote/vencimiento en un panel expandible; mover los anchos a CSS.
- **Cómo verificarlo:** emular 820×1180 y 1180×820 en `/admin/purchases`.

### RSP-02 · Breakpoints inconsistentes y ninguno pensado para tablet horizontal ✔
- **Problema:** cada módulo usa su propio punto (640, 760, 768, 900, 1024) y ninguno apunta a 1180/1194; el sidebar fijo de 270 px recorta el contenido entre 1025 y 1280 px.
- **Archivo y líneas:** `app/page.module.css:94`; `components/admin-shell.module.css:457,483`; `components/admin-operations/admin-operations.module.css:103`; `components/purchases/purchases.module.css:514,524`; `components/reports/reports.module.css:507`; `components/suppliers/suppliers.module.css:254`; `components/transfers/transfers.module.css:499`.
- **Impacto:** comportamiento distinto en cada pantalla a un mismo ancho.
- **Severidad:** Media.
- **Recomendación:** definir breakpoints comunes (≈768, 1024, 1180) y una matriz de pruebas: 768×1024, 820×1180, 1024×768, 1180×820.
- **Cómo verificarlo:** recorrer cada módulo en esos cuatro tamaños.

### RSP-03 · Objetivos táctiles menores de 44 px ✔◐
- **Problema:** `globals.css` fija `min-height: 44px` en botones y campos, pero los estilos inline y de módulo lo pisan: `minHeight: 30/32/36px`, `.input` con `min-height: 40px`, botones de solo texto con `padding: 0` ("+ Nuevo", "Regenerar"), botones ✕/📋 de fila con `padding: 2px 6px`, presets y toggles de reportes de ≈30 px, checkbox de 18 px.
- **Archivo y líneas:** `PF:317-332,493-508,533,714-738`; `PM:243-256,275`; `PH:57,124`; `components/purchases/supplier-modal.tsx:78`; `components/purchases/purchases.module.css:202`; `components/suppliers/supplier-manager.tsx:298,423`; `components/reports/reports.module.css:120-130,164-174,193-205,234-248,305-314,527-532`; `components/transfers/transfers.module.css:79-93,162-174,317-329`; `TM:173,181`.
- **Impacto:** toques errados en tablet, con eliminar al lado de duplicar sin deshacer (`TF:512-532`).
- **Severidad:** Alta.
- **Recomendación:** una única fuente de verdad (`--min-touch-target`) aplicada por clases (no inline), separación mínima de 8 px entre acciones, áreas clicables ≥44 px para checkbox/radio (y no aplicar `min-height` global a `input[type=checkbox|radio]`).
- **Cómo verificarlo:** emulador de iPad y medir con `getBoundingClientRect`.

### RSP-04 · Desplegable de resultados recortado por `overflow` ✔◐
- **Problema:** el listado de resultados se posiciona en `absolute` dentro de un contenedor con `overflow-x:auto` (que fuerza `overflow-y` a `auto`), así que se recorta o genera scroll interno; en la primera fila el listado (hasta 200–220 px) supera la altura de la tabla.
- **Archivo y líneas:** `components/purchases/purchases.module.css:232-237,286-310`; `components/transfers/transfers.module.css:232-237,276-289`; `PF:567-619`; `TF:407,434-478`.
- **Impacto:** las últimas opciones son inalcanzables; con el teclado virtual el problema empeora.
- **Severidad:** Alta.
- **Recomendación:** renderizar el listado en un portal con `position: fixed` calculado desde el input, o cambiar a tarjetas por línea (RSP-01) y eliminar el contenedor con scroll.
- **Cómo verificarlo:** una sola línea y un término con ≥8 resultados.

### RSP-05 · Detalles de viewport y atajos en táctil ✔◐
- **Problema:** `min-height: 100vh` (en iPad Safari la barra de herramientas altera el alto); el modal de atajos se centra con `top:50%` + `transform` (se desborda con teclado virtual); la barra de atajos se muestra también en dispositivos sin teclado.
- **Archivo y líneas:** `app/page.module.css:2`; `components/admin-shell.module.css:3,389-402`; `PM:214-222`; `components/suppliers/supplier-manager.tsx:182-198`.
- **Impacto:** saltos de layout y ruido visual en tablet.
- **Severidad:** Baja.
- **Recomendación:** usar `dvh` con respaldo, modales con `max-height` y scroll interno, ocultar la barra de atajos con `@media (hover: none), (pointer: coarse)`.
- **Cómo verificarlo:** abrir en una tablet real o emulación táctil.

---

## 10. Estados de UI (carga, vacío, error, éxito, deshabilitado)

### EST-01 · Errores de carga que se muestran como "no hay datos" ✔◐
- **Problema:** `catch` vacíos o `.catch(() => [])` / `.catch(() => null)` en las páginas del servidor y en los clientes hacen que un fallo se vea como lista vacía o como "Presione Consultar"; proveedores muestra "No hay proveedores registrados" y "Crear primer proveedor"; configuración y balanza muestran valores por defecto como si fueran los guardados.
- **Archivo y líneas:** `app/admin/suppliers/page.tsx:18,29`; `app/admin/reports/page.tsx:26,45,50`; `app/admin/transfers/page.tsx:26-28`; `app/admin/purchases/page.tsx:32-36,117-119`; `app/admin/users/page.tsx:13-25`; `app/admin/settings/page.tsx:13-25`; `app/admin/weighed-barcode/page.tsx:16-36`; `PM:89-102,104-122`; `TF:126-138`; `PF:150-164`; `promotion-manager.tsx:77-79,197`.
- **Impacto:** si falla la base o un permiso, el operador cree que no hay datos y vuelve a cargarlos (duplicados) o sobrescribe una configuración real con los valores por defecto.
- **Severidad:** Alta.
- **Recomendación:** patrón común: las páginas pasan `initialError` (ya existe en `ReportsManager`, `RM:25,37`), los clientes mantienen estados `loading | error | empty | data`, banner `role="alert"` con "Reintentar" y en pantallas de configuración deshabilitar el guardado cuando la carga falló.
- **Cómo verificarlo:** forzar un 500 en `/api/pos/catalog`, `/api/admin/context` o dejar `DATABASE_URL` vacío.

### EST-02 · Listados que nunca se refrescan ✔◐
- **Problema:** el historial de transferencias y la lista de proveedores son una instantánea del render inicial más lo creado en la sesión; no hay "Actualizar" ni reintento; en compras el refresco existe pero falla en silencio.
- **Archivo y líneas:** `TM:24,115`; `TH:28-123`; `components/suppliers/supplier-manager.tsx:22,145,254-271`; `PM:104-122`.
- **Impacto:** no se ven los movimientos de otras personas; si falló el render inicial, el historial queda vacío de forma permanente.
- **Severidad:** Media.
- **Recomendación:** botón "Actualizar" con estados de carga y error (solo con endpoints de listado ya existentes; confirmar cuáles en `app/api`).
- **Cómo verificarlo:** crear un registro desde otro navegador.

### EST-03 · Estados de carga inconsistentes ✔◐
- **Problema:** cada `loading.tsx` es distinto (spinner, skeleton de anchos fijos 280/400 px, solo texto) y varios usan estilos inline y `<style>`; ninguno respeta movimiento reducido.
- **Archivo y líneas:** `app/admin/loading.tsx:5-37`; `app/admin/reports/loading.tsx:9-30`; `app/admin/purchases/loading.tsx:9-41`; `app/admin/{settings,users,suppliers,weighed-barcode}/loading.tsx:3-9`.
- **Impacto:** transiciones desparejas y posible desborde en pantallas angostas.
- **Severidad:** Media.
- **Recomendación:** un componente `PageSkeleton` en CSS Modules con anchos relativos y `prefers-reduced-motion`.
- **Cómo verificarlo:** navegar entre módulos con la red limitada.

### EST-04 · Avisos de éxito sin destino claro ✔◐
- **Problema:** el aviso de compra registrada usa un `<aside>` con estilos inline y un botón ✕ sin tamaño; el de proveedores se descarta solo con `Escape` global; ningún aviso mueve el foco ni desaparece solo; el formulario se reinicia sin más explicación.
- **Archivo y líneas:** `PM:233-281`; `components/suppliers/supplier-manager.tsx:52-59,182-198`.
- **Impacto:** poca claridad sobre qué pasó y qué hacer después.
- **Severidad:** Media.
- **Recomendación:** componente `Alert` compartido con botón "Cerrar" de 44 px, región live persistente y, al éxito, enfoque del aviso o del primer campo del siguiente registro.
- **Cómo verificarlo:** registrar una compra y observar el foco.

### EST-05 · Estados vacíos duplicados y un componente sin uso ◐
- **Problema:** `components/empty-state.tsx` no lo importa ningún archivo; reportes, sucursales y proveedores implementan su propio vacío con CSS y encabezados distintos.
- **Archivo y líneas:** `components/empty-state.tsx:1-47`; `components/reports/reports-manager.tsx:294-301`; `components/reports/report-branch-detail.tsx:17-23`; `components/suppliers/supplier-manager.tsx:231-252`; `PH:20-43`.
- **Impacto:** inconsistencia visual y semántica.
- **Severidad:** Baja.
- **Recomendación:** usar `EmptyState` (con nivel de encabezado configurable) en todos los vacíos.
- **Cómo verificarlo:** `grep -rn EmptyState app components`.

### EST-06 · Botones deshabilitados sin explicar por qué ✔◐
- **Problema:** "Guardar" (proveedores, balanza) y "Confirmar" (POS) se deshabilitan sin decir qué falta; en compras la razón existe solo para "sin sucursales".
- **Archivo y líneas:** `components/suppliers/supplier-manager.tsx:86-89,445`; `weighed-barcode-manager.tsx:306-314`; `app/pos/page.tsx:230`.
- **Impacto:** el usuario no sabe cómo avanzar.
- **Severidad:** Media.
- **Recomendación:** no deshabilitar por campos vacíos (validar al enviar) o asociar el motivo con `aria-describedby`.
- **Cómo verificarlo:** abrir cada formulario vacío.

### EST-07 · Condiciones de carrera en búsquedas y consultas ✔◐
- **Problema:** las búsquedas con debounce y las consultas de reporte no cancelan la solicitud anterior (sin `AbortController`); `searchResults` e `isSearchingCatalog` son únicos para todas las líneas; el `finally` apaga `isLoading` al terminar cualquiera.
- **Archivo y líneas:** `PF:132-167`; `TF:49-52,110-140`; `RM:66-87,116-152`.
- **Impacto:** una respuesta lenta pisa a una nueva; pueden elegirse sugerencias de otra línea o quedar visible el reporte del filtro anterior.
- **Severidad:** Media.
- **Recomendación:** un hook `useFetch`/`useAbortableRequest` con `AbortController`, contador de solicitud y resultados por línea.
- **Cómo verificarlo:** limitar la red y lanzar dos consultas seguidas; resolverlas en orden inverso.

### EST-08 · Fechas con zona horaria del navegador y posible desajuste de hidratación ⚠
- **Problema:** `toLocaleString("es-AR")` sin `timeZone` se evalúa primero en el servidor (UTC) y luego en el cliente (UTC-3), tanto en historiales como en reportes.
- **Archivo y líneas:** `PH:82-85,183`; `TH:41`; `components/reports/report-summary.tsx:19-22`.
- **Impacto:** advertencias de hidratación y horas distintas según el momento.
- **Severidad:** Media.
- **Recomendación:** formatear con `timeZone` explícita (misma decisión que DAT-02) en un módulo de formato único.
- **Cómo verificarlo:** abrir una página con historial en un navegador en UTC-3 y revisar la consola.

### EST-09 · Efectos de compras que vuelven a pedir el contexto ✔
- **Problema:** si el servidor no entregó `initialContext`, el efecto que pide `/api/admin/context` depende de `[branchId, initialContext, locationId]`; `initialContext` seguirá siendo `null`, así que se vuelve a pedir y a auto-seleccionar cada vez que cambian sucursal o ubicación.
- **Archivo y líneas:** `PM:57-86`.
- **Impacto:** peticiones repetidas y una selección que el usuario no hizo puede reaparecer.
- **Severidad:** Media.
- **Recomendación:** cargar el contexto una sola vez (efecto sin esas dependencias) y separar la auto-selección.
- **Cómo verificarlo:** forzar un fallo del contexto en SSR y observar Network al cambiar de sucursal.

---

## 11. Consistencia visual y sistema de diseño

### VIS-01 · Estilos duplicados y ~460 literales de color ✔◐
- **Problema:** `.btnPrimary`, `.btnSecondary`, `.shortcutsBar`, `.kbd`, alertas, modales y tablas están copiados (con diferencias) en compras, transferencias, reportes, proveedores y administración; hay unos 460 literales hex en los CSS (shell 62, compras 75, reportes 81, transferencias 73, admin 67, proveedores 46…) pese a que existen tokens (`--color-danger*`, `--color-primary-hover`…).
- **Archivo y líneas:** `app/globals.css:2-26`; `components/*/*.module.css` (conteo por archivo en la búsqueda de colores).
- **Impacto:** cada pantalla se ve y se comporta distinto (alturas de botón, radios, padding) y cambiar la marca exige editar decenas de archivos.
- **Severidad:** Media.
- **Recomendación:** biblioteca interna mínima (`Button`, `Field`, `Alert`, `Modal`, `Tabs`, `DataTable`, `EmptyState`, `PageSkeleton`) en un `ui.module.css` + componentes, con tokens completos (peligro, éxito, aviso, información, superficie, foco).
- **Cómo verificarlo:** `grep -cE "#[0-9a-fA-F]{3,6}" components/*/*.module.css app/*.css`.

### VIS-02 · Tokens inexistentes con valores de respaldo distintos ◐
- **Problema:** se usan `--color-heading`, `--color-primary-light` y `--color-primary-dark`, que no están definidos en `globals.css`; los respaldos difieren de los tokens (p. ej. `--color-text-muted` `#475569` vs `#64748b`).
- **Archivo y líneas:** `components/transfers/transfers.module.css:158,181,192,197,338,342,356-365,383-393,494-495`; `components/reports/reports.module.css:31,74,95,124,141-142,170,184,190`.
- **Impacto:** estilos que caen siempre al respaldo y no cambian con el tema.
- **Severidad:** Baja.
- **Recomendación:** definir los tokens que faltan o eliminarlos y unificar los respaldos.
- **Cómo verificarlo:** buscar `var(--color-heading` en los CSS.

### VIS-03 · ~135 atributos `style={{…}}` en 18 archivos ✔
- **Problema:** hay unas 135 líneas con `style={{`: compras (PF 29, PH 26, PM 4, modal 4), transferencias (TF 16, TH 15, TM 4), proveedores (10), balanza (8), reportes (5), `error.tsx` (4) y los `loading.tsx` (16).
- **Archivo y líneas:** conteo con `grep -rc "style={{" app components`.
- **Impacto:** inconsistencia, imposible de tematizar y, con la CSP de producción, riesgo de bloqueo (SEG-01); además los estilos inline pisan `min-height` y tokens (RSP-03).
- **Severidad:** Media (Alta si se confirma SEG-01).
- **Recomendación:** pasarlos a clases de CSS Modules; regla ESLint que prohíba `style` salvo variables CSS dinámicas.
- **Cómo verificarlo:** el mismo `grep`.

### VIS-04 · Emojis como iconografía ✔
- **Problema:** 🛒 ⌨️ 📋 🧾 ⚡ ↻ ✕ como iconos de interfaz; se ven distinto según el sistema y no son semánticos.
- **Archivo y líneas:** `components/admin-shell.tsx:116,231`; `PF:727`; `PH:23`; `PM:215`; `components/empty-state.tsx:22`.
- **Impacto:** aspecto desparejo entre tablets y PC y ruido para lectores de pantalla (A11Y-06).
- **Severidad:** Baja.
- **Recomendación:** un conjunto pequeño de iconos SVG inline con `aria-hidden` y texto visible o `sr-only`.
- **Cómo verificarlo:** abrir en Windows, Android e iPad.

### VIS-05 · Tono y jerga en los textos ✔
- **Problema:** el login y el POS usan voseo ("Ingresá", "Seleccioná"), el panel usa "usted" ("Seleccione", "Presione"); la interfaz expone términos técnicos ("idempotencia", "Decimal exacto", "UUID", "Tenant-wide", "intake").
- **Archivo y líneas:** `app/page.tsx:23`; `app/pos/page.tsx:161-162`; `app/admin/page.tsx:14,22`; `PM:211`; `PF:491`; `components/admin-navigation.ts:94-96`.
- **Impacto:** voz inconsistente y vocabulario que el personal de caja y depósito no usa.
- **Severidad:** Media.
- **Recomendación:** guía de microcopy (una sola persona gramatical, glosario del negocio) y un archivo único de textos para errores y estados.
- **Cómo verificarlo:** revisar las pantallas con una persona del equipo operativo.

### VIS-06 · Utilidades repetidas en el cliente ◐
- **Problema:** `isValidUuid`, `generateIdempotencyKey` y otras funciones están duplicadas entre módulos (`transfers/types.ts`, `reports/types.ts`, `purchases/types.ts`); `RT` y `TY` repiten helpers de fecha y moneda; el contexto operativo pasa `tenantId` al cliente aunque `ReportsManager` no lo use (A VERIFICAR).
- **Archivo y líneas:** `TY:5,93`; `RT:73`; `components/purchases/types.ts:118`; `app/admin/reports/page.tsx:29`.
- **Impacto:** divergencias sutiles entre pantallas (por ejemplo la regex de UUID de `PF:577` frente a la de `RT`).
- **Severidad:** Baja.
- **Recomendación:** un `lib/format` y un `lib/ids` compartidos y probados con tests unitarios.
- **Cómo verificarlo:** `grep -rn "isValidUuid\|generateIdempotencyKey" components`.

---

## 12. Pruebas y calidad del frontend

### QA-01 · La batería E2E no ejercita nada de lo anterior ✔◐
- **Problema:** un único proyecto "Desktop Chrome" contra `npm run dev`; la tablet solo se prueba a 768×1024 y solo "sin scroll horizontal"; no hay `axe`, ni recorridos solo con teclado (`Tab`), ni producción con CSP real, ni escenarios de error/offline del POS (`route.abort`, `setOffline`, 500, timeout); los formularios de administración solo se prueban en render, y promociones tiene una sola prueba de camino feliz sin edición.
- **Archivo y líneas:** `playwright.config.ts:3-12`; `package.json` (sin `axe-core`/`@axe-core/playwright` ni `@testing-library`); `tests/e2e/admin-operations.spec.ts:62-63`; `admin-shell.spec.ts:49-51`; `purchases-admin.spec.ts:67-68`; `reports-admin.spec.ts:87-90`; `pos.spec.ts` (solo `fulfill` exitoso o de código inválido); `promotions-admin.spec.ts:9`.
- **Impacto:** cada hallazgo de este informe pasaría la CI actual.
- **Severidad:** Alta.
- **Recomendación:** proyectos de Playwright para iPad vertical y horizontal con `hasTouch`; `@axe-core/playwright` en cada pantalla; pruebas de teclado (orden de foco, trampas, Escape); una corrida E2E contra `next build && next start` con escucha de `securitypolicyviolation`; escenarios offline/500/409 del POS; pruebas de zona horaria (`timezoneId: "America/Argentina/Buenos_Aires"`); `retries`, `forbidOnly` y reporte HTML en CI.
- **Cómo verificarlo:** `grep -rn "axe\|setOffline\|Tab" tests/e2e`.

### QA-02 · Pruebas de componentes de bajo valor y sin reglas de accesibilidad estáticas ◐
- **Problema:** las pruebas de UI usan `renderToStaticMarkup` (sin interacción) y no hay `@testing-library`; no hay una regla de lint que prohíba estilos inline ni refuerce las reglas `jsx-a11y` más allá de la configuración de Next.
- **Archivo y líneas:** `tests/admin-operations-ui.test.ts`; `eslint.config.mjs`; `package.json:36-48`.
- **Impacto:** regresiones de foco, teclado y estados no se detectan a nivel de componente.
- **Severidad:** Media.
- **Recomendación:** `@testing-library/react` + `user-event` para los componentes compartidos (`Modal`, `Combobox`, `Field`, `Tabs`) y reglas `jsx-a11y` estrictas en el lint.
- **Cómo verificarlo:** revisar `eslint.config.mjs` y los tests de `components/`.

---

## 13. Otras mejoras a considerar (sin implementar)

- **Capa `apiFetch` única** (tiempo de espera, `AbortController`, 401, mapa de errores, reintento con la misma clave de idempotencia): resuelve SEG-04/05, EST-01/07 y DAT-07 de una vez.
- **Biblioteca interna de UI** (VIS-01) con documentación de estados (variante, foco, deshabilitado, error) y revisión de accesibilidad por componente.
- **Registro central de atajos** con panel de ayuda generado desde la misma fuente (NAV-02).
- **Modo tablet explícito** para POS y compras: tipografía y espaciado mayores, barra de acciones fija en el borde inferior y manejo del teclado virtual (`visualViewport`).
- **Impresión del comprobante de venta** (`@media print`) si el negocio la necesita: hoy no existe ninguna regla de impresión (decisión de producto).
- **Auditoría de rendimiento percibido:** `loading.tsx` por módulo, listas virtualizadas si los catálogos crecen, y presupuesto de JS por ruta (no medido en esta auditoría).
- **Manifiesto y modo instalable** del POS solo si se decide una estrategia offline más ambiciosa; hoy no hay Service Worker.

---

## 14. Plan sugerido por olas

| Ola | Contenido | Criterio de salida medible |
|---|---|---|
| 0 · Bloqueantes | SEG-01 (verificar), DAT-01, DAT-02, DAT-03, POS-01, POS-03, NAV-01, SEG-02/03, DAT-07, DAT-06 | Cada defecto con una prueba que falla antes y pasa después (regla de AGENTS.md); E2E contra build de producción verde |
| 1 · Teclado y tablet | `Modal`, `Combobox`, `Field`, `Tabs`; NAV-02/05; RSP-01/03/04; POS-04/05/10 | axe sin violaciones serias en las 12 pantallas; recorridos solo con teclado; sin scroll horizontal en 820×1180 y 1180×820; controles ≥44 px |
| 2 · Estados y errores | `apiFetch`, EST-01/02/03/04/07, SEG-04/05, POS-08/09 | Ningún `catch` vacío; cada pantalla con loading/empty/error/retry probados; cola offline visible |
| 3 · Consistencia | VIS-01/03/05, formato único, tokens, contraste | Cero `style={{}}` fuera de variables CSS; cero literales hex en módulos; contraste AA |

---

## 15. Decisiones requeridas (AGENTS.md: no inventar decisiones de negocio)

1. **Zona horaria:** ¿fija `America/Argentina/Buenos_Aires` o la clave `timezone` del tenant para presets, filtros y formatos? (DAT-02/03/04, EST-08)
2. **Origen de ubicaciones y sucursales para el POS:** ¿qué devuelve `/api/me` o qué endpoint ya existente puede usar un CASHIER? (POS-01, NAV-03)
3. **Catálogo offline:** ¿qué se debe poder vender sin conexión y qué se cachea? ¿Qué significa para el negocio `allowUnverifiedIntake: true` en ventas offline? (POS-09)
4. **Esquema de atajos:** qué combinaciones globales/locales y cuáles se retiran. (NAV-02)
5. **CSP:** nonce con renderizado dinámico o política con `'unsafe-inline'` documentada. (SEG-01)
6. **Filtros avanzados de reportes y promociones** (operador, variante, categoría, lote): si no hay fuente de datos ya expuesta, ¿se ocultan hasta contar con ella? (DAT-08)
7. **Pantalla de Arqueos y Turnos:** ¿se publica una página provisional o se oculta el ítem? (NAV-01)
8. **Roles con varios valores:** ¿cómo se calcula el rol efectivo en la UI? (SEG-02)

---

## 16. Cobertura, método y límites

**Leído directamente (completo o por tramos):** `AGENTS.md`, `package.json`, `next.config.ts`, `playwright.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` y su CSS, `app/pos/page.tsx` y su CSS, `components/auth/*`, `components/admin-shell.tsx` y su CSS, `components/admin-navigation.ts`, `app/admin/{layout,error,loading,page}.tsx`, todos los `app/admin/*/page.tsx`, `app/api/admin/context/route.ts`, `app/api/me/route.ts`, `src/pos/offline-queue.ts`, `components/purchases/{purchase-manager,purchase-form,supplier-modal,purchase-history}.tsx` y partes de su CSS y `types.ts`, y fragmentos de los CSS de transferencias, reportes, proveedores y administración (media queries, foco, tablas).

**Revisado por revisión delegada (con citas de línea) y contrastado por mí en los puntos críticos:** `components/transfers/*`, `components/reports/*`, `components/suppliers/*`, `components/admin-operations/*`, `app/admin/promotions/*`, los `loading.tsx` por módulo y la cobertura de `tests/e2e/*` (por nombres de pruebas).

**No cubierto:** `src/**` y `prisma/**` (backend, fuera de alcance salvo lectura de contexto), el resto de rutas `app/api/**`, `docs/`, `tests/**` salvo lo indicado, ni los archivos de CI.

**Límites declarados:**
- **No ejecuté la aplicación, ni `lint`, `typecheck`, tests, ni axe/Lighthouse.** El entorno no pudo instalar las dependencias (npm falló con un error de red y de proceso), por lo que SEG-01, NAV-08 y EST-08 quedan como ⚠ y los contrastes se calcularon a mano (el de `#0284c7` sobre blanco: 4,10:1).
- Los hallazgos de tipo ⚠ deben confirmarse con una corrida real antes de priorizarlos.
- AGENTS.md pide leer la documentación de Next de `node_modules/next/dist/docs/` antes de proponer APIs específicas (nonce, `proxy.ts`); no estaba disponible aquí, así que esas recomendaciones se formularon a nivel de estrategia.
- Las pruebas citadas fueron analizadas por nombre y configuración, no ejecutadas.
- Este informe no es un *brief* en el sentido de AGENTS.md ("no se implementa nada sin brief, criterios medibles y OK"): cada ola del §14 debería convertirse en uno antes de tocar código.
- Procedimiento: el repositorio se clonó en modo lectura y no se modificó; las copias y pruebas temporales se hicieron fuera de él.
