-- =============================================================================
-- Módulo de Cheques: estados, auditoría y vista unificada
-- =============================================================================

-- ─── 1. Estado en cheques recibidos (de clientes) ────────────────────────────
ALTER TABLE venta_cheques
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'en_cartera'
    CHECK (estado IN ('en_cartera','depositado','acreditado','endosado','rechazado','anulado')),
  ADD COLUMN IF NOT EXISTS fecha_estado  DATE,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- ─── 2. Estado en cheques emitidos (a proveedores) ───────────────────────────
ALTER TABLE egreso_cheques
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'emitido'
    CHECK (estado IN ('emitido','presentado','debitado','rechazado','anulado')),
  ADD COLUMN IF NOT EXISTS fecha_estado  DATE,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- ─── 3. Historial de estados (auditoría) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS cheque_historial_estados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cheque_tipo     VARCHAR(10)   NOT NULL CHECK (cheque_tipo IN ('recibido','emitido')),
  cheque_id       UUID          NOT NULL,
  estado_anterior VARCHAR(20),
  estado_nuevo    VARCHAR(20)   NOT NULL,
  observacion     TEXT,
  usuario_id      UUID REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cheque_historial_cheque
  ON cheque_historial_estados(cheque_tipo, cheque_id);

-- ─── 4. Índices de estado ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_venta_cheques_estado  ON venta_cheques(estado);
CREATE INDEX IF NOT EXISTS idx_egreso_cheques_estado ON egreso_cheques(estado);

-- ─── 5. Vista unificada ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_cheques AS
SELECT
  'recibido'          AS tipo,
  vc.id,
  vc.banco,
  vc.numero_cheque,
  vc.fecha_emision,
  vc.fecha_vencimiento,
  vc.importe,
  vc.estado,
  vc.fecha_estado,
  vc.observaciones,
  v.id                AS origen_id,
  'venta'             AS origen_tipo,
  cl.razon_social     AS origen_nombre,
  v.sucursal_id,
  s.nombre            AS sucursal_nombre
FROM venta_cheques vc
JOIN ventas   v  ON v.id  = vc.venta_id
JOIN clientes cl ON cl.id = v.cliente_id
JOIN sucursales s ON s.id = v.sucursal_id

UNION ALL

SELECT
  'emitido'           AS tipo,
  ec.id,
  ec.banco,
  ec.numero_cheque,
  ec.fecha_emision,
  ec.fecha_vencimiento,
  ec.importe,
  ec.estado,
  ec.fecha_estado,
  ec.observaciones,
  e.id                AS origen_id,
  'egreso'            AS origen_tipo,
  COALESCE(pr.razon_social, 'Sin proveedor') AS origen_nombre,
  e.sucursal_id,
  s.nombre            AS sucursal_nombre
FROM egreso_cheques ec
JOIN egreso_pagos   ep ON ep.id  = ec.egreso_pago_id
JOIN egresos        e  ON e.id   = ep.egreso_id
LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
JOIN sucursales     s  ON s.id   = e.sucursal_id;
