-- KINGPACK — Migration 007: soft delete en proveedores
-- La ruta /api/proveedores ya filtra por deleted_at IS NULL pero la columna faltaba.

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_proveedores_activo
  ON proveedores(activo)
  WHERE deleted_at IS NULL;
