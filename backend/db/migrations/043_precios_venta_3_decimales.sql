-- KINGPACK — Migración 043: precios de venta / costo / listas con 3 decimales
--
-- Extiende lo hecho en 042_precio_unitario_3_decimales.sql (que ya amplió el
-- precio unitario de COMPRAS: egreso_items.precio_unitario y
-- pedido_items.precio_compra) al resto de los PRECIOS UNITARIOS del sistema:
--   • articulos.costo_base
--   • lista_precio_items.precio_override / precio_efectivo
--   • venta_items.precio_lista / precio_unitario_final
--   • licitacion_items.precio_licitacion
--
-- Modelo "precio por litro de nafta": el precio unitario lleva 3 decimales, pero
-- los importes/totales cobrados siguen en 2 decimales (centavos) — como exige
-- AFIP. NO se toca precio_madre (sigue en pesos enteros) ni los totales.
--
-- Ensanchar la ESCALA de NUMERIC(14,2) a NUMERIC(14,3) es una conversión SIN
-- PÉRDIDA. costo_base y precio_unitario_final son usados por dos vistas
-- materializadas, así que se las elimina y se las recrea idénticas alrededor de
-- los ALTER (definiciones vigentes: vw_stock_consolidado = mig 002,
-- vw_resultado_mensual = mig 006).

-- ── 1. Eliminar vistas materializadas dependientes (se recrean al final) ──────
DROP MATERIALIZED VIEW IF EXISTS vw_resultado_mensual;
DROP MATERIALIZED VIEW IF EXISTS vw_stock_consolidado;

-- ── 2. Columnas de precio unitario → NUMERIC(14,3) ───────────────────────────
ALTER TABLE articulos          ALTER COLUMN costo_base            TYPE NUMERIC(14,3);
ALTER TABLE lista_precio_items ALTER COLUMN precio_override       TYPE NUMERIC(14,3);
ALTER TABLE lista_precio_items ALTER COLUMN precio_efectivo       TYPE NUMERIC(14,3);
ALTER TABLE venta_items        ALTER COLUMN precio_lista          TYPE NUMERIC(14,3);
ALTER TABLE venta_items        ALTER COLUMN precio_unitario_final TYPE NUMERIC(14,3);
ALTER TABLE licitacion_items   ALTER COLUMN precio_licitacion     TYPE NUMERIC(14,3);

-- ── 3. Triggers de precios de lista: redondeo a 3 decimales ──────────────────
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

-- ── 4. Recrear vistas materializadas (definiciones vigentes idénticas) ───────

-- vw_stock_consolidado (definición vigente: migración 002)
CREATE MATERIALIZED VIEW vw_stock_consolidado AS
SELECT
  a.id                            AS articulo_id,
  a.codigo,
  a.nombre                        AS articulo_nombre,
  cat.nombre                      AS categoria,
  suc.id                          AS sucursal_id,
  suc.nombre                      AS sucursal_nombre,
  COALESCE(st.cantidad, 0)        AS cantidad,
  COALESCE(st.stock_minimo, 0)    AS stock_minimo,
  COALESCE(st.cantidad, 0) <= COALESCE(st.stock_minimo, 0)  AS stock_bajo,
  a.costo_base,
  a.costo_flete,
  a.precio_madre,
  st.ultima_actualizacion
FROM articulos a
JOIN categorias cat ON cat.id = a.categoria_id
CROSS JOIN sucursales suc
LEFT JOIN stock st ON st.articulo_id = a.id AND st.sucursal_id = suc.id
WHERE a.deleted_at IS NULL AND suc.activo = TRUE
WITH DATA;

CREATE UNIQUE INDEX idx_vw_stock_art_suc ON vw_stock_consolidado(articulo_id, sucursal_id);
CREATE INDEX idx_vw_stock_bajo ON vw_stock_consolidado(sucursal_id) WHERE stock_bajo = TRUE;

-- vw_resultado_mensual (definición vigente: migración 006)
CREATE MATERIALIZED VIEW vw_resultado_mensual AS
SELECT
  DATE_TRUNC('month', v.fecha)::DATE    AS mes,
  suc.id                                AS sucursal_id,
  suc.nombre                            AS sucursal_nombre,
  COUNT(DISTINCT v.id)                  AS cantidad_ventas,
  SUM(v.total)                          AS ingresos_brutos,
  SUM(v.descuento_total)                AS total_descuentos,
  COALESCE(SUM(
    (vi.precio_unitario_final
      - (a.costo_base * (1 + a.costo_flete / 100.0))) * vi.cantidad
  ), 0)                                 AS margen_bruto,
  COALESCE(g.total_gastos, 0)           AS total_gastos,
  SUM(v.total)
    - COALESCE(SUM(
        (a.costo_base * (1 + a.costo_flete / 100.0)) * vi.cantidad
      ), 0)
    - COALESCE(g.total_gastos, 0)       AS utilidad_estimada
FROM ventas v
JOIN sucursales suc ON suc.id = v.sucursal_id
JOIN venta_items vi ON vi.venta_id = v.id
JOIN articulos a ON a.id = vi.articulo_id
LEFT JOIN (
  SELECT
    sucursal_id,
    DATE_TRUNC('month', fecha)::DATE  AS mes,
    SUM(monto)                         AS total_gastos
  FROM gastos
  GROUP BY sucursal_id, DATE_TRUNC('month', fecha)::DATE
) g ON g.sucursal_id = v.sucursal_id
    AND g.mes = DATE_TRUNC('month', v.fecha)::DATE
WHERE v.deleted_at IS NULL
  AND v.estado IN ('confirmada','facturada')
GROUP BY
  DATE_TRUNC('month', v.fecha)::DATE,
  suc.id,
  suc.nombre,
  g.total_gastos
WITH DATA;

CREATE UNIQUE INDEX ON vw_resultado_mensual(mes, sucursal_id);
