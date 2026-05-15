-- KINGPACK — Seed: Matriz de permisos por rol
-- Revisada con el cliente 13/05/2026 (parcial — completar antes de producción)

-- Función helper para insertar sin duplicar
DO $$
DECLARE
  permisos TEXT[][] := ARRAY[
    -- formato: rol, modulo, accion, permitido
    -- VENTAS
    ARRAY['administrador', 'ventas', 'crear',              'true'],
    ARRAY['supervisor',    'ventas', 'crear',              'true'],
    ARRAY['cajero',        'ventas', 'crear',              'true'],
    ARRAY['vendedor',      'ventas', 'crear',              'true'],

    ARRAY['administrador', 'ventas', 'anular',             'true'],
    ARRAY['supervisor',    'ventas', 'anular',             'true'],
    ARRAY['cajero',        'ventas', 'anular',             'false'],
    ARRAY['vendedor',      'ventas', 'anular',             'false'],

    ARRAY['administrador', 'ventas', 'aplicar_descuento',  'true'],
    ARRAY['supervisor',    'ventas', 'aplicar_descuento',  'true'],
    ARRAY['cajero',        'ventas', 'aplicar_descuento',  'false'],
    ARRAY['vendedor',      'ventas', 'aplicar_descuento',  'false'],

    ARRAY['administrador', 'ventas', 'ver_historial',      'true'],
    ARRAY['supervisor',    'ventas', 'ver_historial',      'true'],
    ARRAY['cajero',        'ventas', 'ver_historial',      'true'],
    ARRAY['vendedor',      'ventas', 'ver_historial',      'false'],

    -- ARTÍCULOS
    ARRAY['administrador', 'articulos', 'ver_precio_madre',   'true'],
    ARRAY['supervisor',    'articulos', 'ver_precio_madre',   'true'],
    ARRAY['cajero',        'articulos', 'ver_precio_madre',   'false'],
    ARRAY['vendedor',      'articulos', 'ver_precio_madre',   'false'],

    ARRAY['administrador', 'articulos', 'editar_precio_madre','true'],
    ARRAY['supervisor',    'articulos', 'editar_precio_madre','false'],
    ARRAY['cajero',        'articulos', 'editar_precio_madre','false'],
    ARRAY['vendedor',      'articulos', 'editar_precio_madre','false'],

    ARRAY['administrador', 'articulos', 'crear',             'true'],
    ARRAY['supervisor',    'articulos', 'crear',             'true'],
    ARRAY['cajero',        'articulos', 'crear',             'false'],
    ARRAY['vendedor',      'articulos', 'crear',             'false'],

    ARRAY['administrador', 'articulos', 'eliminar',          'true'],
    ARRAY['supervisor',    'articulos', 'eliminar',          'false'],
    ARRAY['cajero',        'articulos', 'eliminar',          'false'],
    ARRAY['vendedor',      'articulos', 'eliminar',          'false'],

    -- LISTAS DE PRECIOS
    ARRAY['administrador', 'listas_precios', 'editar',       'true'],
    ARRAY['supervisor',    'listas_precios', 'editar',       'false'],
    ARRAY['cajero',        'listas_precios', 'editar',       'false'],
    ARRAY['vendedor',      'listas_precios', 'editar',       'false'],

    ARRAY['administrador', 'listas_precios', 'ver',          'true'],
    ARRAY['supervisor',    'listas_precios', 'ver',          'true'],
    ARRAY['cajero',        'listas_precios', 'ver',          'false'],
    ARRAY['vendedor',      'listas_precios', 'ver',          'false'],

    -- CLIENTES
    ARRAY['administrador', 'clientes', 'crear',              'true'],
    ARRAY['supervisor',    'clientes', 'crear',              'true'],
    ARRAY['cajero',        'clientes', 'crear',              'true'],
    ARRAY['vendedor',      'clientes', 'crear',              'false'],

    ARRAY['administrador', 'clientes', 'asignar_lista',      'true'],
    ARRAY['supervisor',    'clientes', 'asignar_lista',      'true'],
    ARRAY['cajero',        'clientes', 'asignar_lista',      'false'],
    ARRAY['vendedor',      'clientes', 'asignar_lista',      'false'],

    ARRAY['administrador', 'clientes', 'editar_limite_credito','true'],
    ARRAY['supervisor',    'clientes', 'editar_limite_credito','false'],
    ARRAY['cajero',        'clientes', 'editar_limite_credito','false'],
    ARRAY['vendedor',      'clientes', 'editar_limite_credito','false'],

    -- CAJA
    ARRAY['administrador', 'caja', 'apertura_cierre',        'true'],
    ARRAY['supervisor',    'caja', 'apertura_cierre',        'true'],
    ARRAY['cajero',        'caja', 'apertura_cierre',        'true'],
    ARRAY['vendedor',      'caja', 'apertura_cierre',        'false'],

    ARRAY['administrador', 'caja', 'ver_movimientos',        'true'],
    ARRAY['supervisor',    'caja', 'ver_movimientos',        'true'],
    ARRAY['cajero',        'caja', 'ver_movimientos',        'true'],
    ARRAY['vendedor',      'caja', 'ver_movimientos',        'false'],

    ARRAY['administrador', 'caja', 'retiro',                 'true'],
    ARRAY['supervisor',    'caja', 'retiro',                 'true'],
    ARRAY['cajero',        'caja', 'retiro',                 'false'],
    ARRAY['vendedor',      'caja', 'retiro',                 'false'],

    -- FACTURACIÓN
    ARRAY['administrador', 'facturacion', 'emitir_cae',      'true'],
    ARRAY['supervisor',    'facturacion', 'emitir_cae',      'true'],
    ARRAY['cajero',        'facturacion', 'emitir_cae',      'true'],
    ARRAY['vendedor',      'facturacion', 'emitir_cae',      'false'],

    ARRAY['administrador', 'facturacion', 'anular',          'true'],
    ARRAY['supervisor',    'facturacion', 'anular',          'true'],
    ARRAY['cajero',        'facturacion', 'anular',          'false'],
    ARRAY['vendedor',      'facturacion', 'anular',          'false'],

    -- USUARIOS
    ARRAY['administrador', 'usuarios', 'crear',              'true'],
    ARRAY['supervisor',    'usuarios', 'crear',              'false'],
    ARRAY['cajero',        'usuarios', 'crear',              'false'],
    ARRAY['vendedor',      'usuarios', 'crear',              'false'],

    ARRAY['administrador', 'usuarios', 'editar_rol',         'true'],
    ARRAY['supervisor',    'usuarios', 'editar_rol',         'false'],
    ARRAY['cajero',        'usuarios', 'editar_rol',         'false'],
    ARRAY['vendedor',      'usuarios', 'editar_rol',         'false'],

    -- REPORTES
    ARRAY['administrador', 'reportes', 'resultado_mensual',  'true'],
    ARRAY['supervisor',    'reportes', 'resultado_mensual',  'true'],
    ARRAY['cajero',        'reportes', 'resultado_mensual',  'false'],
    ARRAY['vendedor',      'reportes', 'resultado_mensual',  'false'],

    ARRAY['administrador', 'reportes', 'ventas_por_vendedor','true'],
    ARRAY['supervisor',    'reportes', 'ventas_por_vendedor','true'],
    ARRAY['cajero',        'reportes', 'ventas_por_vendedor','false'],
    ARRAY['vendedor',      'reportes', 'ventas_por_vendedor','true'],  -- solo sus propias

    -- STOCK
    ARRAY['administrador', 'stock', 'ajuste_manual',         'true'],
    ARRAY['supervisor',    'stock', 'ajuste_manual',         'true'],
    ARRAY['cajero',        'stock', 'ajuste_manual',         'false'],
    ARRAY['vendedor',      'stock', 'ajuste_manual',         'false'],

    ARRAY['administrador', 'stock', 'ver',                   'true'],
    ARRAY['supervisor',    'stock', 'ver',                   'true'],
    ARRAY['cajero',        'stock', 'ver',                   'true'],
    ARRAY['vendedor',      'stock', 'ver',                   'true'],

    -- TRASPASOS
    ARRAY['administrador', 'traspasos', 'crear',             'true'],
    ARRAY['supervisor',    'traspasos', 'crear',             'true'],
    ARRAY['cajero',        'traspasos', 'crear',             'false'],
    ARRAY['vendedor',      'traspasos', 'crear',             'false'],

    ARRAY['administrador', 'traspasos', 'aprobar',           'true'],
    ARRAY['supervisor',    'traspasos', 'aprobar',           'true'],
    ARRAY['cajero',        'traspasos', 'aprobar',           'false'],
    ARRAY['vendedor',      'traspasos', 'aprobar',           'false'],

    -- GASTOS
    ARRAY['administrador', 'gastos', 'crear',                'true'],
    ARRAY['supervisor',    'gastos', 'crear',                'true'],
    ARRAY['cajero',        'gastos', 'crear',                'false'],
    ARRAY['vendedor',      'gastos', 'crear',                'false'],

    -- PROVEEDORES
    ARRAY['administrador', 'proveedores', 'crear',           'true'],
    ARRAY['supervisor',    'proveedores', 'crear',           'true'],
    ARRAY['cajero',        'proveedores', 'crear',           'false'],
    ARRAY['vendedor',      'proveedores', 'crear',           'false'],

    -- EMPLEADOS
    ARRAY['administrador', 'empleados', 'ver',               'true'],
    ARRAY['supervisor',    'empleados', 'ver',               'true'],
    ARRAY['cajero',        'empleados', 'ver',               'false'],
    ARRAY['vendedor',      'empleados', 'ver',               'false'],

    ARRAY['administrador', 'empleados', 'editar',            'true'],
    ARRAY['supervisor',    'empleados', 'editar',            'false'],
    ARRAY['cajero',        'empleados', 'editar',            'false'],
    ARRAY['vendedor',      'empleados', 'editar',            'false']
  ];
  p TEXT[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY permisos LOOP
    INSERT INTO rol_permisos (rol, modulo, accion, permitido)
    VALUES (p[1], p[2], p[3], p[4]::BOOLEAN)
    ON CONFLICT (rol, modulo, accion) DO UPDATE SET permitido = EXCLUDED.permitido;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
