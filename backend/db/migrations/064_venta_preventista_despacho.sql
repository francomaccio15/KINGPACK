-- KINGPACK — Migración 064: ventas confirmadas por el preventista → despacho
--
-- El preventista (rol vendedor/comercial) ahora confirma su propio presupuesto
-- como venta en CUENTA CORRIENTE (no toca caja). Esa venta queda "pendiente de
-- despacho" y le avisa al cajero de la sucursal por la campanita; el cajero la
-- envía, la marca como despachada y después cobra por Cobranzas (ahí recién
-- entra la plata a la caja).

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS despacho_pendiente BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmada_por     UUID        REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS despachada_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS despachada_por     UUID        REFERENCES usuarios(id);

CREATE INDEX IF NOT EXISTS idx_ventas_despacho_pendiente
  ON ventas (sucursal_id) WHERE despacho_pendiente;
