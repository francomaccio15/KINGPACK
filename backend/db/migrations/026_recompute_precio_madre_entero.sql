-- KINGPACK — Migración 026: forzar recompute de precio_madre a pesos enteros
--
-- La migración 025 cambió fn_calcular_precio_madre para redondear a entero, pero
-- los artículos cuyos inputs (costo/flete/margen) NO cambiaron en el seed 022
-- conservaron su precio_madre viejo de 2 decimales (ej. 999,99 en vez de 1000),
-- porque el trigger BEFORE UPDATE corta temprano cuando no cambian los inputs.
--
-- Acá se recalcula precio_madre de TODOS los artículos con la función nueva.
-- El trigger AFTER UPDATE (migración 025) recalcula las listas en cascada.

UPDATE articulos a
   SET precio_madre = fn_calcular_precio_madre(
         a.costo_base,
         a.costo_flete,
         ai.porcentaje,
         COALESCE(a.margen_aplicado, c.margen_default)
       )
  FROM alicuotas_iva ai, categorias c
 WHERE ai.id = a.alicuota_iva_id
   AND c.id  = a.categoria_id
   AND a.deleted_at IS NULL
   AND a.precio_madre IS DISTINCT FROM fn_calcular_precio_madre(
         a.costo_base, a.costo_flete, ai.porcentaje, COALESCE(a.margen_aplicado, c.margen_default)
       );
