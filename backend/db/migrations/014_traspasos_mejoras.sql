-- =============================================================================
-- KINGPACK — Migración 014: Mejoras tabla traspasos
-- Agrega columna notas y estado 'cancelado'
-- =============================================================================

-- Agregar columna notas
ALTER TABLE traspasos ADD COLUMN IF NOT EXISTS notas TEXT;

-- Actualizar constraint de estado para incluir 'cancelado'
ALTER TABLE traspasos DROP CONSTRAINT IF EXISTS traspasos_estado_check;
ALTER TABLE traspasos ADD CONSTRAINT traspasos_estado_check
  CHECK (estado IN ('pendiente', 'en_transito', 'recibido', 'cancelado'));
