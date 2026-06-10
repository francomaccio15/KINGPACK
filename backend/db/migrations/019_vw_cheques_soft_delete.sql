-- =============================================================================
-- 019 — Fix vw_cheques: excluir cheques cuyo origen (venta/egreso) fue dado de baja
-- =============================================================================
-- La vista original (017) hacía JOIN a ventas/egresos sin filtrar deleted_at,
-- por lo que un cheque seguía apareciendo aunque su venta o egreso de origen
-- hubiera sido eliminado (soft delete). Esto dejaba cheques "huérfanos" visibles.
-- Recreamos la vista agregando el filtro deleted_at IS NULL en ambas ramas.

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
WHERE v.deleted_at IS NULL

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
JOIN sucursales     s  ON s.id   = e.sucursal_id
WHERE e.deleted_at IS NULL;
