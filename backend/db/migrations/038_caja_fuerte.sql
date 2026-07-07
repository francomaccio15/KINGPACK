-- 038_caja_fuerte.sql
-- Caja fuerte por sucursal: acumula el efectivo físico que queda tras cada
-- cierre de caja. Cada sucursal tiene su propio saldo. El saldo se incrementa
-- automáticamente en el cierre de caja (backend) con el efectivo real contado.
--
-- Montos iniciales acordados con el cliente:
--   Huaico  → $8.241.865
--   Laprida → $0

CREATE TABLE IF NOT EXISTS caja_fuerte (
  sucursal_id UUID PRIMARY KEY REFERENCES sucursales(id) ON DELETE CASCADE,
  saldo       NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Seed de montos iniciales (idempotente: no pisa un saldo ya existente).
INSERT INTO caja_fuerte (sucursal_id, saldo)
SELECT id, 8241865 FROM sucursales WHERE nombre = 'Huaico'
ON CONFLICT (sucursal_id) DO NOTHING;

INSERT INTO caja_fuerte (sucursal_id, saldo)
SELECT id, 0 FROM sucursales WHERE nombre = 'Laprida'
ON CONFLICT (sucursal_id) DO NOTHING;
