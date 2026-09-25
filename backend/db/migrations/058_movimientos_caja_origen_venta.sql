-- =============================================================================
-- KINGPACK — 058: vincular los movimientos de caja de venta por origen_id
-- =============================================================================
-- Los cobros de venta eran el único origen que no llenaba origen_tipo/origen_id:
-- el vínculo con la venta vivía sólo en el texto del concepto ('Venta #N'). Eso
-- obligaba a buscar y borrar movimientos por ese texto al editar una venta, y
-- los números de venta se repiten entre sucursales (Huaico y Laprida tienen su
-- propia numeración), así que el único colchón contra tocar la fila equivocada
-- era que la caja pertenece a una sucursal.
--
-- Este backfill deja el vínculo explícito en las filas históricas. El cruce es
-- concepto 'Venta #N' + la sucursal de la caja -> ventas.numero + sucursal_id,
-- verificado contra producción: las 3636 filas resuelven a exactamente una
-- venta (cero ambiguas, cero sin match).
--
-- Idempotente: sólo toca filas con origen_id IS NULL.
-- =============================================================================

-- Búsqueda de los movimientos de un comprobante (la que usa editar venta).
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_origen
  ON movimientos_caja (origen_tipo, origen_id)
  WHERE origen_id IS NOT NULL;

UPDATE movimientos_caja mc
   SET origen_tipo = 'venta',
       origen_id   = v.id
  FROM cajas c, ventas v
 WHERE mc.caja_id = c.id
   AND mc.tipo = 'venta'
   AND mc.origen_id IS NULL
   AND mc.concepto ~ '^Venta #[0-9]+'
   AND v.numero = (regexp_replace(mc.concepto, '^Venta #([0-9]+).*$', '\1'))::int
   AND v.sucursal_id = c.sucursal_id
   AND v.deleted_at IS NULL;
