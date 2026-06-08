-- =============================================================================
-- KINGPACK — Migración 018: Rubro y subrubro "Compra de mercadería"
-- =============================================================================

-- Agregar rubro "Compras" si no existe
INSERT INTO rubros_gastos (nombre, orden)
VALUES ('Compras', 5)
ON CONFLICT (nombre) DO NOTHING;

-- Agregar subrubro "Compra de mercadería" vinculado al rubro
INSERT INTO subrubro_gastos (nombre, rubro, rubro_id)
SELECT 'Compra de mercadería', 'Compras', r.id
FROM rubros_gastos r
WHERE r.nombre = 'Compras'
ON CONFLICT DO NOTHING;
