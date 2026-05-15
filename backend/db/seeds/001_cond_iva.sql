-- KINGPACK — Seed: Condiciones IVA (AFIP)
INSERT INTO cond_iva (codigo_afip, nombre) VALUES
  (1,  'Responsable Inscripto'),
  (4,  'Exento'),
  (5,  'Consumidor Final'),
  (6,  'Responsable Monotributo'),
  (13, 'No Categorizado')
ON CONFLICT (codigo_afip) DO NOTHING;
