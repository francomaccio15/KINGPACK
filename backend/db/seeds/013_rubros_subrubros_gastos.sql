-- KINGPACK — Seed 013: Rubros y subrubros de gastos (datos reales del legacy)
-- Fuente: KingPack.xlsx > hoja "Subrubro gastos"
-- Idempotente vía ON CONFLICT DO NOTHING.

-- 1. Rubros (categorías padre del plan de cuentas de gastos)
INSERT INTO rubros_gastos (nombre, orden) VALUES
  ('Sueldos y jornales',        10),
  ('Alquileres',                20),
  ('Logística y distribución',  30),
  ('Transporte de carga',       40),
  ('Retiros mensuales',         50),
  ('Gastos de administración',  60),
  ('Gastos de comercialización',70),
  ('Honorarios profesionales',  80),
  ('Gastos generales',          90),
  ('Gastos bancarios',         100),
  ('Créditos pagados',         110),
  ('Impuestos pagados',        120)
ON CONFLICT (nombre) DO NOTHING;

-- 2. Subrubros: inserta el texto y vincula rubro_id en un solo paso
INSERT INTO subrubro_gastos (nombre, rubro, rubro_id)
SELECT v.nombre, v.rubro, r.id
FROM (VALUES
  -- Sueldos y jornales
  ('Comisiones',                                                      'Sueldos y jornales'),
  ('Sueldo Ezequiel',                                                 'Sueldos y jornales'),
  ('Sueldo Brisa',                                                    'Sueldos y jornales'),
  ('Sueldo Personal',                                                 'Sueldos y jornales'),
  ('Sueldo Gabriel',                                                  'Sueldos y jornales'),
  ('Sueldo Bruno',                                                    'Sueldos y jornales'),
  -- Alquileres
  ('Alquiler Laprida',                                                'Alquileres'),
  -- Logística y distribución
  ('Gastos de envíos y cadetería',                                    'Logística y distribución'),
  ('Combustible y lubricantes',                                       'Logística y distribución'),
  ('Gastos de estacionamiento, seguros y patentes',                   'Logística y distribución'),
  ('Gastos mantenimiento de vehículos',                               'Logística y distribución'),
  ('Alquileres Sampi de Descarga',                                    'Logística y distribución'),
  ('Combustible Ford',                                                'Logística y distribución'),
  -- Transporte de carga
  ('Transporte de carga',                                             'Transporte de carga'),
  -- Retiros mensuales
  ('Retiros Maxi',                                                    'Retiros mensuales'),
  ('Retiros France',                                                  'Retiros mensuales'),
  -- Gastos de administración
  ('Gastos varios de administración',                                 'Gastos de administración'),
  ('Gastos de limpieza',                                              'Gastos de administración'),
  ('Gastos de luz, agua y gas',                                       'Gastos de administración'),
  ('Gastos de librería, papelería e impresiones',                     'Gastos de administración'),
  ('Gastos de ferretería y mantenimiento',                            'Gastos de administración'),
  ('Uniformes y elementos de protección',                             'Gastos de administración'),
  ('Gastos de telefonía, internet y cable',                           'Gastos de administración'),
  -- Gastos de comercialización
  ('Publicidad, propaganda y sponsoreo',                              'Gastos de comercialización'),
  ('Gastos de packaging bolsas',                                      'Gastos de comercialización'),
  ('Gastos de packaging cajas',                                       'Gastos de comercialización'),
  -- Honorarios profesionales
  ('Honorarios Contador Público',                                     'Honorarios profesionales'),
  ('Honorarios Recursos Humanos',                                     'Honorarios profesionales'),
  ('Honorarios Sistemas',                                             'Honorarios profesionales'),
  -- Gastos generales
  ('Gastos Varios',                                                   'Gastos generales'),
  -- Gastos bancarios
  ('Gastos e impuestos bancarios',                                    'Gastos bancarios'),
  ('Comisiones e intereses bancarios',                                'Gastos bancarios'),
  ('Total retención impuesto ley 25413 s/créditos',                  'Gastos bancarios'),
  ('Total retención impuesto ley 25413 s/débitos',                   'Gastos bancarios'),
  ('Total retención impuesto régimen S.I.R.C.R.E.B',                 'Gastos bancarios'),
  ('Total impuesto IVA s/débitos',                                   'Gastos bancarios'),
  -- Créditos pagados
  ('Crédito bancario camioneta',                                      'Créditos pagados'),
  ('Crédito Huaico',                                                  'Créditos pagados'),
  -- Impuestos pagados
  ('Cargas sociales y laborales',                                     'Impuestos pagados'),
  ('Impuestos nacionales (IVA, Ganancias, Monotributo, Autónomos)',   'Impuestos pagados'),
  ('Impuestos provinciales (DGR Salta)',                              'Impuestos pagados'),
  ('Impuestos municipales (TISSH, publicidad y propaganda)',          'Impuestos pagados')
) AS v(nombre, rubro)
JOIN rubros_gastos r ON r.nombre = v.rubro
ON CONFLICT (nombre) DO NOTHING;
