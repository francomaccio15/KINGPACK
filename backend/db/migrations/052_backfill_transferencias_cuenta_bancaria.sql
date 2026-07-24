-- KINGPACK — Backfill: transferencias de ventas que nunca acreditaron el banco
--
-- Hasta ahora el frontend mandaba sólo el NOMBRE de la cuenta destino
-- (`venta_pagos.cuenta_destino`) y no `cuenta_bancaria_id`, que es lo que usa
-- `registrarMovimientoBancario` para acreditar. Resultado: los cobros por
-- transferencia quedaron registrados en la venta pero nunca sumaron al saldo de
-- la cuenta ni dejaron fila en `movimientos_cuenta_bancaria`.
--
-- Esta migración, para las ventas NO anuladas:
--   1. completa `venta_pagos.cuenta_bancaria_id` matcheando por nombre;
--   2. crea el movimiento de ingreso faltante (uno por venta + cuenta);
--   3. suma esos importes al saldo, manteniendo el invariante
--      saldo = saldo_inicial + Σingresos − Σegresos.
--
-- Es idempotente: sólo toca pagos sin `cuenta_bancaria_id` y sólo inserta
-- movimientos para ventas que todavía no tienen uno.

BEGIN;

-- 1) Vincular el pago con la cuenta bancaria por nombre exacto (case-insensitive).
UPDATE venta_pagos vp
   SET cuenta_bancaria_id = cb.id
  FROM ventas v, cuentas_bancarias_empresa cb
 WHERE vp.venta_id = v.id
   AND v.estado <> 'anulada'
   AND vp.cuenta_bancaria_id IS NULL
   AND vp.cuenta_destino IS NOT NULL
   AND lower(trim(cb.nombre)) = lower(trim(vp.cuenta_destino));

-- 2) Crear el ingreso faltante, agrupado por venta + cuenta.
WITH pendientes AS (
  SELECT vp.venta_id,
         vp.cuenta_bancaria_id,
         v.numero,
         min(v.fecha)      AS fecha,
         sum(vp.monto)     AS monto
    FROM venta_pagos vp
    JOIN ventas v ON v.id = vp.venta_id
   WHERE v.estado <> 'anulada'
     AND vp.cuenta_bancaria_id IS NOT NULL
     AND NOT EXISTS (
           SELECT 1 FROM movimientos_cuenta_bancaria m
            WHERE m.origen_tipo = 'venta'
              AND m.origen_id   = vp.venta_id
              AND m.cuenta_bancaria_id = vp.cuenta_bancaria_id
         )
   GROUP BY vp.venta_id, vp.cuenta_bancaria_id, v.numero
  HAVING sum(vp.monto) > 0
)
INSERT INTO movimientos_cuenta_bancaria
  (cuenta_bancaria_id, fecha, tipo, monto, concepto, origen_tipo, origen_id)
SELECT cuenta_bancaria_id, fecha, 'ingreso', monto,
       'Venta #' || numero, 'venta', venta_id
  FROM pendientes;

-- 3) Re-derivar el saldo de cada cuenta a partir de su saldo_inicial y los
--    movimientos, ahora que están los que faltaban.
UPDATE cuentas_bancarias_empresa cb
   SET saldo = cb.saldo_inicial + COALESCE((
         SELECT sum(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END)
           FROM movimientos_cuenta_bancaria m
          WHERE m.cuenta_bancaria_id = cb.id
       ), 0),
       updated_at = NOW();

COMMIT;
