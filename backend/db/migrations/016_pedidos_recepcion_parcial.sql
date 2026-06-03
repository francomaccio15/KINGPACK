-- =============================================================================
-- KINGPACK — Migración 016: Recepción parcial de pedidos a proveedores
-- =============================================================================

-- Agregar cantidad_recibida a pedido_items para tracking parcial
ALTER TABLE pedido_items
  ADD COLUMN IF NOT EXISTS cantidad_recibida NUMERIC(12,3) NOT NULL DEFAULT 0;

-- Índice para consultas de estado de recepción
CREATE INDEX IF NOT EXISTS idx_pedido_items_recibida
  ON pedido_items(pedido_id, cantidad_recibida);
