-- KINGPACK — Seed 014: Categorías reales (datos del legacy)
-- Fuente: KingPack.xlsx > hoja "Categorias"
-- margen_default estimado en base a los precios y costos del catálogo.
-- Idempotente vía ON CONFLICT (nombre) DO NOTHING.

INSERT INTO categorias (nombre, margen_default) VALUES
  ('PLATOS POTES CUBIERTOS',                        42.00),
  ('FILM ALUMINIO FOLEX',                           55.00),
  ('BANDEJAS Y CAJAS CARTON',                       40.00),
  ('BANDEJAS ALUMINIO',                             40.00),
  ('BANDEJAS PLASTICAS VARIAS',                     38.00),
  ('BANDEJAS C/TAPAS MICRO',                        38.00),
  ('SORBETES',                                      42.00),
  ('BOLSAS BOBINA ARRANQUE',                        38.00),
  ('HIGIENE INSTITUCIONAL',                         35.00),
  ('PAPELES',                                       38.00),
  ('RESIDUOS CONSORCIOS',                           38.00),
  ('BOLSAS CAMISETAS',                              38.00),
  ('BOLSAS PP VARIAS',                              40.00),
  ('BOLSAS PAPEL CON MANIJA KP',                    42.00),
  ('BOLSAS DILIVERY-INDIVIDUALES',                  42.00),
  ('BOLSAS PAPEL PANADERIA',                        40.00),
  ('CAJAS PIZZA - PORTA PANCHO - CONO',             40.00),
  ('GUANTES',                                       45.00),
  ('CINTAS DE EMBALAR',                             40.00),
  ('VASOS',                                         40.00),
  ('SERVILLETAS',                                   45.00),
  ('TERGOPOL',                                      40.00),
  ('REPOSTERIA',                                    45.00),
  ('PAPEL GRIS FANTASIA PARAFINADO Y ZATINADO',     40.00),
  ('BOLSAS PAPELKRAFT',                             42.00),
  ('ESCARBADIENTES BROCHETS Y MAS',                 45.00),
  ('FILM ALUMINIO Y MANTECA',                       50.00),
  ('OTROS',                                         30.00)
ON CONFLICT (nombre) DO NOTHING;
