-- KINGPACK — Seed: Alícuotas IVA (AFIP)
-- codigo_afip = id de alícuota de AFIP: 3=0%, 4=10,5%, 5=21%, 6=27%, 8=5%, 9=2,5%.
INSERT INTO alicuotas_iva (codigo_afip, porcentaje, descripcion) VALUES
  (3,  0.00,  'Sin IVA (0%)'),
  (4,  10.50, 'IVA 10.5%'),
  (5,  21.00, 'IVA 21%'),
  (6,  27.00, 'IVA 27%'),
  (8,  5.00,  'IVA 5%'),
  (9,  2.50,  'IVA 2.5%')
ON CONFLICT (codigo_afip) DO NOTHING;
