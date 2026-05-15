-- KINGPACK — Seed: Tipos de comprobante AFIP
INSERT INTO tipos_comprobante (codigo_afip, letra, descripcion) VALUES
  (1,  'A', 'Factura A'),
  (6,  'B', 'Factura B'),
  (11, 'C', 'Factura C'),
  (3,  'A', 'Nota de Crédito A'),
  (8,  'B', 'Nota de Crédito B'),
  (13, 'C', 'Nota de Crédito C'),
  (2,  'A', 'Nota de Débito A'),
  (7,  'B', 'Nota de Débito B'),
  (12, 'C', 'Nota de Débito C')
ON CONFLICT (codigo_afip) DO NOTHING;
