-- =============================================================================
-- 037 — Limpiar movimientos de pago_proveedor del módulo caja
-- Los pagos a proveedores son movimientos administrativos (cheques, caja fuerte,
-- transferencias) que no deben impactar en el cajón diario de ningún local.
-- Desde ahora el módulo de pagos a proveedores NO escribe en movimientos_caja.
-- Este script elimina los registros históricos que el código anterior generó.
-- =============================================================================

DELETE FROM movimientos_caja
WHERE origen_tipo IN ('pago_proveedor', 'pago_proveedor_anulado');
