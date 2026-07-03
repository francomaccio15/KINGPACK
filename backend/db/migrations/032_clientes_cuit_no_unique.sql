-- =============================================================================
-- 032 — Permitir múltiples clientes con el mismo CUIT
-- =============================================================================
-- En la vida real una misma persona/empresa (mismo CUIT) puede necesitar varias
-- cuentas separadas en el sistema (distintas sucursales, condiciones comerciales,
-- cuentas corrientes independientes, etc.). La identidad real del cliente es su
-- id (UUID, PK); el CUIT es sólo un dato fiscal y de búsqueda, y todas las
-- relaciones (ventas, cuenta corriente, facturación) cuelgan del id, nunca del
-- CUIT. Por eso quitar la unicidad del CUIT es seguro.
--
-- El alta/edición ya no bloquea por CUIT duplicado; en su lugar la app avisa
-- (no bloquea) cuando el CUIT ya existe, para frenar duplicados por error de
-- tipeo sin impedir los duplicados intencionales.

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_cuit_key;

-- El índice parcial de búsqueda por CUIT (idx_clientes_cuit) NO es único y se
-- mantiene intacto para no perder performance en las búsquedas por CUIT.
