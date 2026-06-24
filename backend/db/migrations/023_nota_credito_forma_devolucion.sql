-- 023 — Forma de devolución en notas de crédito
-- Define cómo se le devuelve el dinero al cliente:
--   'cuenta_corriente' → acredita el total al saldo del cliente (saldo a favor / cancela deuda)
--   'efectivo' / 'transferencia' → devolución física, NO toca el saldo de cuenta corriente
-- Las notas ya emitidas siempre acreditaban a cuenta corriente, así que se backfillean
-- a 'cuenta_corriente' para que su anulación revierta el saldo correctamente.

ALTER TABLE notas_credito
  ADD COLUMN IF NOT EXISTS forma_devolucion VARCHAR(20) NOT NULL DEFAULT 'cuenta_corriente';

ALTER TABLE notas_credito
  DROP CONSTRAINT IF EXISTS notas_credito_forma_devolucion_chk;

ALTER TABLE notas_credito
  ADD CONSTRAINT notas_credito_forma_devolucion_chk
  CHECK (forma_devolucion IN ('cuenta_corriente', 'efectivo', 'transferencia'));
