-- KINGPACK — Seed: Stock demo multi-sucursal
-- Genera stock realista para los 11 artículos demo en las 2 sucursales (Laprida, Huaico).
-- Incluye:
--   • Mayoría con stock saludable
--   • Algunos artículos con stock bajo (cantidad <= stock_minimo) para activar el flag
--   • Un artículo sin stock en una sucursal (caso típico para demostrar traspasos)
-- Laprida = sucursal principal (mayor volumen), Huaico = secundaria.

INSERT INTO stock (articulo_id, sucursal_id, cantidad, stock_minimo)
SELECT a.id, s.id, v.cantidad, v.stock_minimo
FROM (VALUES
  -- codigo,    sucursal,  cantidad,  stock_minimo  -- nota
  ('VS-200',  'Laprida',     85.000,        20.000),  -- OK
  ('VS-200',  'Huaico',      42.000,        15.000),  -- OK
  ('VS-300',  'Laprida',     64.000,        20.000),  -- OK
  ('VS-300',  'Huaico',      38.000,        15.000),  -- OK
  ('TP-200',  'Laprida',    110.000,        25.000),  -- OK
  ('TP-200',  'Huaico',      55.000,        20.000),  -- OK
  ('BL-CAM',  'Laprida',    145.000,        30.000),  -- OK
  ('BL-CAM',  'Huaico',      88.000,        25.000),  -- OK
  ('BL-RES',  'Laprida',     18.000,        20.000),  -- STOCK BAJO (18 <= 20)
  ('BL-RES',  'Huaico',      32.000,        15.000),  -- OK
  ('BD-N3',   'Laprida',     42.000,        10.000),  -- OK
  ('BD-N3',   'Huaico',       0.000,         8.000),  -- SIN STOCK (caso para traspaso)
  ('SV-LIS',  'Laprida',     96.000,        25.000),  -- OK
  ('SV-LIS',  'Huaico',      47.000,        20.000),  -- OK
  ('CB-TEN',  'Laprida',     28.000,        30.000),  -- STOCK BAJO (28 <= 30)
  ('CB-TEN',  'Huaico',      60.000,        25.000),  -- OK
  ('CB-CUC',  'Laprida',     75.000,        30.000),  -- OK
  ('CB-CUC',  'Huaico',      18.000,        25.000),  -- STOCK BAJO (18 <= 25)
  ('EN-PIZ',  'Laprida',     52.000,        15.000),  -- OK
  ('EN-PIZ',  'Huaico',      25.000,        12.000),  -- OK
  ('EN-VIA',  'Laprida',     38.000,        20.000),  -- OK
  ('EN-VIA',  'Huaico',      22.000,        15.000)   -- OK
) AS v(codigo, sucursal_nombre, cantidad, stock_minimo)
JOIN articulos a ON a.codigo = v.codigo
JOIN sucursales s ON s.nombre = v.sucursal_nombre
ON CONFLICT (articulo_id, sucursal_id) DO NOTHING;
