-- Corrige el precio_madre congelado de las ventas históricas.
--
-- La migración 050 rellenó las ventas viejas con el precio_madre ACTUAL del
-- artículo. Eso mostraba un descuento equivocado cuando el precio del artículo
-- había cambiado después de la venta: p.ej. la venta #225 se hizo con madre
-- ~$8.000 (10% de la lista → $7.200), pero al usar el madre actual ($9.500)
-- mostraba 24,2% en lugar del 10% real de la lista.
--
-- El precio de lista congelado (venta_items.precio_lista) SÍ es correcto: es el
-- precio con el descuento de la lista ya aplicado al momento de vender. Como la
-- lista es un % sobre el madre (metodo 'descuento_sobre_madre'), se reconstruye
-- el madre de ese momento:
--     madre_histórico = precio_lista / (1 - descuento_lista/100)
-- Si el artículo no tenía descuento de lista (sin lista, precio_fijo, o 0%), el
-- madre queda igual al precio de lista (no se inventa ningún descuento; un
-- descuento manual extra sigue visible porque precio_final < precio_lista).
UPDATE venta_items vi
   SET precio_madre = ROUND(
     vi.precio_lista / (1 - LEAST(COALESCE((
       SELECT lpi.descuento_pct
         FROM lista_precio_items lpi
         JOIN ventas v ON v.id = vi.venta_id
        WHERE lpi.lista_id    = v.lista_precio_id
          AND lpi.articulo_id = vi.articulo_id
          AND lpi.metodo      = 'descuento_sobre_madre'
     ), 0), 99) / 100.0), 2)
 WHERE vi.precio_lista > 0;
