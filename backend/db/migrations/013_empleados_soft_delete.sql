-- 013_empleados_soft_delete.sql
-- Agrega soft-delete y columna email a la tabla empleados

ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email      VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_empleados_activos
  ON empleados(activo, sucursal_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_empleados_deleted
  ON empleados(deleted_at)
  WHERE deleted_at IS NULL;
