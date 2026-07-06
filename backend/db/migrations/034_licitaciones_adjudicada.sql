-- Permite adjudicar una licitación ganada y vincularla a la venta generada
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS venta_id UUID REFERENCES ventas(id);
