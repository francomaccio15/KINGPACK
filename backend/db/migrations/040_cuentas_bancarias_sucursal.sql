-- 040_cuentas_bancarias_sucursal.sql
-- Vincula cada cuenta bancaria de la empresa a una sucursal, para poder filtrar
-- los saldos en el dashboard según la sucursal seleccionada arriba.
--
-- Regla acordada con el cliente:
--   Banco Hipotecario → Huaico
--   Todas las demás   → Laprida

ALTER TABLE cuentas_bancarias_empresa
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES sucursales(id);

-- Por defecto, todas a Laprida.
UPDATE cuentas_bancarias_empresa
SET sucursal_id = (SELECT id FROM sucursales WHERE nombre = 'Laprida' LIMIT 1)
WHERE sucursal_id IS NULL;

-- La cuenta del Banco Hipotecario va a Huaico.
UPDATE cuentas_bancarias_empresa
SET sucursal_id = (SELECT id FROM sucursales WHERE nombre = 'Huaico' LIMIT 1)
WHERE banco ILIKE '%hipotecario%';
