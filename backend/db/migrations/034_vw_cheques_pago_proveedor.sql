-- =============================================================================
-- 034 — Cheques de Pago a Proveedores en el módulo de Cheques
-- Los cheques emitidos desde Pago a Proveedores (pago_proveedor_cheques) no
-- aparecían en la pestaña Cheques. Se les agrega ciclo de estado (emitido →
-- presentado → debitado/rechazado) y se suman a la vista unificada vw_cheques
-- como cheques 'emitido' con origen 'pago_proveedor'.
-- =============================================================================

ALTER TABLE pago_proveedor_cheques
  ADD COLUMN IF NOT EXISTS fecha_emision DATE,
  ADD COLUMN IF NOT EXISTS estado        VARCHAR(20) NOT NULL DEFAULT 'emitido'
    CHECK (estado IN ('emitido','presentado','debitado','rechazado','anulado')),
  ADD COLUMN IF NOT EXISTS fecha_estado  DATE,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

CREATE INDEX IF NOT EXISTS idx_pago_prov_cheques_estado ON pago_proveedor_cheques(estado);

-- ─── Vista unificada de cheques (recreada con la rama de pago a proveedor) ────
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
WHERE pp.anulado = FALSE;
