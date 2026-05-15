-- KINGPACK — Seed: Alícuotas IVA (AFIP)
INSERT INTO alicuotas_iva (codigo_afip, porcentaje, descripcion) VALUES
  (3,  0.00,  'No Gravado'),
  (4,  0.00,  'Exento'),
  (5,  21.00, 'IVA 21%'),
  (6,  27.00, 'IVA 27%'),
  (8,  5.00,  'IVA 5%'),
  (9,  2.50,  'IVA 2.5%')
ON CONFLICT (codigo_afip) DO NOTHING;
