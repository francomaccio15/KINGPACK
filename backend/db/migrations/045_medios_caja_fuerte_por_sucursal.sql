-- KINGPACK — Migración 045: medios de pago "Efectivo Caja Fuerte" por sucursal
--
-- Antes había un único medio genérico "Efectivo Caja Fuerte" y el pago descontaba
-- de la caja fuerte de la sucursal DEL COMPROBANTE. Ahora se ofrecen dos medios
-- explícitos —uno por caja fuerte física— para poder elegir de cuál sale el
-- efectivo, sin importar la sucursal del egreso/pago:
--   • Efectivo Caja Fuerte Laprida
--   • Efectivo Caja Fuerte Huaico
--
-- El medio queda vinculado a su sucursal de caja fuerte con `caja_fuerte_sucursal_id`.
-- El backend descuenta/repone sobre esa sucursal (fallback a la del comprobante
-- para el medio genérico viejo, que se desactiva).

-- Columna que ata el medio a una caja fuerte específica (NULL = no es caja fuerte
-- puntual; usa la sucursal del comprobante como antes).
ALTER TABLE medios_pago
  ADD COLUMN IF NOT EXISTS caja_fuerte_sucursal_id UUID REFERENCES sucursales(id);

-- Dos medios de efectivo de caja fuerte, uno por sucursal.
INSERT INTO medios_pago (nombre, requiere_cuenta, activo, caja_fuerte_sucursal_id)
SELECT 'Efectivo Caja Fuerte Laprida', FALSE, TRUE, id FROM sucursales WHERE nombre = 'Laprida'
ON CONFLICT (nombre) DO UPDATE
  SET caja_fuerte_sucursal_id = EXCLUDED.caja_fuerte_sucursal_id,
      requiere_cuenta = FALSE, activo = TRUE;

INSERT INTO medios_pago (nombre, requiere_cuenta, activo, caja_fuerte_sucursal_id)
SELECT 'Efectivo Caja Fuerte Huaico', FALSE, TRUE, id FROM sucursales WHERE nombre = 'Huaico'
ON CONFLICT (nombre) DO UPDATE
  SET caja_fuerte_sucursal_id = EXCLUDED.caja_fuerte_sucursal_id,
      requiere_cuenta = FALSE, activo = TRUE;

-- El medio genérico se reemplaza por los dos específicos (se oculta del selector;
-- los registros históricos que lo usan quedan intactos).
UPDATE medios_pago SET activo = FALSE WHERE nombre = 'Efectivo Caja Fuerte';
