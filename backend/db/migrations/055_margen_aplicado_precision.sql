-- KINGPACK — Migración 055: más precisión en margen_aplicado
--
-- Problema: articulos.margen_aplicado era NUMERIC(5,2) (2 decimales). El precio
-- de venta se guarda de forma indirecta a través del margen (el trigger recalcula
-- precio_madre = costo × (1+flete%) × (1+margen%) × (1+IVA%), redondeado a entero).
-- Con solo 2 decimales de margen, un cambio de pocos pesos en un artículo caro no
-- alcanzaba a mover el margen y el precio "volvía" al valor anterior.
--
-- Solución: ampliar a NUMERIC(11,6). Así el backend puede derivar el margen exacto
-- a partir del precio de venta objetivo y el trigger reproduce ese precio al peso.
-- La ampliación de precisión es lossless (no cambia ningún valor existente).

ALTER TABLE articulos
  ALTER COLUMN margen_aplicado TYPE NUMERIC(11,6);
