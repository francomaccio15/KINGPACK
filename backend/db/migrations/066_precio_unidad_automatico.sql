-- KINGPACK — Migración 066: precio por unidad automático al cambiar el del bulto
--
-- La 065 fijó una vez el precio suelto de la «Lista inicial» con 100% de margen.
-- Ahora queda como regla: cada artículo puede tener un margen de venta suelta
-- (margen_unidad_pct) y, cuando cambia el precio del bulto (por costo, margen,
-- categoría, compras, lo que sea) o las unidades por bulto, el trigger recalcula
--   precio_unidad = CEIL(precio_madre / unidades_por_bulto × (1 + margen/100))
-- redondeado SIEMPRE para arriba a pesos enteros.
--
-- NULL = sin regla: el precio por unidad se carga a mano, como antes.
-- Si el mismo UPDATE fija precio_unidad explícitamente (admin desde la pantalla),
-- ese valor manda; el próximo cambio del bulto lo vuelve a recalcular.

ALTER TABLE articulos
  ADD COLUMN IF NOT EXISTS margen_unidad_pct NUMERIC(6,2);

ALTER TABLE articulos DROP CONSTRAINT IF EXISTS articulos_margen_unidad_pct_check;
ALTER TABLE articulos ADD CONSTRAINT articulos_margen_unidad_pct_check
  CHECK (margen_unidad_pct IS NULL OR margen_unidad_pct >= 0);

CREATE OR REPLACE FUNCTION fn_trg_precio_unidad_auto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.margen_unidad_pct IS NOT NULL
     AND NEW.unidades_por_bulto > 1
     AND NEW.precio_madre > 0
     AND NEW.precio_unidad IS NOT DISTINCT FROM OLD.precio_unidad
     AND (NEW.precio_madre       IS DISTINCT FROM OLD.precio_madre
       OR NEW.unidades_por_bulto IS DISTINCT FROM OLD.unidades_por_bulto
       OR NEW.margen_unidad_pct  IS DISTINCT FROM OLD.margen_unidad_pct)
  THEN
    NEW.precio_unidad := CEIL(NEW.precio_madre / NEW.unidades_por_bulto
                              * (1 + NEW.margen_unidad_pct / 100.0));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Los BEFORE triggers corren en orden alfabético: este nombre va después de
-- trg_articulo_precio_madre, así ve el precio_madre ya recalculado.
DROP TRIGGER IF EXISTS trg_articulo_precio_unidad ON articulos;
CREATE TRIGGER trg_articulo_precio_unidad
  BEFORE UPDATE ON articulos
  FOR EACH ROW EXECUTE FUNCTION fn_trg_precio_unidad_auto();

-- «Lista inicial» (misma lista que LISTA_INICIAL del frontend): 100% de margen.
-- Al cambiar margen_unidad_pct el trigger recalcula los que ya tienen bulto.
UPDATE articulos
   SET margen_unidad_pct = 100
 WHERE deleted_at IS NULL
   AND codigo = ANY(ARRAY[
     'KP00042','KP00043','KP00020','KP00021','KP00022','KP00044','KP00045','KP00046','KP00023','KP00024',
     'KP00144','KP00038','KP00037','KP00039',
     'KP00047','KP00048','KP00049','KP00025','KP00030',
     'KP00148','KP00149','KP00150','KP00184','KP00185','KP00186','KP00194',
     'KP00175','KP00176','KP00177','KP00192','KP00193',
     'KP00011','KP00012','KP00013','KP00014','KP00015',
     'KP00356','KP00357','KP00358','KP00359','KP00360','KP00361','KP00362','KP00363','KP00365','KP00364',
     'KP00207','KP00295','KP00296','KP00297','KP00298','KP00299','KP00300','KP00301',
     'KP00302','KP00303','KP00304','KP00305','KP00306','KP00307','KP00308','KP00309',
     '389','390','391','392',
     '377','378','393'
   ]);
