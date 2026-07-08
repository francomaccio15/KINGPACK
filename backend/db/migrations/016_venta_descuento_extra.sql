-- =============================================================================
-- KINGPACK — Migración 016: Descuento extra a nivel venta
-- =============================================================================
-- Guarda el "descuento extra" como un dato propio de la venta, en vez de
-- repartirlo dentro del descuento de cada artículo. Así se puede mostrar como
-- un renglón aparte ("Descuento extra 5%") y los ítems conservan su descuento
-- real de lista/cliente.
--
--   descuento_extra_pct   → % aplicado sobre el subtotal bruto (precio madre).
--                           0 si el descuento extra fue un monto fijo en $.
--   descuento_extra_monto → pesos efectivamente descontados del total.
--
-- El campo `total` de la venta YA viene con este descuento restado.

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS descuento_extra_pct   NUMERIC(6,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_extra_monto NUMERIC(14,2) NOT NULL DEFAULT 0;
