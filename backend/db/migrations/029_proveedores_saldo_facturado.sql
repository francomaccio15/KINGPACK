-- =============================================================================
-- 029 — Saldo de proveedores discriminado por facturado / no facturado
-- =============================================================================
-- El saldo con cada proveedor se divide en dos: lo que se le debe con factura
-- (comprobante fiscal real) y lo que se le debe sin factura (informal / sin
-- comprobante). El saldo inicial también se separa en esos dos conceptos.

-- 1) Saldo inicial dividido
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS saldo_inicial_facturado    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_inicial_no_facturado NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Migrar el saldo inicial cargado hasta ahora al bucket "no facturado" (default
-- razonable: la deuda previa al sistema suele ser informal; se puede reajustar).
UPDATE proveedores
   SET saldo_inicial_no_facturado = saldo_inicial
 WHERE saldo_inicial <> 0 AND saldo_inicial_no_facturado = 0;

-- 2) Marca de facturado en cada movimiento de la cuenta corriente
ALTER TABLE cuentas_corrientes_proveedor
  ADD COLUMN IF NOT EXISTS facturado BOOLEAN NOT NULL DEFAULT false;

-- Backfill: los movimientos ligados a un egreso con comprobante de factura real
-- se marcan como facturados. Anticipos, correcciones e informales quedan en
-- "no facturado" (default false).
UPDATE cuentas_corrientes_proveedor cc
   SET facturado = true
  FROM egresos e
 WHERE cc.origen_id = e.id
   AND cc.origen_tipo IN ('egreso', 'pago')
   AND e.tipo_comprobante IS NOT NULL
   AND e.tipo_comprobante <> 'informal';
