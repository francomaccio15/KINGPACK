-- KINGPACK — Seed 019: Categorías del estado de resultados + mapeo de rubros
-- Estructura pedida por el contador. Idempotente.

-- 1. Categorías de resultado (orden = orden en el estado de resultados)
INSERT INTO categorias_resultado (nombre, orden, seccion) VALUES
  ('FINANCIEROS',                    1, 'gasto_operativo'),
  ('SUELDOS, JORNALES Y HONORARIOS', 2, 'gasto_operativo'),
  ('ALQUILERES',                     3, 'gasto_operativo'),
  ('SERVICIOS',                      4, 'gasto_operativo'),
  ('IMPUESTOS',                      5, 'gasto_operativo'),
  ('OTROS GASTOS OPERATIVOS',        6, 'gasto_operativo'),
  ('RETIROS DEL PERÍODO',            7, 'retiro'),
  ('COMPRAS',                        99, 'excluido')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Mapeo rubro → categoría (por nombre de rubro)
UPDATE rubros_gastos r
   SET categoria_resultado_id = c.id
  FROM categorias_resultado c
 WHERE (
   (c.nombre = 'FINANCIEROS'                    AND r.nombre IN ('Gastos bancarios', 'Créditos pagados'))
   OR (c.nombre = 'SUELDOS, JORNALES Y HONORARIOS' AND r.nombre IN ('Sueldos y jornales', 'Honorarios profesionales'))
   OR (c.nombre = 'ALQUILERES'                  AND r.nombre = 'Alquileres')
   OR (c.nombre = 'SERVICIOS'                   AND r.nombre = 'Gastos de administración')
   OR (c.nombre = 'IMPUESTOS'                   AND r.nombre = 'Impuestos pagados')
   OR (c.nombre = 'OTROS GASTOS OPERATIVOS'     AND r.nombre IN ('Logística y distribución', 'Transporte de carga', 'Gastos de comercialización', 'Gastos generales'))
   OR (c.nombre = 'RETIROS DEL PERÍODO'         AND r.nombre = 'Retiros mensuales')
   OR (c.nombre = 'COMPRAS'                     AND r.nombre = 'Compras')
 );
