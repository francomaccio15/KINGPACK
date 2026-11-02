-- KINGPACK — Migración 069: la nota de crédito total anula la venta
--
-- Pedido del negocio (02/11/2026): al emitir una NC por la venta completa la
-- venta quedaba viva y el cajero la anulaba a mano, con lo que la plata salía
-- dos veces de la caja (egreso de la NC + egreso de la anulación) y el stock
-- volvía dos veces. Ahora la NC que cubre toda la venta la anula sola, sin
-- repetir efectos (caso venta #3994 Huaico).
--
-- anulo_venta_id / venta_estado_previo: qué venta anuló la NC y en qué estado
--   estaba, para devolverla a ese estado si después se anula la NC.
-- sin_efectos: la NC se emitió sobre una venta YA anulada (solo fiscal); no
--   movió caja, stock ni cuenta corriente, así que anularla tampoco debe.

ALTER TABLE notas_credito ADD COLUMN IF NOT EXISTS anulo_venta_id      UUID REFERENCES ventas(id);
ALTER TABLE notas_credito ADD COLUMN IF NOT EXISTS venta_estado_previo VARCHAR(20);
ALTER TABLE notas_credito ADD COLUMN IF NOT EXISTS sin_efectos         BOOLEAN NOT NULL DEFAULT FALSE;
