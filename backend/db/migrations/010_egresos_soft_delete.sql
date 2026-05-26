ALTER TABLE egresos
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;

CREATE INDEX IF NOT EXISTS idx_egresos_deleted ON egresos(deleted_at) WHERE deleted_at IS NULL;
