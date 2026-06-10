-- =============================================================================
-- 020 — Fix vw_cheques: LEFT JOIN a clientes (cheques de ventas sin cliente)
-- =============================================================================
-- La vista usaba INNER JOIN clientes, por lo que los cheques recibidos en
-- ventas SIN cliente asignado (consumidor final, cliente_id NULL) quedaban
-- excluidos de la lista de cheques — invisibles para quien los gestiona,
-- aunque el dashboard sí los mostraba (allí ya se usa LEFT JOIN).
-- Se cambia a LEFT JOIN clientes y se conserva el filtro deleted_at de la 019.

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
  COALESCE(cl.razon_social, 'Consumidor Final') AS origen_nombre,
  v.sucursal_id,
  s.nombre            AS sucursal_nombre
FROM venta_cheques vc
JOIN ventas   v  ON v.id  = vc.venta_id
LEFT JOIN clientes cl ON cl.id = v.cliente_id
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
