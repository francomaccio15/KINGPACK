-- KINGPACK — Seed: Clientes demo (datos reales del sistema legacy)
-- Extraídos de KingPack.xlsx > hoja "Clientes", registros con nombre + datos suficientes.
-- Los legacy_id preservan la referencia al sistema anterior para trazabilidad.
-- Idempotente: no inserta si el legacy_id ya existe.

DO $$
DECLARE
  iva_ri  UUID;  -- Responsable Inscripto  (codigo_afip = 1)
  iva_cf  UUID;  -- Consumidor Final        (codigo_afip = 5)
  iva_ex  UUID;  -- Exento                  (codigo_afip = 4)
  suc_lap UUID;  -- Sucursal Laprida
  suc_hua UUID;  -- Sucursal Huaico
  lst_pub UUID;  -- Lista Precio Público
  lst_cc  UUID;  -- Lista Cuenta Corriente
BEGIN
  SELECT id INTO iva_ri  FROM cond_iva      WHERE codigo_afip = 1;
  SELECT id INTO iva_cf  FROM cond_iva      WHERE codigo_afip = 5;
  SELECT id INTO iva_ex  FROM cond_iva      WHERE codigo_afip = 4;
  SELECT id INTO suc_lap FROM sucursales    WHERE nombre = 'Laprida';
  SELECT id INTO suc_hua FROM sucursales    WHERE nombre = 'Huaico';
  SELECT id INTO lst_pub FROM listas_precios WHERE tipo = 'publica';
  SELECT id INTO lst_cc  FROM listas_precios WHERE tipo = 'cuenta_corriente';

  INSERT INTO clientes
    (razon_social, cuit, cond_iva_id, direccion,
     sucursal_default_id, lista_precio_id,
     descuento_adicional, activo, legacy_id)
  SELECT
    v.razon_social,
    v.cuit,
    CASE v.iva WHEN 'ri' THEN iva_ri WHEN 'ex' THEN iva_ex ELSE iva_cf END,
    v.direccion,
    CASE v.suc WHEN 'hua' THEN suc_hua ELSE suc_lap END,
    CASE v.lista WHEN 'cc' THEN lst_cc ELSE lst_pub END,
    v.descuento,
    TRUE,
    v.legacy_id
  FROM (VALUES
    -- Consumidores finales (clientes genéricos por sucursal)
    ('Consumidor Final',                              NULL,           'cf', NULL,                              'lap', 'pub',  0.00, 'cliente0001'),
    ('Consumidor Final',                              NULL,           'cf', NULL,                              'hua', 'pub',  0.00, 'cliente0002'),
    -- Clientes reales de Laprida
    ('Jaque Mate',                                    NULL,           'cf', 'Mitre 331',                       'lap', 'pub', 10.00, 'cliente0003'),
    ('Global 360',                                    NULL,           'cf', 'Dean Funes 1056',                 'lap', 'pub', 10.00, 'cliente0004'),
    ('La Ciabatteria',                                NULL,           'cf', 'Juramento 310',                   'lap', 'pub', 10.00, 'cliente0005'),
    ('Amaretto',                                      '27436861466',  'ri', 'Av. Sarmiento 301',               'lap', 'cc',  10.00, 'cliente0006'),
    ('Babylon',                                       NULL,           'cf', 'Necochea 719',                    'lap', 'pub', 10.00, 'cliente0008'),
    ('Mitdown',                                       NULL,           'cf', 'Necochea 714',                    'lap', 'pub', 10.00, 'cliente0009'),
    ('PRETO SAS',                                     '30718975227',  'ri', 'Alverdi 177',                     'lap', 'cc',  10.00, 'cliente0010'),
    ('LIEN''S',                                       NULL,           'cf', 'Santiago del Estero 612',         'lap', 'pub', 10.00, 'cliente0011'),
    ('Ramiro Carlino',                                NULL,           'cf', 'Ibazeta 505',                     'lap', 'pub', 10.00, 'cliente0012'),
    ('Mola La Hamburgueza',                           NULL,           'cf', 'Luis Burela 366',                 'lap', 'pub', 20.00, 'cliente0013'),
    ('VOVE',                                          '33718391429',  'ri', 'Vicente López 498',               'lap', 'cc',  10.00, 'cliente0014'),
    ('JJPLAST - Jorge Morcos',                        '20118348215',  'ri', 'Dean Funes 210',                  'lap', 'cc',  30.00, 'cliente0015'),
    ('Club de la Milanesa - Bon Apetit',              '33716215909',  'ri', NULL,                              'lap', 'cc',  10.00, 'cliente0016'),
    ('Carnicería La Argentina',                       NULL,           'cf', 'Zuviria 903',                     'lap', 'pub', 20.00, 'cliente0017'),
    ('MARDAN S.A.S.',                                 '30716787822',  'ri', 'Laprida 246',                     'lap', 'cc',   0.00, 'cliente0023'),
    ('La Metro Disco',                                '30717469956',  'ri', 'Marcelino Freyde 1438',           'lap', 'cc',  20.00, 'cliente0025'),
    ('Nova Vila',                                     NULL,           'cf', 'Av. Excombatientes de Malvinas',  'lap', 'pub', 10.00, 'cliente0026'),
    ('Festival Bebidas',                              NULL,           'cf', 'Av. Juan B. Justo 496',           'lap', 'pub', 10.00, 'cliente0027'),
    -- Cliente sucursal Huaico
    ('Tribunal Electoral de la Provincia de Salta',  '30714425613',  'ex', 'Av. Bolivia 4671',                'hua', 'cc',   0.00, 'cliente0018')
  ) AS v(razon_social, cuit, iva, direccion, suc, lista, descuento, legacy_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM clientes c WHERE c.legacy_id = v.legacy_id
  );

END;
$$;
