-- KINGPACK — Seed: Listas de precios
-- Los descuentos_base_pct están en 0 como placeholder.
-- PENDIENTE: definir con el cliente los % de cada lista antes de producción.
-- El admin puede editarlos desde la UI sin nueva migración.
INSERT INTO listas_precios (nombre, tipo, descripcion, descuento_base_pct, activo) VALUES
  ('Precio Base',       'madre',           'Precio madre con todos los costos + margen. Fuente de todas las demás listas.',     0,    TRUE),
  ('Precio Público',    'publica',         'Precio mostrador para venta al público general.',                                   0,    TRUE),
  ('Lista Reventa',     'revendedor',      'Lista competitiva para revendedores. Margen más fino. Con o sin factura.',          0,    TRUE),
  ('Cuenta Corriente',  'cuenta_corriente','Asignada a clientes con cuenta corriente activa (facturado / no facturado).',       0,    TRUE)
ON CONFLICT (nombre) DO NOTHING;
