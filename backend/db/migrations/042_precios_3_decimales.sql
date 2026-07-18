-- KINGPACK — Migración 042: precios unitarios con 3 decimales
--
-- Objetivo: permitir ingresar y almacenar PRECIOS UNITARIOS con 3 decimales
-- (modelo "precio por litro de nafta": el precio unitario lleva 3 decimales,
-- pero los importes/totales cobrados siguen en 2 decimales / centavos, como
-- exige AFIP para los comprobantes electrónicos).
--
-- Alcance:
--   • Se ensancha la ESCALA de las columnas de precio unitario de (14,2) a (14,3).
--     Es una conversión SIN PÉRDIDA: los valores existentes ganan un tercer
--     decimal ".x0" y siguen siendo válidos.
--   • NO se tocan: precio_madre (sigue en pesos enteros, decisión de negocio),
--     ni los totales/subtotales/saldos/iva_monto (siguen en 2 decimales), ni
--     los importes fiscales que van a AFIP.
--   • Los triggers que derivan precios de lista pasan a redondear a 3 decimales.

-- ── 1. Columnas de precio unitario → NUMERIC(14,3) ───────────────────────────
ALTER TABLE articulos          ALTER COLUMN costo_base            TYPE NUMERIC(14,3);
ALTER TABLE lista_precio_items ALTER COLUMN precio_override       TYPE NUMERIC(14,3);
ALTER TABLE lista_precio_items ALTER COLUMN precio_efectivo       TYPE NUMERIC(14,3);
ALTER TABLE pedido_items       ALTER COLUMN precio_compra         TYPE NUMERIC(14,3);
ALTER TABLE egreso_items       ALTER COLUMN precio_unitario       TYPE NUMERIC(14,3);
ALTER TABLE venta_items        ALTER COLUMN precio_lista          TYPE NUMERIC(14,3);
ALTER TABLE venta_items        ALTER COLUMN precio_unitario_final TYPE NUMERIC(14,3);
ALTER TABLE licitacion_items   ALTER COLUMN precio_licitacion     TYPE NUMERIC(14,3);

-- ── 2. Triggers de precios de lista: redondeo a 3 decimales ──────────────────
-- precio_efectivo de un ítem de lista (método 'descuento_sobre_madre' usa el
-- precio_madre; 'precio_fijo' usa precio_override que ahora lleva 3 decimales).
CREATE OR REPLACE FUNCTION fn_trg_recalcular_precio_item()
RETURNS TRIGGER AS $$
DECLARE
  v_precio_madre NUMERIC;
BEGIN
  IF NEW.metodo = 'descuento_sobre_madre' THEN
    SELECT precio_madre INTO v_precio_madre
      FROM articulos WHERE id = NEW.articulo_id;
    NEW.precio_efectivo := ROUND(v_precio_madre * (1 - COALESCE(NEW.descuento_pct, 0) / 100.0), 3);
  ELSE
    NEW.precio_efectivo := COALESCE(NEW.precio_override, 0);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Creación de ítems de lista al insertar un artículo.
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
      ROUND(NEW.precio_madre * (1 - COALESCE(v_lista.descuento_base_pct, 0) / 100.0), 3)
    )
    ON CONFLICT (lista_id, articulo_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalculo de listas cuando cambia el precio_madre del artículo (AFTER UPDATE).
CREATE OR REPLACE FUNCTION fn_trg_listas_after_precio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.precio_madre IS DISTINCT FROM OLD.precio_madre THEN
    UPDATE lista_precio_items
       SET precio_efectivo = ROUND(NEW.precio_madre * (1 - COALESCE(descuento_pct, 0) / 100.0), 3),
           updated_at = NOW()
     WHERE articulo_id = NEW.id
       AND metodo = 'descuento_sobre_madre';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
