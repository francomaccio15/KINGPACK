-- KINGPACK — Migration 006: costo_flete como porcentaje del costo_base
-- Cambia la semántica de costo_flete: de importe en pesos a % sobre costo_base.
-- Fórmula anterior: precio_madre = (costo_base + costo_flete) × (1+margen%) × (1+IVA%)
-- Fórmula nueva:    precio_madre = costo_base × (1 + costo_flete/100) × (1+margen%) × (1+IVA%)

-- 1. Actualizar la función de cálculo
CREATE OR REPLACE FUNCTION fn_calcular_precio_madre(
  p_costo_base      NUMERIC,
  p_costo_flete     NUMERIC,   -- ahora es porcentaje (ej: 5.00 = 5%)
  p_porcentaje_iva  NUMERIC,
  p_margen          NUMERIC    -- porcentaje, ej: 30 = 30%
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
  RETURN ROUND(v_precio, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Recalcular precio_madre de todos los artículos existentes
--    (el trigger trg_articulo_precio_madre dispara automáticamente)
UPDATE articulos
   SET costo_flete = costo_flete
 WHERE deleted_at IS NULL;

-- 3. Actualizar la vista materializada vw_resultado_mensual
DROP MATERIALIZED VIEW IF EXISTS vw_resultado_mensual;

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
  g.total_gastos;

CREATE UNIQUE INDEX ON vw_resultado_mensual(mes, sucursal_id);
