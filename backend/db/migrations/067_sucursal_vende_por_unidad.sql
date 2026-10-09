-- KINGPACK — Migración 067: venta por unidad habilitada por sucursal
--
-- Pedido del negocio (09/10/2026): en Laprida NO se vende suelto, solo por
-- bulto. sucursales.vende_por_unidad = FALSE oculta el «+ Unidad» en ventas y
-- presupuestos de esa sucursal y el backend rechaza líneas sueltas nuevas.
-- El stock sigue guardado en unidades igual (es por artículo, no por sucursal).

ALTER TABLE sucursales
  ADD COLUMN IF NOT EXISTS vende_por_unidad BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE sucursales SET vende_por_unidad = FALSE WHERE nombre = 'Laprida';
