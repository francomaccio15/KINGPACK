-- KINGPACK — Migración 060: fecha de emisión en los cheques de movimientos de caja
--
-- movimiento_caja_cheques nunca tuvo fecha_emision (vw_cheques devolvía NULL).
-- Desde la mig 059 la emisión es obligatoria en altas nuevas —sin ella no se
-- puede validar la vigencia de 30/360 días—, así que la columna tiene que
-- existir en las cinco puertas de entrada. El histórico queda en NULL.

ALTER TABLE movimiento_caja_cheques ADD COLUMN IF NOT EXISTS fecha_emision DATE;

-- Vista: idéntica a la 059 salvo la rama de caja, que ahora lee la columna.
CREATE OR REPLACE VIEW vw_cheques AS
SELECT
  'recibido'          AS tipo,
  vc.id, vc.banco, vc.numero_cheque, vc.fecha_emision, vc.fecha_vencimiento,
  vc.importe, vc.estado, vc.fecha_estado, vc.observaciones,
  v.id                AS origen_id,
  'venta'             AS origen_tipo,
  COALESCE(cl.razon_social, 'Consumidor Final') AS origen_nombre,
  v.sucursal_id, s.nombre AS sucursal_nombre,
  vc.forma, vc.modalidad, vc.librador_cuit,
  COALESCE(vc.librador_nombre, cl.razon_social) AS librador_nombre,
  vc.banco_sucursal, vc.banco_cbu, vc.rechazo_causal,
  vc.deposito_cuenta_id, vc.endoso_proveedor_id, vc.endoso_comprobante, vc.endoso_fecha
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
  e.sucursal_id, s.nombre AS sucursal_nombre,
  ec.forma, ec.modalidad, ec.librador_cuit, ec.librador_nombre,
  ec.banco_sucursal, ec.banco_cbu, ec.rechazo_causal,
  ec.deposito_cuenta_id, ec.endoso_proveedor_id, ec.endoso_comprobante, ec.endoso_fecha
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
  cm.sucursal_id, s.nombre AS sucursal_nombre,
  cm.forma, cm.modalidad, cm.librador_cuit,
  COALESCE(cm.librador_nombre, cl.razon_social) AS librador_nombre,
  cm.banco_sucursal, cm.banco_cbu, cm.rechazo_causal,
  cm.deposito_cuenta_id, cm.endoso_proveedor_id, cm.endoso_comprobante, cm.endoso_fecha
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
  pp.sucursal_id, s.nombre AS sucursal_nombre,
  ppc.forma, ppc.modalidad, ppc.librador_cuit, ppc.librador_nombre,
  ppc.banco_sucursal, ppc.banco_cbu, ppc.rechazo_causal,
  ppc.deposito_cuenta_id, ppc.endoso_proveedor_id, ppc.endoso_comprobante, ppc.endoso_fecha
FROM pago_proveedor_cheques ppc
JOIN pagos_proveedor pp ON pp.id = ppc.pago_proveedor_id
LEFT JOIN proveedores pr ON pr.id = pp.proveedor_id
LEFT JOIN sucursales  s  ON s.id  = pp.sucursal_id
WHERE pp.anulado = FALSE

UNION ALL

SELECT
  'recibido'          AS tipo,
  mcc.id, mcc.banco, mcc.numero_cheque,
  mcc.fecha_emision,
  mcc.fecha_vencimiento,
  mcc.importe, mcc.estado, mcc.fecha_estado, mcc.observaciones,
  mc.id               AS origen_id,
  'movimiento_caja'   AS origen_tipo,
  mc.concepto         AS origen_nombre,
  c.sucursal_id,      s.nombre AS sucursal_nombre,
  mcc.forma, mcc.modalidad, mcc.librador_cuit, mcc.librador_nombre,
  mcc.banco_sucursal, mcc.banco_cbu, mcc.rechazo_causal,
  mcc.deposito_cuenta_id, mcc.endoso_proveedor_id, mcc.endoso_comprobante, mcc.endoso_fecha
FROM movimiento_caja_cheques mcc
JOIN movimientos_caja mc ON mc.id = mcc.movimiento_id
JOIN cajas            c  ON c.id  = mc.caja_id
JOIN sucursales       s  ON s.id  = c.sucursal_id;
