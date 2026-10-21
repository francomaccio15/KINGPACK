-- KINGPACK — Migración 068: los ítems se muestran en el orden en que se cargaron
--
-- Pedido del negocio (21/10/2026): en todos lados los productos tienen que
-- aparecer en el orden en que se fueron tiqueando, no alfabético. Estas tablas
-- no tenían id ni fecha por ítem, así que no había forma de saber el orden.
-- `orden` toma el siguiente número de la secuencia en cada INSERT; como los
-- ítems se insertan uno por uno en el orden del carrito, ese es el orden.
-- Los registros viejos quedan con el orden físico (el original ya se perdió).

ALTER TABLE venta_items    ADD COLUMN IF NOT EXISTS orden BIGSERIAL;
ALTER TABLE traspaso_items ADD COLUMN IF NOT EXISTS orden BIGSERIAL;
ALTER TABLE pedido_items   ADD COLUMN IF NOT EXISTS orden BIGSERIAL;
