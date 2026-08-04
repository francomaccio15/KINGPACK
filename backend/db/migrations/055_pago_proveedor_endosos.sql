-- KINGPACK — Migración 055: endoso de cheques recibidos a proveedores
--
-- El dueño paga a sus proveedores endosando cheques que sus clientes le
-- entregaron y tiene en cartera (un traspaso del cheque). Esta tabla vincula
-- cada pago a proveedor con el/los cheque(s) recibido(s) que se endosaron.
--
-- Los cheques EMITIDOS nuevos siguen en `pago_proveedor_cheques`. Los ENDOSADOS
-- NO van ahí: son cheques recibidos ya existentes (venta_cheques /
-- cheques_manuales / movimiento_caja_cheques) que solo cambian de estado a
-- 'endosado'. Guardarlos en pago_proveedor_cheques los duplicaría como 'emitido'
-- en vw_cheques. Por eso esta tabla de vínculo aparte.
--
-- El endoso NO toca el banco de KingPack ni la cuenta corriente del cliente
-- (el cliente ya quedó saldado cuando entregó el cheque); solo paga al proveedor.

CREATE TABLE IF NOT EXISTS pago_proveedor_endosos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_proveedor_id UUID NOT NULL REFERENCES pagos_proveedor(id) ON DELETE CASCADE,
  cheque_origen     VARCHAR(20) NOT NULL,   -- 'venta' | 'manual' | 'movimiento_caja'
  cheque_id         UUID NOT NULL,
  importe           NUMERIC(14,2) NOT NULL CHECK (importe > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppe_pago   ON pago_proveedor_endosos(pago_proveedor_id);
CREATE INDEX IF NOT EXISTS idx_ppe_cheque ON pago_proveedor_endosos(cheque_origen, cheque_id);
