-- =============================================================================
-- KINGPACK — Migración 015: Historial de ediciones de ventas
-- =============================================================================

CREATE TABLE IF NOT EXISTS venta_ediciones (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id         UUID        NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  usuario_id       UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacion      TEXT,
  items_anteriores JSONB       NOT NULL DEFAULT '[]',
  items_nuevos     JSONB       NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_venta_ediciones_venta ON venta_ediciones(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_ediciones_fecha ON venta_ediciones(venta_id, fecha DESC);
