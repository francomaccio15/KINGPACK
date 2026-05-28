-- Agrega plazo de pago en días por cliente (30 días por defecto)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS plazo_dias INT NOT NULL DEFAULT 30;
