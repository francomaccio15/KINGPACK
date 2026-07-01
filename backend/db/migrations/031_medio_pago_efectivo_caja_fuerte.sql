-- 031_medio_pago_efectivo_caja_fuerte.sql
-- Agrega el medio de pago "Efectivo Caja Fuerte" (efectivo guardado en la caja fuerte).
-- Es efectivo (no requiere cuenta bancaria). Al contener "efectivo" en el nombre,
-- el arqueo de caja lo cuenta como efectivo físico si se usa en un movimiento de caja.
INSERT INTO medios_pago (nombre, requiere_cuenta, activo) VALUES
  ('Efectivo Caja Fuerte', FALSE, TRUE)
ON CONFLICT (nombre) DO NOTHING;
