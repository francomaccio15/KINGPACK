-- =============================================================================
-- 036 — Cheques en movimientos de caja manual
-- Permite guardar el detalle de cheques recibidos al registrar un movimiento
-- de ingreso en caja con medio de pago "Cheque". Los cheques aparecen en la
-- vista unificada vw_cheques como tipo 'recibido' con origen 'movimiento_caja'.
-- =============================================================================

CREATE TABLE movimiento_caja_cheques (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id     UUID NOT NULL REFERENCES movimientos_caja(id) ON DELETE CASCADE,
  banco             VARCHAR(80),
  numero_cheque     VARCHAR(30),
  fecha_vencimiento DATE,
  importe           NUMERIC(14,2) NOT NULL CHECK (importe > 0),
  estado            VARCHAR(20) NOT NULL DEFAULT 'en_cartera'
    CHECK (estado IN ('en_cartera','depositado','acreditado','endosado','rechazado','anulado')),
  fecha_estado      DATE,
  observaciones     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimiento_caja_cheques_mov   ON movimiento_caja_cheques(movimiento_id);
CREATE INDEX idx_movimiento_caja_cheques_estado ON movimiento_caja_cheques(estado);

-- ─── Vista unificada (se agrega la rama de cheques de caja manual) ────────────
CREATE OR REPLACE VIEW vw_cheques AS
SELECT
  'recibido'          AS tipo,
  vc.id, vc.banco, vc.numero_cheque, vc.fecha_emision, vc.fecha_vencimiento,
  vc.importe, vc.estado, vc.fecha_estado, vc.observaciones,
  v.id                AS origen_id,
  'venta'             AS origen_tipo,
  COALESCE(cl.razon_social, 'Consumidor Final') AS origen_nombre,
  v.sucursal_id, s.nombre AS sucursal_nombre
FROM venta_cheques vc
JOIN ventas   v  ON v.id  = vc.venta_id
LEFT JOIN clientes cl ON cl.id = v.cliente_id
JOIN sucursales s ON s.id = v.sucursal_id
WHERE v.deleted_at IS NULL

UNION ALL

SELECT
  'emitido'           AS tipo,
  ec.id, ec.banco, ec.numero_cheque, ec.fecha_emision, ec.fecha_vencimiento,
  ec.importe, ec.estado, ec.fecha_estado, ec.observaciones,
  e.id                AS origen_id,
  'egreso'            AS origen_tipo,
  COALESCE(pr.razon_social, 'Sin proveedor') AS origen_nombre,
  e.sucursal_id, s.nombre AS sucursal_nombre
FROM egreso_cheques ec
JOIN egreso_pagos   ep ON ep.id  = ec.egreso_pago_id
JOIN egresos        e  ON e.id   = ep.egreso_id
LEFT JOIN proveedores pr ON pr.id = e.proveedor_id
JOIN sucursales     s  ON s.id   = e.sucursal_id
WHERE e.deleted_at IS NULL

UNION ALL

SELECT
  cm.tipo             AS tipo,
  cm.id, cm.banco, cm.numero_cheque, cm.fecha_emision, cm.fecha_vencimiento,
  cm.importe, cm.estado, cm.fecha_estado, cm.observaciones,
  cm.id               AS origen_id,
  'manual'            AS origen_tipo,
  COALESCE(cl.razon_social, pr.razon_social, 'Carga manual') AS origen_nombre,
  cm.sucursal_id, s.nombre AS sucursal_nombre
FROM cheques_manuales cm
LEFT JOIN clientes    cl ON cl.id = cm.cliente_id
LEFT JOIN proveedores pr ON pr.id = cm.proveedor_id
JOIN sucursales       s  ON s.id  = cm.sucursal_id
WHERE cm.deleted_at IS NULL

UNION ALL

SELECT
  'emitido'           AS tipo,
  ppc.id, ppc.banco, ppc.numero_cheque, ppc.fecha_emision, ppc.fecha_vencimiento,
  ppc.importe, ppc.estado, ppc.fecha_estado,
  COALESCE(ppc.observaciones, pp.observaciones) AS observaciones,
  pp.id               AS origen_id,
  'pago_proveedor'    AS origen_tipo,
  COALESCE(pr.razon_social, 'Sin proveedor') AS origen_nombre,
  pp.sucursal_id, s.nombre AS sucursal_nombre
FROM pago_proveedor_cheques ppc
JOIN pagos_proveedor pp ON pp.id = ppc.pago_proveedor_id
LEFT JOIN proveedores pr ON pr.id = pp.proveedor_id
LEFT JOIN sucursales  s  ON s.id  = pp.sucursal_id
WHERE pp.anulado = FALSE

UNION ALL

SELECT
  'recibido'          AS tipo,
  mcc.id, mcc.banco, mcc.numero_cheque,
  NULL                AS fecha_emision,
  mcc.fecha_vencimiento,
  mcc.importe, mcc.estado, mcc.fecha_estado, mcc.observaciones,
  mc.id               AS origen_id,
  'movimiento_caja'   AS origen_tipo,
  mc.concepto         AS origen_nombre,
  c.sucursal_id,      s.nombre AS sucursal_nombre
FROM movimiento_caja_cheques mcc
JOIN movimientos_caja mc ON mc.id = mcc.movimiento_id
JOIN cajas            c  ON c.id  = mc.caja_id
JOIN sucursales       s  ON s.id  = c.sucursal_id;
