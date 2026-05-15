-- KINGPACK — Seed: Clientes demo
-- Clientes representativos de una empresa de packaging en Salta.
-- Basado en la propuesta comercial King Pack (gastronomía, comercios, revendedores).
-- NOTA: saldo_inicial refleja deudas preexistentes al momento de carga del sistema.

INSERT INTO clientes (
  razon_social, cuit, cond_iva_id, telefono, direccion,
  sucursal_default_id, lista_precio_id,
  limite_credito, descuento_adicional, saldo_inicial, activo
)
SELECT
  v.razon_social, v.cuit,
  ci.id  AS cond_iva_id,
  v.telefono, v.direccion,
  s.id   AS sucursal_default_id,
  lp.id  AS lista_precio_id,
  v.limite_credito, v.descuento_adicional, v.saldo_inicial, TRUE
FROM (VALUES
  -- Gastronomía / restaurantes (Cuenta Corriente, Laprida)
  ('Restaurante El Sol',         '30-71234567-8', 'Responsable Inscripto',    '387 422-1100', 'Av. San Martín 450, Salta',      'Laprida', 'Cuenta Corriente', 50000.00, 5.0,  12500.00),
  ('Parrilla Don Ceferino',      NULL,            'Responsable Monotributo',  '387 490-3322', 'Calle Caseros 210, Salta',       'Laprida', 'Cuenta Corriente', 30000.00, 0.0,   8750.00),
  ('Heladería Bella Vista',      NULL,            'Responsable Monotributo',  '387 431-5500', 'Balcarce 318, Salta',            'Laprida', 'Precio Público',   15000.00, 0.0,      0.00),
  ('Pizzería El Hornito',        NULL,            'Consumidor Final',         '387 408-2244', 'Urquiza 87, Salta',              'Laprida', 'Precio Público',   10000.00, 0.0,   3200.00),
  -- Comercios / almacenes (Cuenta Corriente, Laprida)
  ('Almacén La Esquina SRL',     '30-68901234-5', 'Responsable Inscripto',    '387 455-6677', 'Yrigoyen 720, Salta',            'Laprida', 'Lista Reventa',    80000.00, 8.0,  25000.00),
  ('Supermercado Familiar Díaz', NULL,            'Responsable Monotributo',  '387 491-0088', 'España 1240, Salta',             'Laprida', 'Lista Reventa',    40000.00, 3.0,      0.00),
  -- Clientes Huaico
  ('Distribuidora Norte Pack',   '30-72345678-1', 'Responsable Inscripto',    '387 477-9900', 'Ruta 9 km 12, Salta',            'Huaico',  'Lista Reventa',   150000.00, 10.0, 47000.00),
  ('Cafetería Huaico',           NULL,            'Consumidor Final',         NULL,           NULL,                             'Huaico',  'Precio Público',   10000.00, 0.0,      0.00),
  -- Sin sucursal específica
  ('Emprendimientos Molina',     NULL,            'Responsable Monotributo',  '387 560-1234', 'Cerrillos, Salta',               NULL,      'Lista Reventa',    20000.00, 0.0,   5000.00),
  ('Catering Eventos Salta',     '27-35678901-4', 'Responsable Inscripto',    '387 443-8800', 'Av. Entre Ríos 550, Salta',      'Laprida', 'Cuenta Corriente', 60000.00, 5.0,      0.00)
) AS v(razon_social, cuit, cond_iva_nombre, telefono, direccion, sucursal_nombre, lista_nombre, limite_credito, descuento_adicional, saldo_inicial)
JOIN cond_iva   ci ON ci.nombre = v.cond_iva_nombre
LEFT JOIN sucursales  s  ON s.nombre  = v.sucursal_nombre
LEFT JOIN listas_precios lp ON lp.nombre = v.lista_nombre
WHERE NOT EXISTS (
  SELECT 1 FROM clientes c2
  WHERE c2.razon_social = v.razon_social
);
