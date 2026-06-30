-- KINGPACK — Migración 025: precio base a pesos enteros + fix de listas desactualizadas
--
-- 1) fn_calcular_precio_madre redondea el precio base a pesos ENTEROS (sin centavos).
--    Las listas con descuento siguen con 2 decimales.
-- 2) Fix del bug de orden de triggers: al actualizar costo/margen, el precio_madre se
--    recalculaba bien pero las lista_precio_items quedaban con el precio VIEJO. Causa:
--    el trigger BEFORE UPDATE actualizaba las listas mientras el precio_madre nuevo aún
--    no estaba commiteado, y el trigger interno leía el valor viejo. Se separa en
--    BEFORE (setea precio_madre) + AFTER (actualiza listas, ya con el precio commiteado).
-- 3) Recompute one-time de TODAS las listas desde el precio_madre actual.

-- ── 1. Precio base a pesos enteros ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_calcular_precio_madre(
  p_costo_base      NUMERIC,
  p_costo_flete     NUMERIC,
  p_porcentaje_iva  NUMERIC,
  p_margen          NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_costo_total NUMERIC;
  v_precio      NUMERIC;
BEGIN
  -- costo_flete es % sobre el costo_base
  v_costo_total := COALESCE(p_costo_base, 0) * (1 + COALESCE(p_costo_flete, 0) / 100.0);
  v_precio := v_costo_total * (1 + COALESCE(p_margen, 0) / 100.0)
                              * (1 + COALESCE(p_porcentaje_iva, 0) / 100.0);
  -- Precio base redondeado a pesos enteros (evita centavos y coincide con el precio cargado)
  RETURN ROUND(v_precio, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 2. Fix de orden de triggers ──────────────────────────────────────────────
-- BEFORE UPDATE: solo recalcula precio_madre (ya NO toca las listas).
CREATE OR REPLACE FUNCTION fn_trg_actualizar_precio_madre()
RETURNS TRIGGER AS $$
DECLARE
  v_margen       NUMERIC;
  v_iva_pct      NUMERIC;
  v_precio_nuevo NUMERIC;
BEGIN
  IF (NEW.costo_base IS NOT DISTINCT FROM OLD.costo_base)
    AND (NEW.costo_flete IS NOT DISTINCT FROM OLD.costo_flete)
    AND (NEW.margen_aplicado IS NOT DISTINCT FROM OLD.margen_aplicado)
    AND (NEW.categoria_id IS NOT DISTINCT FROM OLD.categoria_id)
    AND (NEW.alicuota_iva_id IS NOT DISTINCT FROM OLD.alicuota_iva_id)
  THEN
    RETURN NEW;
  END IF;

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

-- AFTER UPDATE: recalcula las listas, ya con el precio_madre commiteado.
CREATE OR REPLACE FUNCTION fn_trg_listas_after_precio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.precio_madre IS DISTINCT FROM OLD.precio_madre THEN
    UPDATE lista_precio_items
       SET precio_efectivo = ROUND(NEW.precio_madre * (1 - COALESCE(descuento_pct, 0) / 100.0), 2),
           updated_at = NOW()
     WHERE articulo_id = NEW.id
       AND metodo = 'descuento_sobre_madre';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_articulo_listas_after ON articulos;
CREATE TRIGGER trg_articulo_listas_after
  AFTER UPDATE ON articulos
  FOR EACH ROW EXECUTE FUNCTION fn_trg_listas_after_precio();

-- ── 3. Recompute one-time de TODAS las listas desde el precio_madre actual ────
UPDATE lista_precio_items lpi
   SET precio_efectivo = ROUND(a.precio_madre * (1 - COALESCE(lpi.descuento_pct, 0) / 100.0), 2),
       updated_at = NOW()
  FROM articulos a
 WHERE lpi.articulo_id = a.id
   AND lpi.metodo = 'descuento_sobre_madre';
