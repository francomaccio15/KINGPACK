-- =============================================================================
-- KINGPACK — Trigger cascade precio_madre → lista_precio_items
-- Migración: 004_price_cascade_triggers.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función que calcula precio_madre a partir de costo_base, costo_flete,
-- alícuota de IVA y margen (del artículo o de la categoría)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calcular_precio_madre(
  p_costo_base      NUMERIC,
  p_costo_flete     NUMERIC,
  p_porcentaje_iva  NUMERIC,
  p_margen          NUMERIC   -- porcentaje, ej: 30 = 30%
)
RETURNS NUMERIC AS $$
DECLARE
  v_costo_total NUMERIC;
  v_precio      NUMERIC;
BEGIN
  v_costo_total := COALESCE(p_costo_base, 0) + COALESCE(p_costo_flete, 0);
  -- Aplica margen sobre costo total (incluye IVA en el precio final)
  v_precio := v_costo_total * (1 + COALESCE(p_margen, 0) / 100.0)
                              * (1 + COALESCE(p_porcentaje_iva, 0) / 100.0);
  RETURN ROUND(v_precio, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- Trigger en articulos: cuando cambian costo_base, costo_flete o margen_aplicado
-- 1. Recalcula precio_madre
-- 2. Actualiza lista_precio_items con metodo='descuento_sobre_madre'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_actualizar_precio_madre()
RETURNS TRIGGER AS $$
DECLARE
  v_margen       NUMERIC;
  v_iva_pct      NUMERIC;
  v_precio_nuevo NUMERIC;
BEGIN
  -- Solo actuar si cambiaron campos relevantes
  IF (NEW.costo_base IS NOT DISTINCT FROM OLD.costo_base)
    AND (NEW.costo_flete IS NOT DISTINCT FROM OLD.costo_flete)
    AND (NEW.margen_aplicado IS NOT DISTINCT FROM OLD.margen_aplicado)
    AND (NEW.categoria_id IS NOT DISTINCT FROM OLD.categoria_id)
    AND (NEW.alicuota_iva_id IS NOT DISTINCT FROM OLD.alicuota_iva_id)
  THEN
    RETURN NEW;
  END IF;

  -- Resolver margen: del artículo si está seteado, sino de la categoría
  SELECT COALESCE(NEW.margen_aplicado, c.margen_default)
    INTO v_margen
    FROM categorias c
   WHERE c.id = NEW.categoria_id;

  -- Resolver alícuota IVA
  SELECT porcentaje INTO v_iva_pct
    FROM alicuotas_iva
   WHERE id = NEW.alicuota_iva_id;

  -- Calcular nuevo precio_madre
  v_precio_nuevo := fn_calcular_precio_madre(
    NEW.costo_base, NEW.costo_flete, v_iva_pct, v_margen
  );

  NEW.precio_madre := v_precio_nuevo;

  -- Actualizar lista_precio_items que derivan del precio_madre
  UPDATE lista_precio_items
     SET precio_efectivo = ROUND(v_precio_nuevo * (1 - COALESCE(descuento_pct, 0) / 100.0), 2),
         updated_at = NOW()
   WHERE articulo_id = NEW.id
     AND metodo = 'descuento_sobre_madre';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articulo_precio_madre
  BEFORE UPDATE ON articulos
  FOR EACH ROW EXECUTE FUNCTION fn_trg_actualizar_precio_madre();

-- -----------------------------------------------------------------------------
-- Trigger en articulos INSERT: inicializa precio_madre y crea items en todas
-- las listas activas con metodo='descuento_sobre_madre' usando el descuento_base_pct
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_init_precio_madre()
RETURNS TRIGGER AS $$
DECLARE
  v_margen   NUMERIC;
  v_iva_pct  NUMERIC;
  v_lista    RECORD;
BEGIN
  SELECT COALESCE(NEW.margen_aplicado, c.margen_default)
    INTO v_margen
    FROM categorias c
   WHERE c.id = NEW.categoria_id;

  SELECT porcentaje INTO v_iva_pct
    FROM alicuotas_iva
   WHERE id = NEW.alicuota_iva_id;

  NEW.precio_madre := fn_calcular_precio_madre(
    NEW.costo_base, NEW.costo_flete, v_iva_pct, v_margen
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articulo_init_precio_madre
  BEFORE INSERT ON articulos
  FOR EACH ROW EXECUTE FUNCTION fn_trg_init_precio_madre();

-- Después del INSERT crea los ítems de lista automáticamente
CREATE OR REPLACE FUNCTION fn_trg_crear_lista_items()
RETURNS TRIGGER AS $$
DECLARE
  v_lista RECORD;
BEGIN
  FOR v_lista IN
    SELECT id, descuento_base_pct FROM listas_precios WHERE activo = TRUE
  LOOP
    INSERT INTO lista_precio_items
      (lista_id, articulo_id, metodo, descuento_pct, precio_efectivo)
    VALUES (
      v_lista.id,
      NEW.id,
      'descuento_sobre_madre',
      COALESCE(v_lista.descuento_base_pct, 0),
      ROUND(NEW.precio_madre * (1 - COALESCE(v_lista.descuento_base_pct, 0) / 100.0), 2)
    )
    ON CONFLICT (lista_id, articulo_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articulo_crear_lista_items
  AFTER INSERT ON articulos
  FOR EACH ROW EXECUTE FUNCTION fn_trg_crear_lista_items();

-- -----------------------------------------------------------------------------
-- Trigger en lista_precio_items: cuando se cambia descuento_pct en un ítem
-- de tipo 'descuento_sobre_madre', recalcula precio_efectivo automáticamente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_recalcular_precio_item()
RETURNS TRIGGER AS $$
DECLARE
  v_precio_madre NUMERIC;
BEGIN
  IF NEW.metodo = 'descuento_sobre_madre' THEN
    SELECT precio_madre INTO v_precio_madre
      FROM articulos WHERE id = NEW.articulo_id;
    NEW.precio_efectivo := ROUND(v_precio_madre * (1 - COALESCE(NEW.descuento_pct, 0) / 100.0), 2);
  ELSE
    NEW.precio_efectivo := COALESCE(NEW.precio_override, 0);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lista_precio_item_recalcular
  BEFORE INSERT OR UPDATE ON lista_precio_items
  FOR EACH ROW EXECUTE FUNCTION fn_trg_recalcular_precio_item();

-- -----------------------------------------------------------------------------
-- Trigger en categorias: cuando cambia margen_default, actualiza precio_madre
-- de todos los artículos sin margen_aplicado propio
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_categoria_margen()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.margen_default IS DISTINCT FROM OLD.margen_default THEN
    -- Forzar recálculo disparando el trigger de artículos
    UPDATE articulos
       SET margen_aplicado = margen_aplicado   -- no-op value change, dispara el trigger
     WHERE categoria_id = NEW.id
       AND margen_aplicado IS NULL
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_categoria_margen_cascade
  AFTER UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION fn_trg_categoria_margen();
