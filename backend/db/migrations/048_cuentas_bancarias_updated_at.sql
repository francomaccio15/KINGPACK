-- KINGPACK — Migración 048: `updated_at` en cuentas_bancarias_empresa
--
-- La migración 046 dejó el saldo bancario a cargo de los helpers de
-- `movimientos-bancarios.js`, que hacen
--
--   UPDATE cuentas_bancarias_empresa SET saldo = saldo ± $1, updated_at = NOW()
--
-- pero la tabla nunca tuvo `updated_at` (viene de la mig 039 sin timestamps).
-- Resultado: TODO pago o cobro contra una cuenta bancaria venía fallando con
-- 500 ("column updated_at ... does not exist") y la transacción entera hacía
-- rollback. Por eso `movimientos_cuenta_bancaria` estaba en 0 filas.
--
-- No hay datos que reparar: al abortar la transacción no se grabó ni el pago ni
-- el movimiento. El saldo sigue valiendo `saldo_inicial`, invariante intacto.

ALTER TABLE cuentas_bancarias_empresa
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
