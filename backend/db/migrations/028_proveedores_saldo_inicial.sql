-- =============================================================================
-- 028 — Saldo inicial de proveedores
-- =============================================================================
-- Permite arrancar la cuenta corriente de cada proveedor con un saldo de apertura
-- (lo que ya se le debía antes de empezar a usar el sistema). El saldo en tiempo
-- real del listado = saldo_inicial + Σ egresos (debe) − Σ pagos (haber).
-- Positivo = le debemos al proveedor.

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0;
