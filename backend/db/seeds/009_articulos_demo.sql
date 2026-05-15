-- KINGPACK — Seed: Categorías + artículos demo para validación inicial
-- Se referencia alicuota IVA 21% por codigo_afip=5 (ver 003_alicuotas_iva.sql).

INSERT INTO categorias (nombre, margen_default) VALUES
  ('Vasos y Tapas',       40.00),
  ('Bolsas',              35.00),
  ('Bandejas',            38.00),
  ('Servilletas',         45.00),
  ('Cubiertos Descartables', 50.00),
  ('Envases Delivery',    42.00)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO articulos (codigo, nombre, categoria_id, alicuota_iva_id, costo_base, costo_flete, margen_aplicado, precio_madre, activo)
SELECT v.codigo, v.nombre, c.id, a.id, v.costo_base, v.costo_flete, v.margen, v.precio_madre, TRUE
FROM (VALUES
  ('VS-200',  'Vaso polipapel 200ml x 50 u',     'Vasos y Tapas',          120.00,  8.00, 40.00, 179.20),
  ('VS-300',  'Vaso polipapel 300ml x 50 u',     'Vasos y Tapas',          155.00, 10.00, 40.00, 231.00),
  ('TP-200',  'Tapa plástica vaso 200ml x 50 u', 'Vasos y Tapas',           80.00,  5.00, 40.00, 119.00),
  ('BL-CAM',  'Bolsa camiseta 30x40 x 100 u',    'Bolsas',                 250.00, 15.00, 35.00, 357.75),
  ('BL-RES',  'Bolsa residuos 60L x 10 u',       'Bolsas',                 180.00, 12.00, 35.00, 259.20),
  ('BD-N3',   'Bandeja cartón N°3 x 100 u',      'Bandejas',               420.00, 25.00, 38.00, 614.10),
  ('SV-LIS',  'Servilletas lisas blanco x 100 u','Servilletas',             95.00,  6.00, 45.00, 146.45),
  ('CB-TEN',  'Tenedor descartable x 50 u',      'Cubiertos Descartables',  70.00,  4.00, 50.00, 111.00),
  ('CB-CUC',  'Cuchara descartable x 50 u',      'Cubiertos Descartables',  70.00,  4.00, 50.00, 111.00),
  ('EN-PIZ',  'Caja pizza 32cm x 25 u',          'Envases Delivery',       320.00, 18.00, 42.00, 479.96),
  ('EN-VIA',  'Bandeja viandera 3 div x 50 u',   'Envases Delivery',       210.00, 13.00, 42.00, 316.66)
) AS v(codigo, nombre, categoria_nombre, costo_base, costo_flete, margen, precio_madre)
JOIN categorias c ON c.nombre = v.categoria_nombre
JOIN alicuotas_iva a ON a.codigo_afip = 5
ON CONFLICT (codigo) DO NOTHING;
