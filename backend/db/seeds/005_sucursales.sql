-- KINGPACK — Seed: Sucursales
-- PENDIENTE: confirmar punto_venta_afip de cada sucursal con el cliente
INSERT INTO sucursales (nombre, direccion, telefono, punto_venta_afip, activo) VALUES
  ('Laprida', NULL, NULL, NULL, TRUE),  -- punto_venta_afip: PENDIENTE confirmar con cliente
  ('Huaico',  NULL, NULL, NULL, TRUE)   -- punto_venta_afip: PENDIENTE confirmar con cliente
ON CONFLICT (nombre) DO NOTHING;
