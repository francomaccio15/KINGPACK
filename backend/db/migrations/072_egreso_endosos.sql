-- KINGPACK — Migración 072: endoso de cheques recibidos para pagar egresos
--
-- Además de pagarles a proveedores (mig 055), Maxi entrega cheques de clientes
-- que tiene en cartera para pagar otros egresos: sueldos, retiros, gastos.
-- Esta tabla ata cada cheque endosado a la línea de pago del egreso.
--
-- Igual que en Pago a Proveedores: el cheque no se vuelve a cargar como emitido
-- (lo duplicaría en vw_cheques); solo pasa de 'en_cartera' a 'endosado'. No toca
-- el banco de KingPack ni la cuenta corriente del cliente.
--
-- Al anular el pago del egreso, la fila se borra por CASCADE después de
-- devolver el cheque a cartera.

CREATE TABLE IF NOT EXISTS egreso_endosos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  egreso_pago_id UUID NOT NULL REFERENCES egreso_pagos(id) ON DELETE CASCADE,
  egreso_id      UUID NOT NULL REFERENCES egresos(id),
  cheque_origen  VARCHAR(20) NOT NULL,   -- 'venta' | 'manual' | 'movimiento_caja'
  cheque_id      UUID NOT NULL,
  importe        NUMERIC(14,2) NOT NULL CHECK (importe > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ee_pago   ON egreso_endosos(egreso_pago_id);
CREATE INDEX IF NOT EXISTS idx_ee_egreso ON egreso_endosos(egreso_id);
CREATE INDEX IF NOT EXISTS idx_ee_cheque ON egreso_endosos(cheque_origen, cheque_id);
