-- KINGPACK — Seed: Medios de pago
INSERT INTO medios_pago (nombre, requiere_cuenta) VALUES
  ('Efectivo',              FALSE),
  ('Transferencia',         TRUE),
  ('Tarjeta de Débito',     FALSE),
  ('Tarjeta de Crédito',    FALSE),
  ('Cheque',                FALSE),
  ('Cuenta Corriente',      FALSE),
  ('Mercado Pago',          FALSE),
  ('QR',                    FALSE)
ON CONFLICT (nombre) DO NOTHING;
