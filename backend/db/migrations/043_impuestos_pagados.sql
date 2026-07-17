-- 043 — Registro de pagos de obligaciones impositivas
-- Permite marcar como "pagada" una obligación recurrente (TISH, Rentas Salta,
-- nacionales, monotributo, etc.) para un período (mes) puntual, y así apagar
-- el recordatorio de la campanita aunque todavía esté dentro de la ventana de
-- vencimiento (día - 3 hasta día + 3).

CREATE TABLE IF NOT EXISTS impuestos_pagados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligacion  VARCHAR(50) NOT NULL,
  periodo     DATE NOT NULL, -- primer día del mes que cubre el pago
  usuario_id  UUID REFERENCES usuarios(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obligacion, periodo)
);
