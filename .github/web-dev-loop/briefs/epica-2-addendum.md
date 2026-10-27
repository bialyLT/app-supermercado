# Addendum — Épica 2: Catálogo, precios e inventario

Complementa `epica-2-catalog-inventory.md` sin reemplazarlo. Si algo choca con
el brief original, rige este addendum (`AGENTS.md` §2). Lo ya implementado no
se rehace: lo que falte se agrega con migraciones nuevas.

## Cambios al alcance

1. **Saldo materializado.** Tabla `inventory_level` (on_hand, reserved) con
   CHECK `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`, actualizada
   con UPDATE condicional atómico en la misma transacción que el movimiento
   (D-005). Si hoy el stock se deriva solo de movimientos, agregar el level y
   una migración de relleno verificable.
2. **Append-only impuesto en base.** Trigger que rechaza UPDATE/DELETE en
   `inventory_movement` y `audit_log`, y un rol de aplicación sin esos
   privilegios.
3. **Aislamiento por tenant en profundidad.** Repositorios que inyectan el
   tenant, regla de lint contra Prisma fuera de ellos y políticas RLS en las
   tablas nuevas (D-004). Si el equipo rechaza RLS, documentarlo como
   decisión y compensar con el test automático por tabla.
4. **`UNVERIFIED_INTAKE` con controles** (`DOMAIN_RULES.md` §5): política por
   tenant (`DISABLED | ALLOW_WITH_CAPS | REQUIRE_SUPERVISOR`), topes
   configurables, permiso `inventory.unverified_intake.create`, solo variantes
   existentes, estados `PENDING_REVIEW → CONFIRMED | CORRECTED | REJECTED`,
   revisor distinto del creador y casos resueltos inmutables. Costo y
   proveedor `UNKNOWN`.
5. **Códigos pesables.** Función pura que parsea EAN-13 con prefijo de
   balanza configurable por tenant (peso o precio incrustado), valida dígito
   de control y devuelve variante + cantidad o importe como `Decimal`. Sin
   dependencia de hardware.
6. **Lotes.** Salida FEFO por defecto; lote vencido bloqueado salvo aprobación
   de supervisor auditada.
7. **Idempotencia** en cada operación que crea movimientos
   (`idempotency_key` única por tenant).

## Criterios adicionales (Gherkin)

```gherkin
Given una política UNVERIFIED_INTAKE con tope por sesión de caja
When un cajero supera el tope
Then la venta que requiere más intake falla de forma controlada
And no queda ningún movimiento parcial

Given un caso PENDING_REVIEW creado por el usuario X
When el mismo usuario X intenta confirmarlo
Then el servidor lo deniega y registra la denegación

Given un caso CONFIRMED o REJECTED
When alguien intenta modificarlo
Then la operación falla y el caso permanece idéntico

Given 20 ventas concurrentes de 1 unidad sobre una variante con 5 en stock
And la política permite intake con tope 20
When todas confirman
Then exactamente 5 consumen stock registrado
And el resto genera intake por la diferencia
And on_hand final es 0 y nunca negativo
And la suma de movimientos coincide con on_hand

Given el mismo comando de venta enviado 5 veces con la misma clave
When el servidor los procesa
Then existe un único conjunto de movimientos

Given la misma clave con un payload distinto
When el servidor lo recibe
Then responde 409 sin ejecutar nada

Given un código de barras ya activo en el tenant A
When el tenant B registra el mismo código
Then se permite (la unicidad es por tenant)

Given un lote vencido
When se intenta vender sin aprobación de supervisor
Then se bloquea

Given un UPDATE o DELETE directo sobre inventory_movement con el rol de la app
When se ejecuta
Then la base lo rechaza
```

## Gates adicionales

Los de `GATES.md` más: reconciliación ledger/level en 0 divergencias,
batería de concurrencia ejecutada 20 veces seguidas sin fallo, test de
aislamiento por tabla con 0 fugas, test de append-only a nivel de base.

## Informe

Además de lo habitual, `.github/web-dev-loop/reports/epica-2-dev.md` incluye:
política de `UNVERIFIED_INTAKE` y valores por defecto de topes, qué se decidió
sobre RLS, cantidad de ejecuciones de la batería de concurrencia y resultado, y
los `SUPUESTO:` de D-003b.
