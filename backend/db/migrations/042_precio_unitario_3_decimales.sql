-- =============================================================================
-- KINGPACK — Precio unitario con 3 decimales en compras
-- Migración: 042_precio_unitario_3_decimales.sql
--
-- Los proveedores facturan algunos artículos (ej. por kilo/rollo) con precio
-- unitario de 3 decimales (ej. $5.962,298). Con NUMERIC(14,2) ese tercer
-- decimal se truncaba al guardar, y el total calculado no coincidía con la
-- factura real del proveedor. Se amplía a NUMERIC(14,3) en los dos lugares
-- donde se guarda el precio unitario de compra.
-- =============================================================================

ALTER TABLE egreso_items ALTER COLUMN precio_unitario TYPE NUMERIC(14,3);
ALTER TABLE pedido_items ALTER COLUMN precio_compra    TYPE NUMERIC(14,3);
