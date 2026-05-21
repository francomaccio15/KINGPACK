-- 008_pedidos_desde_egresos.sql
-- Los pedidos a proveedores ahora se generan automáticamente desde egresos tipo
-- compra_mercaderia. El stock se acredita recién cuando se confirma la recepción.

ALTER TABLE pedidos_compra
  ADD COLUMN IF NOT EXISTS egreso_id       UUID REFERENCES egresos(id),
  ADD COLUMN IF NOT EXISTS stock_acreditado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_egreso_id
  ON pedidos_compra(egreso_id)
  WHERE egreso_id IS NOT NULL;
