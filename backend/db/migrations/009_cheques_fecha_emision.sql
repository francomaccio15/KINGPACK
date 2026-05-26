-- Agregar fecha de emisión a cheques de egresos
ALTER TABLE egreso_cheques
  ADD COLUMN IF NOT EXISTS fecha_emision DATE;

-- Tabla de cheques para ventas
CREATE TABLE IF NOT EXISTS venta_cheques (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id          UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  medio_pago_id     UUID NOT NULL REFERENCES medios_pago(id),
  banco             VARCHAR(80)    NOT NULL,
  numero_cheque     VARCHAR(30)    NOT NULL,
  fecha_emision     DATE           NOT NULL,
  fecha_vencimiento DATE           NOT NULL,
  importe           NUMERIC(14,2)  NOT NULL CHECK (importe > 0),
  FOREIGN KEY (venta_id, medio_pago_id)
    REFERENCES venta_pagos(venta_id, medio_pago_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_venta_cheques_venta ON venta_cheques(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_cheques_venc  ON venta_cheques(fecha_vencimiento);
