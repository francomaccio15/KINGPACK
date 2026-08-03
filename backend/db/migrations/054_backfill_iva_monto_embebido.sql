-- KINGPACK — Migración 054: recalcular venta_items.iva_monto (IVA embebido)
--
-- El precio de venta SIEMPRE incluye el IVA. El IVA contenido en una línea es
-- bruto − bruto/(1+alíc/100), NO bruto × alíc/100 (que sobreestimaba). Además
-- ahora se guarda a nivel línea (× cantidad), no por unidad.
--
-- Este backfill deja el histórico consistente con la fórmula nueva de ventas.js
-- y licitaciones.js, para que el Libro IVA Ventas y la Posición IVA (que suman
-- venta_items.iva_monto) queden correctos también para las ventas ya cargadas.
--
-- Nota: la vista de la venta y el PDF de factura recalculan el IVA por su cuenta
-- a partir de precio_unitario_final, así que este cambio no afecta pantallas.
-- Históricamente todos los artículos estaban al 21%.

UPDATE venta_items vi
   SET iva_monto = ROUND(
         (vi.precio_unitario_final * vi.cantidad)
         * COALESCE(ai.porcentaje, 0)
         / (100 + COALESCE(ai.porcentaje, 0))
       , 2)
  FROM articulos a
  LEFT JOIN alicuotas_iva ai ON ai.id = a.alicuota_iva_id
 WHERE a.id = vi.articulo_id;
