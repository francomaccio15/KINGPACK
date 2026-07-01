-- Vincula un movimiento de egreso en caja con su registro formal en la tabla egresos
ALTER TABLE movimientos_caja
  ADD COLUMN IF NOT EXISTS egreso_id UUID REFERENCES egresos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_egreso ON movimientos_caja(egreso_id) WHERE egreso_id IS NOT NULL;
