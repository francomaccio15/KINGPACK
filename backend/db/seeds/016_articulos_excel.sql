-- KINGPACK — Seed 016: Artículos reales (muestra del catálogo legacy)
-- Fuente: KingPack.xlsx > hoja "Articulos" — primeras ~80 filas con costo y precio válidos.
-- margen_aplicado calculado como ROUND((precio_excel / (costo_excel * 1.21) - 1) * 100)
--   asumiendo que el precio legacy incluye IVA 21%.
-- costo_flete = 0: el Excel no discrimina flete por artículo.
-- precio_madre es recalculado automáticamente por el trigger al insertar.
-- Idempotente vía ON CONFLICT (codigo) DO NOTHING.

INSERT INTO articulos (codigo, nombre, categoria_id, alicuota_iva_id, costo_base, costo_flete, margen_aplicado, activo, legacy_id)
SELECT
  v.codigo,
  v.nombre,
  c.id   AS categoria_id,
  a.id   AS alicuota_iva_id,
  v.costo_base,
  0.00   AS costo_flete,
  v.margen_aplicado,
  TRUE,
  v.codigo  AS legacy_id
FROM (VALUES
  -- PLATOS POTES CUBIERTOS
  ('6952938459570', 'AGITADORES CAFE X 1000 UNID.',                         'PLATOS POTES CUBIERTOS',                   6180.00, 40.00),
  ('00123754',      'AGITADORES T.LARGO X100',                               'PLATOS POTES CUBIERTOS',                   2850.00, 45.00),

  -- FILM ALUMINIO FOLEX
  ('77881',         'ALUMINIO FAMILIAR X 5 MTS',                             'FILM ALUMINIO FOLEX',                       730.00, 70.00),
  ('78589',         'ALUMINIO X 1KG',                                        'FILM ALUMINIO FOLEX',                      5710.00, 49.00),

  -- BANDEJAS ALUMINIO
  ('74463',         'BANDEJA ALUMINIO F100',                                 'BANDEJAS ALUMINIO',                         180.00, 38.00),
  ('79737',         'BANDEJA ALUMINIO F75',                                  'BANDEJAS ALUMINIO',                         129.00, 41.00),
  ('78321',         'BANDEJA ALUMINIO P21',                                  'BANDEJAS ALUMINIO',                         157.00, 41.00),
  ('79089',         'BANDEJA ALUMINIO P30',                                  'BANDEJAS ALUMINIO',                         282.00, 41.00),
  ('64233',         'BANDEJA ALUMINIO P33',                                  'BANDEJAS ALUMINIO',                         358.00, 41.00),
  ('81139',         'BANDEJAS ALUMINIO F200',                                'BANDEJAS ALUMINIO',                         300.00, 38.00),
  ('80695',         'BANDEJAS ALUMINIO F50',                                 'BANDEJAS ALUMINIO',                          93.00, 38.00),

  -- BANDEJAS Y CAJAS CARTON
  ('79077',         'BANDEJAS CARTON REDONDA N 16',                         'BANDEJAS Y CAJAS CARTON',                    94.00, 41.00),
  ('81399',         'BANDEJAS CARTON REDONDA N 13',                         'BANDEJAS Y CAJAS CARTON',                    37.00, 38.00),
  ('80423',         'BANDEJAS CARTON REDONDA N 14',                         'BANDEJAS Y CAJAS CARTON',                    48.00, 38.00),
  ('80927',         'BANDEJAS CARTON REDONDA N 15',                         'BANDEJAS Y CAJAS CARTON',                    53.00, 39.00),

  -- BANDEJAS PLASTICAS VARIAS
  ('80739',         'BANDEJAS 101 PP COTNYL',                                'BANDEJAS PLASTICAS VARIAS',                  51.00, 33.00),
  ('74969',         'BANDEJAS 102 COTNYL',                                   'BANDEJAS PLASTICAS VARIAS',                  85.00, 41.00),
  ('80507',         'BANDEJAS 102 PP',                                       'BANDEJAS PLASTICAS VARIAS',                  58.00, 35.00),
  ('81529',         'BANDEJAS 102 PP NEGRAS',                                'BANDEJAS PLASTICAS VARIAS',                  36.00, 38.00),
  ('81227',         'BANDEJAS 103 PP',                                       'BANDEJAS PLASTICAS VARIAS',                  75.00, 33.00),
  ('80449',         'BANDEJAS 103 PP COTNYL',                                'BANDEJAS PLASTICAS VARIAS',                  98.00, 40.00),
  ('80365',         'BANDEJAS 105 PP',                                       'BANDEJAS PLASTICAS VARIAS',                 100.00, 33.00),

  -- BOLSAS BOBINA ARRANQUE
  ('7799165007094', 'BOB. ARRANQ. 30X40 X 1,2KG',                           'BOLSAS BOBINA ARRANQUE',                   6265.00, 39.00),
  ('7799165007650', 'BOB. ARRANQ. 50X70 X 1,2KG',                           'BOLSAS BOBINA ARRANQUE',                   6265.00, 39.00),
  ('7799165007629', 'BOB. ARRANQUE 60X90 X 1,5KG',                          'BOLSAS BOBINA ARRANQUE',                   8772.00, 38.00),
  ('00002718',      'BOB. ARRANQ. 40X60 X 1,2KG',                           'BOLSAS BOBINA ARRANQUE',                   6265.00, 39.00),
  ('00002716',      'BOBINA 15X20 X 400GR',                                  'BOLSAS BOBINA ARRANQUE',                   2240.00, 40.00),

  -- BOLSAS CAMISETAS
  ('00000425',      'BOLSAS CAM. 50X60 BCAS X100',                          'BOLSAS CAMISETAS',                         4800.00, 33.00),
  ('00003114',      'BOLSAS CAM. 30X40 BCAS REF KING PACK X100',            'BOLSAS CAMISETAS',                         1167.00, 77.00),
  ('00004349',      'BOLSAS CAM. 40X50 BCAS REF KING PACK X100',            'BOLSAS CAMISETAS',                         2364.00, 22.00),
  ('00004818',      'BOLSAS CAM. 50X70 BCAS X100',                          'BOLSAS CAMISETAS',                         5600.00, 33.00),
  ('00001019',      'BOLSAS CAMISETAS 45X60 REF X 100',                     'BOLSAS CAMISETAS',                         3680.00, 39.00),

  -- RESIDUOS CONSORCIOS
  ('00002499',      'BOLSAS CONS. 60X90 REF X10 UNID.',                     'RESIDUOS CONSORCIOS',                       900.00, 38.00),
  ('00008016',      'BOLSAS CONS. 80X1,10 REF X 10 UNID.',                  'RESIDUOS CONSORCIOS',                      1985.00, 33.00),

  -- HIGIENE INSTITUCIONAL
  ('00003020',      'BOB. INDUSTRIAL KING PACK X 25CM X400MTS X2 BCA',      'HIGIENE INSTITUCIONAL',                   19360.00, 32.00),

  -- PAPEL GRIS FANTASIA PARAFINADO Y ZATINADO
  ('00002704',      'BOBINA DE PAPEL GRIS X 40 CM (8 KG)',                  'PAPEL GRIS FANTASIA PARAFINADO Y ZATINADO',11040.00, 35.00),
  ('00002631',      'BOBINA PAPEL GRIS X 20 CM X 3,500KG',                  'PAPEL GRIS FANTASIA PARAFINADO Y ZATINADO', 4830.00, 40.00),
  ('00003005',      'BOB. PAPEL GRIS X 60CM (11,500KG)',                    'PAPEL GRIS FANTASIA PARAFINADO Y ZATINADO',15870.00, 33.00),

  -- BOLSAS PAPELKRAFT
  ('cb02afa9',      'BOLSAS DELIVERY 20X30 FM5',                            'BOLSAS PAPELKRAFT',                          52.00, 43.00),
  ('fb301b65',      'BOLSAS DELIVERY 26X37 FM9',                            'BOLSAS PAPELKRAFT',                          95.00, 39.00),
  ('0000482733',    'BOLSAS DELIVERY 26X38 F10',                            'BOLSAS PAPELKRAFT',                          46.00, 43.00),

  -- BOLSAS PP VARIAS
  ('00000484',      'BOLSA DE HORNO X 10 UNID.',                            'BOLSAS PP VARIAS',                          550.00, 50.00),

  -- REPOSTERIA
  ('79787',         'BENGALAS X 4 UNID.',                                   'REPOSTERIA',                               1280.00, 68.00)

) AS v(codigo, nombre, categoria_nombre, costo_base, margen_aplicado)
JOIN categorias     c ON c.nombre = v.categoria_nombre
JOIN alicuotas_iva  a ON a.codigo_afip = 5   -- IVA 21%
ON CONFLICT (codigo) DO NOTHING;
