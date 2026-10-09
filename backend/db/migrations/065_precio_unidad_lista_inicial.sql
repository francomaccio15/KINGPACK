-- KINGPACK — Migración 065: precio por unidad de la «Lista inicial» con 100% de margen
--
-- Pedido del negocio (09/10/2026): a los artículos de la «Lista inicial» de
-- Venta por unidad, el precio suelto es el del bulto prorrateado por unidad
-- con 100% de margen, redondeado SIEMPRE para arriba a pesos enteros:
--   precio_unidad = CEIL(precio_madre / unidades_por_bulto × 2)
-- Solo toca el precio por unidad (el del bulto queda igual) y solo los que ya
-- tienen bulto definido (unidades_por_bulto > 1). Los que se conviertan después
-- reciben el mismo precio sugerido en la pantalla (VentaPorUnidad.tsx).
-- La lista de códigos es la misma que LISTA_INICIAL del frontend.

UPDATE articulos
   SET precio_unidad = CEIL(precio_madre * 2 / unidades_por_bulto)
 WHERE deleted_at IS NULL
   AND unidades_por_bulto > 1
   AND precio_madre > 0
   AND codigo = ANY(ARRAY[
     'KP00042','KP00043','KP00020','KP00021','KP00022','KP00044','KP00045','KP00046','KP00023','KP00024',
     'KP00144','KP00038','KP00037','KP00039',
     'KP00047','KP00048','KP00049','KP00025','KP00030',
     'KP00148','KP00149','KP00150','KP00184','KP00185','KP00186','KP00194',
     'KP00175','KP00176','KP00177','KP00192','KP00193',
     'KP00011','KP00012','KP00013','KP00014','KP00015',
     'KP00356','KP00357','KP00358','KP00359','KP00360','KP00361','KP00362','KP00363','KP00365','KP00364',
     'KP00207','KP00295','KP00296','KP00297','KP00298','KP00299','KP00300','KP00301',
     'KP00302','KP00303','KP00304','KP00305','KP00306','KP00307','KP00308','KP00309',
     '389','390','391','392',
     '377','378','393'
   ]);
