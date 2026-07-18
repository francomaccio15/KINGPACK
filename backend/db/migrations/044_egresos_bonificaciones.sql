-- KINGPACK — Migración 044: bonificaciones (descuento extra) sobre el subtotal de un egreso
--
-- Algunos proveedores le aplican a KingPack una o más bonificaciones EN CASCADA
-- sobre el subtotal de la lista de artículos (aparte del descuento por línea),
-- antes del IVA. Ej.: Subtotal → Bonif.1 6% → Bonif.2 3% (sobre el ya
-- descontado) → Neto gravado → IVA → Total.
--
-- Se guardan como lista flexible en JSONB. Cada elemento:
--   { "pct": <número 0-100>, "monto": <importe descontado en esa etapa> }
-- El orden del array define el orden de la cascada.
-- El neto gravado ya guardado (egresos.neto_gravado) refleja el resultado final.

ALTER TABLE egresos
  ADD COLUMN IF NOT EXISTS bonificaciones JSONB NOT NULL DEFAULT '[]'::jsonb;
