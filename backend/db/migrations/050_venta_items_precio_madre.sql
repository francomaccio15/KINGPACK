-- Congela el precio madre en cada ítem de venta.
-- Antes, el detalle/PDF de una venta calculaba el % de descuento comparando el
-- precio final contra el precio_madre VIVO del artículo. Si el madre cambiaba
-- después de la venta, el descuento mostrado quedaba mal (o desaparecía). Con el
-- madre congelado, el descuento de la lista se muestra estable y para siempre.
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS precio_madre NUMERIC(14,2);

-- Backfill de ventas existentes: sin dato histórico, se usa el madre actual del
-- artículo (mismo comportamiento que tenían hasta ahora). Las ventas nuevas ya
-- guardan el madre real del momento.
UPDATE venta_items vi
   SET precio_madre = a.precio_madre
  FROM articulos a
 WHERE a.id = vi.articulo_id
   AND vi.precio_madre IS NULL;
