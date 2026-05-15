-- =============================================================================
-- KINGPACK — Vistas materializadas
-- Migración: 002_views_materialized.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- vw_saldos_clientes
-- Saldo actual por cliente = suma facturado - suma pagado ± correcciones
-- Refresco: cada 5 minutos (ver pg_cron o tarea programada en app)
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW vw_saldos_clientes AS
SELECT
  c.id                                                    AS cliente_id,
  c.razon_social,
  c.cuit,
  c.saldo_inicial,
  COALESCE(SUM(f.total) FILTER (WHERE f.ok = TRUE AND f.deleted_at IS NULL), 0)   AS total_facturado,
  COALESCE(SUM(cc.haber), 0)                                                        AS total_pagado,
  COALESCE(SUM(cs.monto), 0)                                                        AS correcciones,
  c.saldo_inicial
    + COALESCE(SUM(f.total) FILTER (WHERE f.ok = TRUE AND f.deleted_at IS NULL), 0)
    - COALESCE(SUM(cc.haber), 0)
    + COALESCE(SUM(cs.monto), 0)                                                    AS saldo_actual
FROM clientes c
LEFT JOIN ventas v ON v.cliente_id = c.id AND v.deleted_at IS NULL
LEFT JOIN facturaciones f ON f.venta_id = v.id
LEFT JOIN cuentas_corrientes_cliente cc ON cc.cliente_id = c.id
LEFT JOIN correcciones_saldo_cliente cs ON cs.cliente_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.razon_social, c.cuit, c.saldo_inicial
WITH DATA;

CREATE UNIQUE INDEX idx_vw_saldos_clientes ON vw_saldos_clientes(cliente_id);

-- -----------------------------------------------------------------------------
-- vw_stock_consolidado
-- Stock total por artículo y por sucursal con costos y precio_madre
-- Refresco: cada 10 minutos
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW vw_stock_consolidado AS
SELECT
  a.id              AS articulo_id,
  a.codigo,
  a.nombre          AS articulo_nombre,
  cat.nombre        AS categoria,
  s.id              AS sucursal_id,
  suc.nombre        AS sucursal_nombre,
  COALESCE(st.cantidad, 0)      AS cantidad,
  COALESCE(st.stock_minimo, 0)  AS stock_minimo,
  CASE WHEN COALESCE(st.cantidad, 0) <= COALESCE(st.stock_minimo, 0)
       THEN TRUE ELSE FALSE END AS stock_bajo,
  a.costo_base,
  a.costo_flete,
  a.precio_madre,
  st.ultima_actualizacion
FROM articulos a
CROSS JOIN sucursales suc
CROSS JOIN (SELECT id FROM sucursales) s
JOIN sucursales ON sucursales.id = s.id AND sucursales.id = suc.id
JOIN categorias cat ON cat.id = a.categoria_id
LEFT JOIN stock st ON st.articulo_id = a.id AND st.sucursal_id = suc.id
WHERE a.deleted_at IS NULL AND suc.activo = TRUE
WITH DATA;

CREATE UNIQUE INDEX idx_vw_stock_art_suc ON vw_stock_consolidado(articulo_id, sucursal_id);
CREATE INDEX idx_vw_stock_bajo ON vw_stock_consolidado(sucursal_id) WHERE stock_bajo = TRUE;

-- Reemplazar la vista con una más limpia (la anterior tiene un bug de cross join)
DROP MATERIALIZED VIEW vw_stock_consolidado;

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

-- -----------------------------------------------------------------------------
-- vw_resultado_mensual
-- Ventas, costos, gastos, utilidad por mes y sucursal
-- Refresco: diario a las 02:00 (cron del backend)
-- -----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW vw_resultado_mensual AS
SELECT
  DATE_TRUNC('month', v.fecha)::DATE    AS mes,
  suc.id                                AS sucursal_id,
  suc.nombre                            AS sucursal_nombre,
  COUNT(DISTINCT v.id)                  AS cantidad_ventas,
  SUM(v.total)                          AS ingresos_brutos,
  SUM(v.descuento_total)                AS total_descuentos,
  COALESCE(SUM(
    (vi.precio_unitario_final - (a.costo_base + a.costo_flete)) * vi.cantidad
  ), 0)                                 AS margen_bruto,
  COALESCE(g.total_gastos, 0)           AS total_gastos,
  SUM(v.total)
    - COALESCE(SUM(
        (a.costo_base + a.costo_flete) * vi.cantidad
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
  suc.id, suc.nombre,
  g.total_gastos
WITH DATA;

CREATE UNIQUE INDEX idx_vw_resultado_mes_suc ON vw_resultado_mensual(mes, sucursal_id);
CREATE INDEX idx_vw_resultado_mes ON vw_resultado_mensual(mes DESC);

-- -----------------------------------------------------------------------------
-- Función helper para refrescar las 3 vistas (llamada desde el backend)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_refresh_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vw_saldos_clientes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY vw_stock_consolidado;
  REFRESH MATERIALIZED VIEW CONCURRENTLY vw_resultado_mensual;
END;
$$ LANGUAGE plpgsql;
