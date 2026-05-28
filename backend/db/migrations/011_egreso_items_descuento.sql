-- Agrega descuento_pct a egreso_items para registrar bonificaciones por línea
ALTER TABLE egreso_items
  ADD COLUMN IF NOT EXISTS descuento_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (descuento_pct >= 0 AND descuento_pct <= 100);
