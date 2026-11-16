-- KINGPACK — Migración 071: cuenta fija para los cobros por QR de cada sucursal
--
-- En Huaico el QR cobra en la cuenta de Mercado Pago. La cuenta se marca con
-- `recibe_qr` + su `sucursal_id` y el backend fuerza ahí todo cobro con medio
-- QR de esa sucursal (ventas, cobranzas, movimientos de caja). Una por sucursal.
-- Sucursal sin cuenta marcada (Laprida) → se sigue eligiendo a mano.
--
-- No toca el histórico: los QR viejos de Huaico quedan en la cuenta donde
-- cayeron (decisión del usuario, 16/11/2026).

ALTER TABLE cuentas_bancarias_empresa
  ADD COLUMN IF NOT EXISTS recibe_qr BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cuenta_qr_por_sucursal
  ON cuentas_bancarias_empresa (sucursal_id) WHERE recibe_qr;

INSERT INTO cuentas_bancarias_empresa (nombre, banco, saldo, saldo_inicial, sucursal_id, recibe_qr)
SELECT 'MERCADO PAGO', 'Mercado Pago', 0, 0, s.id, TRUE
  FROM sucursales s
 WHERE s.nombre = 'Huaico'
   AND NOT EXISTS (SELECT 1 FROM cuentas_bancarias_empresa c WHERE c.nombre = 'MERCADO PAGO');

UPDATE cuentas_bancarias_empresa
   SET recibe_qr = TRUE
 WHERE nombre = 'MERCADO PAGO'
   AND sucursal_id = (SELECT id FROM sucursales WHERE nombre = 'Huaico');
