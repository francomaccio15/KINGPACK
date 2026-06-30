-- 020_actualizar_precios.sql
-- Generado por scripts/migracion/generar-seed-precios.js
-- NO editar a mano: regenerar desde el Excel corregido.
--
-- Actualiza costo_base (neto = costo/1.21), costo_flete y margen_aplicado de 361 artículos.
-- El trigger recalcula precio_madre (= precio del Excel) y las listas de precios.
-- Desactiva los artículos activos que el cliente sacó del Excel.
-- NO actualizados (margen > 999.99, quedan como están para revisión del cliente):
--   ESTUCHE P/ FRITAS CHICO CARTULINA BCA X 100  (costo 572 / precio 10400 -> margen 1523.37%)
--   TOALLA BOBINAS X 200 X 4 UNID. MTS BCA.  (costo 975 / precio 18800 -> margen 1621.6%)

-- 1. Actualización de precios (por nombre)
UPDATE articulos SET costo_base = 413.22, costo_flete = 0, margen_aplicado = 100 WHERE upper(trim(nombre)) = 'AGITADORES CAFE TRAS.X 100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5107.44, costo_flete = 0, margen_aplicado = 69.9 WHERE upper(trim(nombre)) = 'AGITADORES CAFE TRAS.X 1000 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2355.37, costo_flete = 0, margen_aplicado = 75.44 WHERE upper(trim(nombre)) = 'AGITADORES TRAGO LARGO COLOR X100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 542.98, costo_flete = 10, margen_aplicado = 107.55 WHERE upper(trim(nombre)) = 'PAPEL ALUMINIO FAMILIAR X 5 MTS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4502.48, costo_flete = 10, margen_aplicado = 83.55 WHERE upper(trim(nombre)) = 'PAPEL ALUMINIO X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 342.15, costo_flete = 12, margen_aplicado = 72.53 WHERE upper(trim(nombre)) = 'BANDEJA ORO LAMINA X 28 CM' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 376.86, costo_flete = 12, margen_aplicado = 76.22 WHERE upper(trim(nombre)) = 'BANDEJA ORO LAMINADA 30 CM' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 421.49, costo_flete = 12, margen_aplicado = 75.07 WHERE upper(trim(nombre)) = 'BANDEJA ORO LAMINADA 33 CM' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 335.54, costo_flete = 12, margen_aplicado = 36.35 WHERE upper(trim(nombre)) = 'BANDEJA ORO LAMINADA X 25 CM' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 384.3, costo_flete = 12, margen_aplicado = 92.01 WHERE upper(trim(nombre)) = 'BANDEJA REC. LAMIMINA P/3 KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1983.47, costo_flete = 12, margen_aplicado = 84.15 WHERE upper(trim(nombre)) = 'BANDEJA TERGOPOR 615X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1439.67, costo_flete = 12, margen_aplicado = 84.52 WHERE upper(trim(nombre)) = 'BANDEJA TERGOPOR 618X50NUD.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3391.74, costo_flete = 12, margen_aplicado = 95.8 WHERE upper(trim(nombre)) = 'BANDEJA TERGOPOR 619X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3071.9, costo_flete = 12, margen_aplicado = 84.96 WHERE upper(trim(nombre)) = 'BANDEJA TERGOPOR 625X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4735.54, costo_flete = 12, margen_aplicado = 94.78 WHERE upper(trim(nombre)) = 'BANDEJA TERGOPOR 628X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 814.88, costo_flete = 7, margen_aplicado = 51.66 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS N1 X 100UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1016.53, costo_flete = 7, margen_aplicado = 51.96 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS N2 X 100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1241.32, costo_flete = 7, margen_aplicado = 55.56 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS N3 X 100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1542.98, costo_flete = 7, margen_aplicado = 50.17 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS N4 X 100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6319.83, costo_flete = 12, margen_aplicado = 75.14 WHERE upper(trim(nombre)) = 'BANDEJA REC. ALUMINIO F100 X 50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5290.08, costo_flete = 12, margen_aplicado = 53.44 WHERE upper(trim(nombre)) = 'BANDEJA REC.ALUMINIO F75 X 5OUNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6369.42, costo_flete = 12, margen_aplicado = 54.66 WHERE upper(trim(nombre)) = 'BANDEJA REC.ALUMINIO P21 X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 11547.11, costo_flete = 12, margen_aplicado = 34.2 WHERE upper(trim(nombre)) = 'BANDEJA RED.ALUMINIO P30 X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 14642.15, costo_flete = 12, margen_aplicado = 44.13 WHERE upper(trim(nombre)) = 'BANDEJA RED.ALUMINIO P33 X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1958.68, costo_flete = 12, margen_aplicado = 43.16 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS RED. N12 X1OO UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10909.09, costo_flete = 12, margen_aplicado = 65.72 WHERE upper(trim(nombre)) = 'BANDEJA ESTUCHE 103 PP X 50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 18581.82, costo_flete = 12, margen_aplicado = 64.8 WHERE upper(trim(nombre)) = 'BANDEJA ESTUCHE 105 PP OVAL X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 204.96, costo_flete = 12, margen_aplicado = 51.21 WHERE upper(trim(nombre)) = 'BANDEJA LAMINA P/1 KG 23X28' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 271.9, costo_flete = 12, margen_aplicado = 51.98 WHERE upper(trim(nombre)) = 'BANDEJA LAMINADA P/ 2 KG 28X30' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2551.24, costo_flete = 12, margen_aplicado = 59.08 WHERE upper(trim(nombre)) = 'BANDEJAS CARTON GRIS RED N 13X1OOU.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4153.72, costo_flete = 12, margen_aplicado = 34.2 WHERE upper(trim(nombre)) = 'BANDEJA PLAST. 101 PP COTNYL X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6923.14, costo_flete = 12, margen_aplicado = 33.23 WHERE upper(trim(nombre)) = 'BANDEJA PLAST.102 COTNYL X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3911.57, costo_flete = 12, margen_aplicado = 62.23 WHERE upper(trim(nombre)) = 'BANDEJA PLAST. 102 PP X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2606.61, costo_flete = 12, margen_aplicado = 52.87 WHERE upper(trim(nombre)) = 'BANDEJA PLAST.102 PP NEGRAS X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5147.11, costo_flete = 12, margen_aplicado = 60.57 WHERE upper(trim(nombre)) = 'BANDEJA PLAST.103 PP X1OOU.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7982.64, costo_flete = 12, margen_aplicado = 34.22 WHERE upper(trim(nombre)) = 'BANDEJA PLAST. 103 PP COTNYL X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7024.79, costo_flete = 12, margen_aplicado = 57.56 WHERE upper(trim(nombre)) = 'BANDEJA PLAST. 105 PP X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 8308.26, costo_flete = 12, margen_aplicado = 45.66 WHERE upper(trim(nombre)) = 'BANDEJA PLAST. 105 PP WORK X1OOU.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 12706.61, costo_flete = 12, margen_aplicado = 48.08 WHERE upper(trim(nombre)) = 'BANDEJA PLAST. 105 REC. PP COTNYL X1OOU.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10704.96, costo_flete = 12, margen_aplicado = 65.43 WHERE upper(trim(nombre)) = 'BANDEJA PLAST. 107 PP X1OOU.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 15883.47, costo_flete = 12, margen_aplicado = 48.66 WHERE upper(trim(nombre)) = 'BANDEJAS PLAST.107 PP COTNYL X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 11527.27, costo_flete = 12, margen_aplicado = 104.84 WHERE upper(trim(nombre)) = 'BANDEJA REC ALUMINIO F200 X50U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4710.74, costo_flete = 12, margen_aplicado = 16.7 WHERE upper(trim(nombre)) = 'BANDEJA REC ALUMINIO F50 X50U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4970.25, costo_flete = 12, margen_aplicado = 63.31 WHERE upper(trim(nombre)) = 'BANDEJA RED ALUMINIO P12 X50U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4566.94, costo_flete = 12, margen_aplicado = 63.19 WHERE upper(trim(nombre)) = 'BANDEJA RED ALUMINIO P15 X50U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 8072.73, costo_flete = 12, margen_aplicado = 62.7 WHERE upper(trim(nombre)) = 'BANDEJA RED ALUMINIO P26 X50U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3872.73, costo_flete = 12, margen_aplicado = 62.34 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS RED. N 14 X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4229.75, costo_flete = 12, margen_aplicado = 62.24 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS RED. N 15 X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7536.36, costo_flete = 12, margen_aplicado = 61.55 WHERE upper(trim(nombre)) = 'BANDEJA CARTON GRIS RED. N 16 X100U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1057.85, costo_flete = 0, margen_aplicado = 103.13 WHERE upper(trim(nombre)) = 'BENGALAS X 4 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5177.69, costo_flete = 0, margen_aplicado = 59.62 WHERE upper(trim(nombre)) = 'BOB. ARRANQ 40X60X1,2 KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5177.69, costo_flete = 0, margen_aplicado = 59.62 WHERE upper(trim(nombre)) = 'BOB. ARRANQ. 20X30X1,2KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5177.69, costo_flete = 0, margen_aplicado = 59.62 WHERE upper(trim(nombre)) = 'BOB. ARRANQ. 25X35 1,2KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5177.69, costo_flete = 0, margen_aplicado = 59.62 WHERE upper(trim(nombre)) = 'BOB. ARRANQ. 30X40X1,2KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5177.69, costo_flete = 0, margen_aplicado = 59.62 WHERE upper(trim(nombre)) = 'BOB. ARRANQ. 35X45X1,2KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5177.69, costo_flete = 0, margen_aplicado = 59.62 WHERE upper(trim(nombre)) = 'BOB. ARRANQ. 50X701,2KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7249.59, costo_flete = 0, margen_aplicado = 69.86 WHERE upper(trim(nombre)) = 'BOB. ARRANQUE 60X90X1,5KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 14079.34, costo_flete = 12, margen_aplicado = 62.47 WHERE upper(trim(nombre)) = 'BOB. IND"KING PACK" X 25CMX400MTS X 2 UNID. BCA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 14079.34, costo_flete = 12, margen_aplicado = 62.47 WHERE upper(trim(nombre)) = 'BOB. IND "REVENTA" X 25CM X 400MTS X 2 UNID. BCA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 13115.7, costo_flete = 0, margen_aplicado = 60.68 WHERE upper(trim(nombre)) = 'BOB. PAPEL GRIS X 60CM (11.500KG)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1851.24, costo_flete = 0, margen_aplicado = 56.25 WHERE upper(trim(nombre)) = 'BOB. ARRANQ. 15X20X400GR' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1851.24, costo_flete = 0, margen_aplicado = 56.25 WHERE upper(trim(nombre)) = 'BOB. ARRANQ. 15X25X400GR' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 9123.97, costo_flete = 0, margen_aplicado = 63.04 WHERE upper(trim(nombre)) = 'BOB. PAPEL GRIS X 40 CM (8 KG)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3991.74, costo_flete = 0, margen_aplicado = 69.77 WHERE upper(trim(nombre)) = 'BOB. PAPEL GRIS X 20 CM X 3.500KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5323.14, costo_flete = 12, margen_aplicado = 52.48 WHERE upper(trim(nombre)) = 'BOB. PAPEL PANADERIA "FANTASIA" X40CM (2.500)KG.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 17559.5, costo_flete = 12, margen_aplicado = 51.28 WHERE upper(trim(nombre)) = 'BOB. PAPEL PANADERIA "FANTASIA"X60CM (6.500) KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1239.67, costo_flete = 12, margen_aplicado = 19.05 WHERE upper(trim(nombre)) = 'BOLSA DE HORNO X 10 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 639.67, costo_flete = 0, margen_aplicado = 93.8 WHERE upper(trim(nombre)) = 'BOLSAS 10X20 X100 UNID (AJI)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 859.5, costo_flete = 0, margen_aplicado = 73.08 WHERE upper(trim(nombre)) = 'BOLSAS 4X25 X100 (JUGUITO)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1123.97, costo_flete = 0, margen_aplicado = 61.76 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 30X40 BCAS LIV.X 100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1421.49, costo_flete = 0, margen_aplicado = 86.05 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 40X50 OF BCAS X 100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1226.45, costo_flete = 0, margen_aplicado = 54.99 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 30X40 BCAS REF KING PACK X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1953.72, costo_flete = 0, margen_aplicado = 48.05 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 40X50 BCAS REF KING PACK X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3041.32, costo_flete = 0, margen_aplicado = 82.07 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 45X60 BCAS REF X 100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3966.94, costo_flete = 0, margen_aplicado = 50 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 50X60 BCASX100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4628.1, costo_flete = 0, margen_aplicado = 50 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 50X70 BCAS X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5785.12, costo_flete = 0, margen_aplicado = 50 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 60X80 BCASX100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1396.69, costo_flete = 0, margen_aplicado = 53.85 WHERE upper(trim(nombre)) = 'BOLSAS CAM. 40X50 NEGRAS X 100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 743.8, costo_flete = 0, margen_aplicado = 66.67 WHERE upper(trim(nombre)) = 'BOLSAS CONS. 60X90 REF X10 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1640.5, costo_flete = 0, margen_aplicado = 61.21 WHERE upper(trim(nombre)) = 'BOLSAS CONS. 80X110 REF X 10 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1900.83, costo_flete = 0, margen_aplicado = 65.22 WHERE upper(trim(nombre)) = 'BOLSAS CONS. 80X110 S.REF X10 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 590.91, costo_flete = 12, margen_aplicado = 74.82 WHERE upper(trim(nombre)) = 'BOLSAS CUBIERTOS PP 5X25 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1890.91, costo_flete = 12, margen_aplicado = 75.61 WHERE upper(trim(nombre)) = 'BOLSAS DELIVERY 20X30 F5 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1090.91, costo_flete = 12, margen_aplicado = 86.01 WHERE upper(trim(nombre)) = 'BOLSAS DELIVERY 25X12 F3 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1636.36, costo_flete = 12, margen_aplicado = 73.61 WHERE upper(trim(nombre)) = 'BOLSAS DELIVERY 25X16 F4 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3453.72, costo_flete = 12, margen_aplicado = 70.92 WHERE upper(trim(nombre)) = 'BOLSAS DELIVERY 26X37 FM9 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1672.73, costo_flete = 12, margen_aplicado = 76.45 WHERE upper(trim(nombre)) = 'BOLSAS DELIVERY 26X38 F10 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2872.73, costo_flete = 12, margen_aplicado = 73.38 WHERE upper(trim(nombre)) = 'BOLSAS DELIVERY 38X26 F7 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3380.17, costo_flete = 12, margen_aplicado = 69.18 WHERE upper(trim(nombre)) = 'BOLSAS DELIVERY 38X26 F8 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 526.45, costo_flete = 0, margen_aplicado = 56.98 WHERE upper(trim(nombre)) = 'BOLSAS EMBLOCADAS 15X20X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 549.59, costo_flete = 0, margen_aplicado = 65.41 WHERE upper(trim(nombre)) = 'BOLSAS EMBLOCADAS 15X25X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 626.45, costo_flete = 0, margen_aplicado = 71.5 WHERE upper(trim(nombre)) = 'BOLSAS EMBLOCADAS 20X30X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 888.43, costo_flete = 0, margen_aplicado = 67.44 WHERE upper(trim(nombre)) = 'BOLSAS EMBLOCADAS 25X35X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1213.22, costo_flete = 0, margen_aplicado = 70.3 WHERE upper(trim(nombre)) = 'BOLSAS EMBLOCADAS 30X40X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1563.64, costo_flete = 0, margen_aplicado = 69.13 WHERE upper(trim(nombre)) = 'BOLSAS EMBLOCADAS 35X45X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2114.05, costo_flete = 0, margen_aplicado = 72.01 WHERE upper(trim(nombre)) = 'BOLSAS EMBLOCADAS 40X60X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5103.31, costo_flete = 0, margen_aplicado = 70.04 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL KP NUMERO 2 X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5371.9, costo_flete = 0, margen_aplicado = 73.08 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL KP NUMERO 3 X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6714.88, costo_flete = 0, margen_aplicado = 69.23 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL KP NUMERO 5 X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7789.26, costo_flete = 0, margen_aplicado = 112.2 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL KP P/1VINO X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 22727.27, costo_flete = 0, margen_aplicado = 72.73 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL KP P/2VINOS X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 328.1, costo_flete = 12, margen_aplicado = 79.92 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 1 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 595.04, costo_flete = 12, margen_aplicado = 48.81 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 2 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 823.14, costo_flete = 12, margen_aplicado = 65.84 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 3 X 100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 966.12, costo_flete = 12, margen_aplicado = 52.76 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 4 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1129.75, costo_flete = 12, margen_aplicado = 63.29 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 5 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1147.93, costo_flete = 12, margen_aplicado = 67.13 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 6 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1541.32, costo_flete = 12, margen_aplicado = 67.56 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 7 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1885.12, costo_flete = 12, margen_aplicado = 64.4 WHERE upper(trim(nombre)) = 'BOLSAS PAPEL N 8 X 100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 304.13, costo_flete = 12, margen_aplicado = 69.84 WHERE upper(trim(nombre)) = 'BOLSAS PP 10X15X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 388.43, costo_flete = 12, margen_aplicado = 89.97 WHERE upper(trim(nombre)) = 'BOLSAS PP 10X20X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 814.88, costo_flete = 12, margen_aplicado = 72.05 WHERE upper(trim(nombre)) = 'BOLSAS PP 12,5X24(CD) X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 496.69, costo_flete = 12, margen_aplicado = 78.28 WHERE upper(trim(nombre)) = 'BOLSAS PP 12X20X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 542.98, costo_flete = 12, margen_aplicado = 63.08 WHERE upper(trim(nombre)) = 'BOLSAS PP 12X25X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 576.86, costo_flete = 12, margen_aplicado = 66.29 WHERE upper(trim(nombre)) = 'BOLSAS PP 15X20X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 654.55, costo_flete = 12, margen_aplicado = 80.37 WHERE upper(trim(nombre)) = 'BOLSAS PP 15X24 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 838.02, costo_flete = 12, margen_aplicado = 76.11 WHERE upper(trim(nombre)) = 'BOLSAS PP 15X35X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 890.08, costo_flete = 12, margen_aplicado = 82.39 WHERE upper(trim(nombre)) = 'BOLSAS PP 16X24 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 850.41, costo_flete = 12, margen_aplicado = 82.22 WHERE upper(trim(nombre)) = 'BOLSAS PP 20X30 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1161.98, costo_flete = 12, margen_aplicado = 71.46 WHERE upper(trim(nombre)) = 'BOLSAS PP 25X35 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1600, costo_flete = 12, margen_aplicado = 70.64 WHERE upper(trim(nombre)) = 'BOLSAS PP 30X40X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1818.18, costo_flete = 12, margen_aplicado = 62.34 WHERE upper(trim(nombre)) = 'BOLSAS PP 40X50X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4363.64, costo_flete = 12, margen_aplicado = 69.1 WHERE upper(trim(nombre)) = 'BOLSAS PP 40X60X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 189.26, costo_flete = 12, margen_aplicado = 75.45 WHERE upper(trim(nombre)) = 'BOLSAS PP 6X10X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 377.69, costo_flete = 12, margen_aplicado = 75.83 WHERE upper(trim(nombre)) = 'BOLSAS PP 6X15X100' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 309.09, costo_flete = 12, margen_aplicado = 90.99 WHERE upper(trim(nombre)) = 'BOLSAS PP 6X20 X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 235.54, costo_flete = 12, margen_aplicado = 87.97 WHERE upper(trim(nombre)) = 'BOLSAS PP 8X10X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 263.64, costo_flete = 12, margen_aplicado = 81.93 WHERE upper(trim(nombre)) = 'BOLSAS PP 8X15X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 363.64, costo_flete = 12, margen_aplicado = 82.63 WHERE upper(trim(nombre)) = 'BOLSAS PP 8X20X100' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3471.07, costo_flete = 0, margen_aplicado = 59.52 WHERE upper(trim(nombre)) = 'BOLSAS PRE-PIZZA ESTAMPADA X 100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6198.35, costo_flete = 0, margen_aplicado = 69.33 WHERE upper(trim(nombre)) = 'BOLSAS RESIDUOS PATOGENAS ROJAS 50X70X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1764.46, costo_flete = 0, margen_aplicado = 68.62 WHERE upper(trim(nombre)) = 'BOLSAS RIÑON BCA 20X30X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1209.09, costo_flete = 0, margen_aplicado = 70.88 WHERE upper(trim(nombre)) = 'BOLSAS RIÑON BCAS 15X20X50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2045.45, costo_flete = 0, margen_aplicado = 69.7 WHERE upper(trim(nombre)) = 'BOLSAS RIÑON BCAS 25X35X50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2789.26, costo_flete = 0, margen_aplicado = 71.85 WHERE upper(trim(nombre)) = 'BOLSAS RIÑON BCAS 30X40X50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3904.96, costo_flete = 0, margen_aplicado = 69.31 WHERE upper(trim(nombre)) = 'BOLSAS RIÑON BCAS 35X45X50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5113.22, costo_flete = 0, margen_aplicado = 69.71 WHERE upper(trim(nombre)) = 'BOLSAS RIÑON BCAS 40X50X50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 556.2, costo_flete = 12, margen_aplicado = 85.73 WHERE upper(trim(nombre)) = 'BOX BANDEJA ARMABLE P/ DESAYUNO IMPRESA PETALOS (30X25X8) FELIZ DIA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 754.55, costo_flete = 12, margen_aplicado = 66.25 WHERE upper(trim(nombre)) = 'BOX CARTULINA EN TAPA Y BASE MICRO 25X25X12 "LINEA ARGENTINA"' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2181.82, costo_flete = 12, margen_aplicado = 58.96 WHERE upper(trim(nombre)) = 'BUDINERA ALUMINIO 300 GRX25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1880.17, costo_flete = 0, margen_aplicado = 64.83 WHERE upper(trim(nombre)) = 'BUDINERA PAPEL 240GRSX25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2024.79, costo_flete = 0, margen_aplicado = 73.47 WHERE upper(trim(nombre)) = 'BUDINERA PAPEL X 280GRX25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 130.58, costo_flete = 12, margen_aplicado = 80.83 WHERE upper(trim(nombre)) = 'CAJA "LOVE"' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4074.38, costo_flete = 7, margen_aplicado = 102.84 WHERE upper(trim(nombre)) = 'CAJA 1/2 PIZZA ECO "INTERMEDIA"X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4363.64, costo_flete = 12, margen_aplicado = 58.96 WHERE upper(trim(nombre)) = 'CAJA 1/2 PIZZA ECO GRIS X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6000, costo_flete = 12, margen_aplicado = 62.95 WHERE upper(trim(nombre)) = 'CAJA 1/2 PIZZA MICRO X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 214.88, costo_flete = 12, margen_aplicado = 140.38 WHERE upper(trim(nombre)) = 'CAJA BOMBONES CHICA 1/4' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 291.74, costo_flete = 12, margen_aplicado = 77.05 WHERE upper(trim(nombre)) = 'CAJA BOMBONES CHICA BLANCA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 356.2, costo_flete = 12, margen_aplicado = 86.44 WHERE upper(trim(nombre)) = 'CAJA BOMBONES GRANDE' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 329.75, costo_flete = 12, margen_aplicado = 79.02 WHERE upper(trim(nombre)) = 'CAJA BOMBONES GRANDE 1/2' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 866.12, costo_flete = 12, margen_aplicado = 53.35 WHERE upper(trim(nombre)) = 'CAJA BOX 25X25 C/BASE MICROCORRUGADA Y TAPA VISOR IMPRESA IMPRESA FUN' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1378.51, costo_flete = 12, margen_aplicado = 82 WHERE upper(trim(nombre)) = 'CAJA BOX CARTULINA C/VISOR B.MICRO LAMINADA 25X25X12' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 581.82, costo_flete = 12, margen_aplicado = 77.56 WHERE upper(trim(nombre)) = 'CAJA BOX CARTULINA CON TAPA VISOR 25X25X12' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 600, costo_flete = 12, margen_aplicado = 84.47 WHERE upper(trim(nombre)) = 'CAJA BOX CON TAPA VISOR 30X30X12' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 113.22, costo_flete = 12, margen_aplicado = 72.71 WHERE upper(trim(nombre)) = 'CAJA CARTULINA BLANCA P/ MUFFINS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 698.35, costo_flete = 12, margen_aplicado = 72.23 WHERE upper(trim(nombre)) = 'CAJA CARTULINA BLANCO CON VISOR 33X33X15' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 517.36, costo_flete = 12, margen_aplicado = 71.15 WHERE upper(trim(nombre)) = 'CAJA CARTULINA C/VISOR CAMISETA ARGENTINA 18X23X8' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 494.21, costo_flete = 12, margen_aplicado = 71.7 WHERE upper(trim(nombre)) = 'CAJA CARTULINA CON VISOR 26X26X14.6' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 294.21, costo_flete = 12, margen_aplicado = 83.09 WHERE upper(trim(nombre)) = 'CAJA CARTULINA CON VISOR FELIZ DIA PREMIUM' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 414.05, costo_flete = 12, margen_aplicado = 78.21 WHERE upper(trim(nombre)) = 'CAJA CARTULINA PREMIUN 19X19X10 IMPRESA LINEA ARGENTINA C/VISOR' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 590.91, costo_flete = 12, margen_aplicado = 74.82 WHERE upper(trim(nombre)) = 'CAJA CARTULINA PREMIUN CON VISOR CON PORTA HUEVO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 269.42, costo_flete = 12, margen_aplicado = 105.41 WHERE upper(trim(nombre)) = 'CAJA CARTULINA PREMIUN TAPA CORAZON IMPRESA FELIZ DIA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 170.25, costo_flete = 12, margen_aplicado = 82.04 WHERE upper(trim(nombre)) = 'CAJA COOKIES 10X10X5 COLOR' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 536.36, costo_flete = 12, margen_aplicado = 78.85 WHERE upper(trim(nombre)) = 'CAJA DE CARTULINA PREMIUN BLANCA 19X19 CON PORTA HUEVO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1378.51, costo_flete = 12, margen_aplicado = 82 WHERE upper(trim(nombre)) = 'CAJA DESAYUNO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6363.64, costo_flete = 12, margen_aplicado = 73.93 WHERE upper(trim(nombre)) = 'CAJA DOBLE HAMBURGUESA MICRO X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 885.12, costo_flete = 12, margen_aplicado = 72.57 WHERE upper(trim(nombre)) = 'CAJA DRIPCAKE 30X30X32 CON BASE MICRO Y TAPA MARRON' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7148.76, costo_flete = 7, margen_aplicado = 72.87 WHERE upper(trim(nombre)) = 'CAJA HAMBURGUESA DOBLE ECO X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5563.64, costo_flete = 12, margen_aplicado = 62.47 WHERE upper(trim(nombre)) = 'CAJA HAMBURGUESA MICRO (18X18X6)X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3842.98, costo_flete = 7, margen_aplicado = 60.79 WHERE upper(trim(nombre)) = 'CAJA LOMO CHICO ECO (22X16X6CM)X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7071.07, costo_flete = 7, margen_aplicado = 58.38 WHERE upper(trim(nombre)) = 'CAJA LOMO GRANDE ECO( 28X11X6 CM)X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7418.18, costo_flete = 12, margen_aplicado = 62.64 WHERE upper(trim(nombre)) = 'CAJA LOMO MICRO GRANDE X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 277.69, costo_flete = 12, margen_aplicado = 86.01 WHERE upper(trim(nombre)) = 'CAJA MINI BOX 12X12' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 214.05, costo_flete = 12, margen_aplicado = 82.71 WHERE upper(trim(nombre)) = 'CAJA P/ MACARONS IMPRESA FELIZ DIA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 233.06, costo_flete = 12, margen_aplicado = 74.14 WHERE upper(trim(nombre)) = 'CAJA P/ MACAROONS 6X20X6' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 476.03, costo_flete = 12, margen_aplicado = 81.36 WHERE upper(trim(nombre)) = 'CAJA P/HUEVO CON VISOR 16,5X23X10' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 12836.36, costo_flete = 12, margen_aplicado = 62.4 WHERE upper(trim(nombre)) = 'CAJA PIZZA 1/2 METRO MICRO (25X55X5)X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6290.91, costo_flete = 12, margen_aplicado = 62.45 WHERE upper(trim(nombre)) = 'CAJA PIZZA CHICA MICRO X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7685.95, costo_flete = 7, margen_aplicado = 60.79 WHERE upper(trim(nombre)) = 'CAJA PIZZA ECO (33X33X4) X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 294.21, costo_flete = 12, margen_aplicado = 75.56 WHERE upper(trim(nombre)) = 'CAJA TAZA CORAZONES 12X12X12' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10136.36, costo_flete = 12, margen_aplicado = 74.71 WHERE upper(trim(nombre)) = 'CAJA TOALLA INTER X 2500 BCAS.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10456.2, costo_flete = 12, margen_aplicado = 69.37 WHERE upper(trim(nombre)) = 'CAJA TOALLA MANO INTER X2500 KING PACK BCA.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 174.38, costo_flete = 12, margen_aplicado = 81.96 WHERE upper(trim(nombre)) = 'CAJA TORTA CHICA CON VISOR' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 435.54, costo_flete = 12, margen_aplicado = 77.89 WHERE upper(trim(nombre)) = 'CAJA VALIJITA CON VISOR CARTULINA FELIZ DIA 14X25X13' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3781.82, costo_flete = 12, margen_aplicado = 52.19 WHERE upper(trim(nombre)) = 'CAJAS LOMO CHICO GRIS X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5309.09, costo_flete = 12, margen_aplicado = 52.89 WHERE upper(trim(nombre)) = 'CAJAS LOMO GRANDE GRIS X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6509.09, costo_flete = 12, margen_aplicado = 57.58 WHERE upper(trim(nombre)) = 'CAJAS PIZZA MICRO (33X33X5) X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 859.5, costo_flete = 0, margen_aplicado = 63.46 WHERE upper(trim(nombre)) = 'BOLSAS CAMISETAS 20X30X100U.BCAS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 823.14, costo_flete = 12, margen_aplicado = 79.29 WHERE upper(trim(nombre)) = 'CINTA ANCHA X 100 MTS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 472.73, costo_flete = 12, margen_aplicado = 71.7 WHERE upper(trim(nombre)) = 'CINTA ANCHA X 50 MTS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 800, costo_flete = 7, margen_aplicado = 73.79 WHERE upper(trim(nombre)) = 'CONO CHICO CARTON X 100UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 896.69, costo_flete = 7, margen_aplicado = 89.5 WHERE upper(trim(nombre)) = 'CONO GRANDE CARTON X100UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2557.85, costo_flete = 0, margen_aplicado = 61.55 WHERE upper(trim(nombre)) = 'BOLSAS CONSORCIOS 90X120X10UNID REF' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 295.04, costo_flete = 0, margen_aplicado = 59.66 WHERE upper(trim(nombre)) = 'COPA ACRILICO AGUA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 295.87, costo_flete = 0, margen_aplicado = 67.6 WHERE upper(trim(nombre)) = 'COPA ACRILICO NANCY CHAMPANG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 148.76, costo_flete = 0, margen_aplicado = 66.67 WHERE upper(trim(nombre)) = 'COPAS DEGUSTACION X 70 C.C' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1198.35, costo_flete = 12, margen_aplicado = 60.1 WHERE upper(trim(nombre)) = 'CUCHARA SOPERA BCA REF X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 595.04, costo_flete = 12, margen_aplicado = 73.61 WHERE upper(trim(nombre)) = 'CUCHARITAS SUNDAE BCA REF X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 950.41, costo_flete = 12, margen_aplicado = 70.81 WHERE upper(trim(nombre)) = 'CUCHILLOS BCO REF X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 9421.49, costo_flete = 0, margen_aplicado = 59.65 WHERE upper(trim(nombre)) = 'DIPS POTES 55 C.C C/TAPA NATURAL X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 35026.45, costo_flete = 12, margen_aplicado = 72.33 WHERE upper(trim(nombre)) = 'DISPENSER DE PARED P/ 5KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 30836.36, costo_flete = 12, margen_aplicado = 72.29 WHERE upper(trim(nombre)) = 'DISPENSER JABON LIQUIDO ACERO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 37818.18, costo_flete = 12, margen_aplicado = 72.48 WHERE upper(trim(nombre)) = 'DISPENSER JABON LIQUIDO NO TOUCH' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6103.31, costo_flete = 12, margen_aplicado = 63.22 WHERE upper(trim(nombre)) = 'DISPENSER JABON LIQUIDO TECLA AZUL' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6450.41, costo_flete = 12, margen_aplicado = 72.74 WHERE upper(trim(nombre)) = 'DISPENSER P/ TOALLA INTERCALADAS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 29745.45, costo_flete = 12, margen_aplicado = 72.41 WHERE upper(trim(nombre)) = 'DISPENSER P/PAPEL HIG. X 500 MTS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 23272.73, costo_flete = 12, margen_aplicado = 72.48 WHERE upper(trim(nombre)) = 'DISPENSER P/TOALLA BOBINA BCO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 11728.93, costo_flete = 12, margen_aplicado = 62.31 WHERE upper(trim(nombre)) = 'DISPENSER PAPEL HIG P/300MTS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 34327.27, costo_flete = 12, margen_aplicado = 71.97 WHERE upper(trim(nombre)) = 'DISPENSER PAPEL HIG P/300MTS ACERO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 32196.69, costo_flete = 12, margen_aplicado = 72.48 WHERE upper(trim(nombre)) = 'DISPENSER TOALLA INTERCALADA ACERO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 8909.09, costo_flete = 12, margen_aplicado = 72.69 WHERE upper(trim(nombre)) = 'ENSALADERA CRISTAL X 1.100 C.C C/TAPA X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5495.87, costo_flete = 0, margen_aplicado = 65.41 WHERE upper(trim(nombre)) = 'ESCARBADIENRTES X 5000UNID.GRANEL' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 950.41, costo_flete = 0, margen_aplicado = 78.26 WHERE upper(trim(nombre)) = 'ESCARBADIENTES ENSOBRADOS X 500 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5495.87, costo_flete = 0, margen_aplicado = 69.92 WHERE upper(trim(nombre)) = 'ESCARBADIENTES SUELTOS X 3500 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1033.06, costo_flete = 0, margen_aplicado = 100 WHERE upper(trim(nombre)) = 'ESCARBADIENTES X 500 UNID. SUELTOS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 661.16, costo_flete = 0, margen_aplicado = 75 WHERE upper(trim(nombre)) = 'ESCARBADIENTES X100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 826.45, costo_flete = 0, margen_aplicado = 70 WHERE upper(trim(nombre)) = 'ESCARBADIENTES X200 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3854.55, costo_flete = 0, margen_aplicado = 92.97 WHERE upper(trim(nombre)) = 'ESTRUCHE 1 PORCION DE TORTA X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 285.95, costo_flete = 12, margen_aplicado = 80.64 WHERE upper(trim(nombre)) = 'ESTUCHE 12X18 LINEA ARGENTINA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 225.62, costo_flete = 12, margen_aplicado = 79.88 WHERE upper(trim(nombre)) = 'ESTUCHE CON LATERALES IMPRESOS 10X10X7' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 242.15, costo_flete = 12, margen_aplicado = 82.84 WHERE upper(trim(nombre)) = 'ESTUCHE CON VISOR FELIZ DIA 12X18' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 298.35, costo_flete = 12, margen_aplicado = 73.13 WHERE upper(trim(nombre)) = 'ESTUCHE CON VISOR Y MANIJA LINEA PASCUAS 12X18' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2347.11, costo_flete = 12, margen_aplicado = 69.77 WHERE upper(trim(nombre)) = 'ESTUCHE P/ FRITAS CHICO CARTULINA MARRON X 100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1010.74, costo_flete = 12, margen_aplicado = 72.29 WHERE upper(trim(nombre)) = 'FAJAS X 60CM X 1KG BCAS.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2545.45, costo_flete = 12, margen_aplicado = 44.94 WHERE upper(trim(nombre)) = 'PAPEL FILM 38X200 MTS INCA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10336.36, costo_flete = 12, margen_aplicado = 64.19 WHERE upper(trim(nombre)) = 'PAPEL FILM 38X600 MTS "INCA" PLUS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 12851.24, costo_flete = 12, margen_aplicado = 60.77 WHERE upper(trim(nombre)) = 'PAPEL FILM 45X600 MTS "INCA" PLUS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 436.36, costo_flete = 12, margen_aplicado = 69.1 WHERE upper(trim(nombre)) = 'PAPEL FILM FAMILIAR 30X30 MTS' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1600, costo_flete = 12, margen_aplicado = 84.47 WHERE upper(trim(nombre)) = 'FILM STRICH X 10 CM (X 500 GR)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5041.32, costo_flete = 0, margen_aplicado = 60.66 WHERE upper(trim(nombre)) = 'FILM STRICH X 10CM X 500GR NEGRO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 13869.42, costo_flete = 12, margen_aplicado = 59.61 WHERE upper(trim(nombre)) = 'FILM STRICH X 50 CM S/MANGO (4,5KG)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3381.82, costo_flete = 2, margen_aplicado = 65.32 WHERE upper(trim(nombre)) = 'FOLEX 20X25 ROLLO X 750GR.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4915.7, costo_flete = 0, margen_aplicado = 59.72 WHERE upper(trim(nombre)) = 'FOLEX EN PLANCHA 20X25 X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5037.19, costo_flete = 0, margen_aplicado = 72.27 WHERE upper(trim(nombre)) = 'FOLEX EN PLANCHA 25X35 X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 743.8, costo_flete = 0, margen_aplicado = 80 WHERE upper(trim(nombre)) = 'FRAPERA PLASTICO REF.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7216.53, costo_flete = 0, margen_aplicado = 71.78 WHERE upper(trim(nombre)) = 'GOMILLAS REF X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2920.66, costo_flete = 7, margen_aplicado = 69.25 WHERE upper(trim(nombre)) = 'GUANTES LATEX X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 603.31, costo_flete = 0, margen_aplicado = 78.08 WHERE upper(trim(nombre)) = 'GUANTES MANOPLAS X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4991.74, costo_flete = 0, margen_aplicado = 82.12 WHERE upper(trim(nombre)) = 'GUANTES NITRILO "L" X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5466.94, costo_flete = 0, margen_aplicado = 66.29 WHERE upper(trim(nombre)) = 'GUANTES NITRILO "M" X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5466.94, costo_flete = 0, margen_aplicado = 66.29 WHERE upper(trim(nombre)) = 'GUANTES NITRILO "S" X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5466.94, costo_flete = 0, margen_aplicado = 66.29 WHERE upper(trim(nombre)) = 'GUANTES NITRILO "XL" X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3996.69, costo_flete = 7, margen_aplicado = 39.14 WHERE upper(trim(nombre)) = 'HAMBURGUESA SIMPLE ECO X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1052.89, costo_flete = 12, margen_aplicado = 75.21 WHERE upper(trim(nombre)) = 'HILO ALGODON X 300 GR.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1403.31, costo_flete = 12, margen_aplicado = 68.26 WHERE upper(trim(nombre)) = 'HILO CHORIZERO 300 GR.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1322.31, costo_flete = 0, margen_aplicado = 81.25 WHERE upper(trim(nombre)) = 'KG. PERIODICO BLANCO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1911.57, costo_flete = 12, margen_aplicado = 73.71 WHERE upper(trim(nombre)) = 'MANTELES INDIVIDUALES X200' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2933.88, costo_flete = 0, margen_aplicado = 69.01 WHERE upper(trim(nombre)) = 'MOLDE PAN DULCE 1KG X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2561.98, costo_flete = 0, margen_aplicado = 61.29 WHERE upper(trim(nombre)) = 'MOLDE PAN DULCE 500GR X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2231.4, costo_flete = 0, margen_aplicado = 66.67 WHERE upper(trim(nombre)) = 'MOLDES PAN DULCE 250GR X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3801.65, costo_flete = 0, margen_aplicado = 68.48 WHERE upper(trim(nombre)) = 'MOLDES ROSCA 18CM X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4648.76, costo_flete = 0, margen_aplicado = 68.89 WHERE upper(trim(nombre)) = 'MOLDES ROSCA 20CM X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1381.82, costo_flete = 12, margen_aplicado = 76.22 WHERE upper(trim(nombre)) = 'OBLEA TERGOPOR 618 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 520.66, costo_flete = 0, margen_aplicado = 106.35 WHERE upper(trim(nombre)) = 'PALITOS BROCHETT MADERA X80U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 208.26, costo_flete = 0, margen_aplicado = 78.58 WHERE upper(trim(nombre)) = 'PALITOS HELADOS X 50UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 692.56, costo_flete = 12, margen_aplicado = 61.95 WHERE upper(trim(nombre)) = 'PAPEL FAMILIAR X4X30MTS BCO PREMIUM' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1140.5, costo_flete = 0, margen_aplicado = 66.67 WHERE upper(trim(nombre)) = 'PAPEL GRIS X 1KG (40X50CM)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10475.21, costo_flete = 12, margen_aplicado = 69.06 WHERE upper(trim(nombre)) = 'PAPEL HIG 8 X 300 MTS PREMIUN. KING PACK TISSUE' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10475.21, costo_flete = 12, margen_aplicado = 69.06 WHERE upper(trim(nombre)) = 'PAPEL HIG 8X300 MTS . BCO TISSUE' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3761.16, costo_flete = 12, margen_aplicado = 72.65 WHERE upper(trim(nombre)) = 'PAPEL HIG ECO BCO INTERMEDIO X 8 "KING PACK"' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3761.16, costo_flete = 12, margen_aplicado = 72.65 WHERE upper(trim(nombre)) = 'PAPEL HIG ECO BCO INTERMEDIO X 8UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 13102.48, costo_flete = 12, margen_aplicado = 62.19 WHERE upper(trim(nombre)) = 'PAPEL HIG. 4X 500 MTS BCO PREMIUN' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 8039.67, costo_flete = 12, margen_aplicado = 72.55 WHERE upper(trim(nombre)) = 'PAPEL HIGIENICO TUB ANCHO PREMIUN X 300MTS X8UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 872.73, costo_flete = 12, margen_aplicado = 69.1 WHERE upper(trim(nombre)) = 'PAPEL MANTECA FAMILIAR X 5MTS.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7221.49, costo_flete = 12, margen_aplicado = 81.88 WHERE upper(trim(nombre)) = 'PAPEL MANTECA X 1 KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7232.23, costo_flete = 12, margen_aplicado = 73.45 WHERE upper(trim(nombre)) = 'PAPEL PARAFINADO C/MOTIVOS P/HAMBURGUESA (CUADROS) X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 7116.53, costo_flete = 12, margen_aplicado = 76.27 WHERE upper(trim(nombre)) = 'PAPEL PARAFINADO MUNDIAL X 1 KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6733.06, costo_flete = 12, margen_aplicado = 73.16 WHERE upper(trim(nombre)) = 'PAPEL PARAFINADO P/ HAMBURG. 36X40CM X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2814.05, costo_flete = 12, margen_aplicado = 73.06 WHERE upper(trim(nombre)) = 'PAPEL SATINADO P/FONDO PIZZA BCO X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2814.05, costo_flete = 0, margen_aplicado = 93.83 WHERE upper(trim(nombre)) = 'PAPEL SATINADO RAVIOLERO X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 247.93, costo_flete = 0, margen_aplicado = 100 WHERE upper(trim(nombre)) = 'PAQ SERVILLETA 33X33 X 50 UN' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 247.93, costo_flete = 0, margen_aplicado = 100 WHERE upper(trim(nombre)) = 'PAQ SERVILLETAS 18X17 X 50 UNID' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2066.12, costo_flete = 0, margen_aplicado = 100 WHERE upper(trim(nombre)) = 'PARAGUA - FRUTA X100 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5888.43, costo_flete = 0, margen_aplicado = 61.4 WHERE upper(trim(nombre)) = 'PINCHES ESPADITAS X1000 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 413.22, costo_flete = 0, margen_aplicado = 200 WHERE upper(trim(nombre)) = 'PINCHES ESPADITASX100UNID' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 569.42, costo_flete = 0, margen_aplicado = 74.17 WHERE upper(trim(nombre)) = 'PINCHOS DE MADERA X 10 CM X 50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 616.53, costo_flete = 12, margen_aplicado = 79.53 WHERE upper(trim(nombre)) = 'PINCHOS MADERA X 15CM X 50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 206.61, costo_flete = 0, margen_aplicado = 80 WHERE upper(trim(nombre)) = 'PIROTINES N¼10 X25 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 119.83, costo_flete = 0, margen_aplicado = 79.32 WHERE upper(trim(nombre)) = 'PIROTINES N¼2 X 25 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 122.31, costo_flete = 0, margen_aplicado = 75.68 WHERE upper(trim(nombre)) = 'PIROTINES N¼5 X 25 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 177.69, costo_flete = 0, margen_aplicado = 76.74 WHERE upper(trim(nombre)) = 'PIROTINES N¼7 X 25 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3099.17, costo_flete = 0, margen_aplicado = 73.33 WHERE upper(trim(nombre)) = 'PLATOS X 17 CM X 50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2140.5, costo_flete = 0, margen_aplicado = 73.74 WHERE upper(trim(nombre)) = 'PLATOS X 17CM CELESTES X 50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 8264.46, costo_flete = 0, margen_aplicado = 70 WHERE upper(trim(nombre)) = 'PLATOS X 22 CM X 50 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 20436.36, costo_flete = 12, margen_aplicado = 53.46 WHERE upper(trim(nombre)) = 'PLATOS X 34 "MARMITAS " X 50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 731.4, costo_flete = 7, margen_aplicado = 58.4 WHERE upper(trim(nombre)) = 'PORTA PANCHOS X 100UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 743.8, costo_flete = 0, margen_aplicado = 77.78 WHERE upper(trim(nombre)) = 'POTE ADEREZO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4000, costo_flete = 12, margen_aplicado = 72.48 WHERE upper(trim(nombre)) = 'POTES BISAGRA 270 C.C X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4218.18, costo_flete = 12, margen_aplicado = 74.93 WHERE upper(trim(nombre)) = 'POTES BISAGRA 250 C.C WORK REF X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4036.36, costo_flete = 12, margen_aplicado = 72.76 WHERE upper(trim(nombre)) = 'POTES BISAGRA 340 C.C X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4218.18, costo_flete = 12, margen_aplicado = 79.31 WHERE upper(trim(nombre)) = 'POTES BISAGRA 350 C.C WORK REF X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5238.02, costo_flete = 12, margen_aplicado = 52.14 WHERE upper(trim(nombre)) = 'POTES BISAGRA 440 C.C X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5672.73, costo_flete = 12, margen_aplicado = 72.35 WHERE upper(trim(nombre)) = 'POTES BISAGRA 500 C.C WORK REF X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4800, costo_flete = 12, margen_aplicado = 72.94 WHERE upper(trim(nombre)) = 'POTES PLAST. WORK 1/2 C/TAPAS X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3600, costo_flete = 12, margen_aplicado = 72.18 WHERE upper(trim(nombre)) = 'POTES PLAST. WORK 1/4 C/TAPAS X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3345.45, costo_flete = 12, margen_aplicado = 72.04 WHERE upper(trim(nombre)) = 'POTES PLAST. WORK 1/8 C/TAPAS X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 10400, costo_flete = 12, margen_aplicado = 62.12 WHERE upper(trim(nombre)) = 'POTES PLAST. WORK 1KG C/TAPAS CRISTAL X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6109.09, costo_flete = 12, margen_aplicado = 63.06 WHERE upper(trim(nombre)) = 'POTES PLAST. X 1/2 C/TAPA NAT. X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4400, costo_flete = 12, margen_aplicado = 62.67 WHERE upper(trim(nombre)) = 'POTES PLAST. X 1/4 C/TAPA NAT. X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4036.36, costo_flete = 12, margen_aplicado = 62.7 WHERE upper(trim(nombre)) = 'POTES PLAST. X 1/8 C/TAPA NAT. X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 12000, costo_flete = 12, margen_aplicado = 62.95 WHERE upper(trim(nombre)) = 'POTES PLASTICOS X 1KG C/TAPA NAT. X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 413.22, costo_flete = 0, margen_aplicado = 80 WHERE upper(trim(nombre)) = 'PRECINTOS X 100GR' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 909.09, costo_flete = 0, margen_aplicado = 63.64 WHERE upper(trim(nombre)) = 'BOLSAS RESIDUOS 45X60X30U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 533.06, costo_flete = 0, margen_aplicado = 70.54 WHERE upper(trim(nombre)) = 'BOLSAS RESIDUOS 50X70X10U.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 495.87, costo_flete = 0, margen_aplicado = 150 WHERE upper(trim(nombre)) = 'ROCIADOR CHICO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1322.31, costo_flete = 0, margen_aplicado = 68.75 WHERE upper(trim(nombre)) = 'ROCIADOR TRASLUCIDO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6322.31, costo_flete = 12, margen_aplicado = 72.74 WHERE upper(trim(nombre)) = 'ROLLO SERVILLETAS X 200 PAÑOS X 8 UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6851.24, costo_flete = 12, margen_aplicado = 61.55 WHERE upper(trim(nombre)) = 'SERVI EXPRES 14X14 PAPEL SEDA "MRC"' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2600.83, costo_flete = 12, margen_aplicado = 73.07 WHERE upper(trim(nombre)) = 'SERVILLETAS 18X17COD2000 BCAS.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2709.09, costo_flete = 12, margen_aplicado = 63.43 WHERE upper(trim(nombre)) = 'SERVILLETAS 18X17COD2000 C/GUARDA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 8488.43, costo_flete = 12, margen_aplicado = 65.17 WHERE upper(trim(nombre)) = 'SERVILLETAS 24X24X2000UNI.BCAS TISSUE' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3561.98, costo_flete = 12, margen_aplicado = 59.51 WHERE upper(trim(nombre)) = 'SERVILLETAS 30X30 BCASX500UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5106.61, costo_flete = 12, margen_aplicado = 69.06 WHERE upper(trim(nombre)) = 'SERVILLETAS 30X30X1000UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 9644.63, costo_flete = 0, margen_aplicado = 62.81 WHERE upper(trim(nombre)) = 'SERVILLETAS (33X33) ELEGANTE X 1000UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4421.49, costo_flete = 0, margen_aplicado = 86.92 WHERE upper(trim(nombre)) = 'SORBETES BCOS X 1000 C/ FUNDA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3966.94, costo_flete = 0, margen_aplicado = 108.33 WHERE upper(trim(nombre)) = 'SORBETES COLOR FLUOR X500UNID' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 661.16, costo_flete = 0, margen_aplicado = 150 WHERE upper(trim(nombre)) = 'SORBETES CON FUNDA X100UNID.' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3842.98, costo_flete = 0, margen_aplicado = 72.04 WHERE upper(trim(nombre)) = 'SORBETES NEGROS X500 UNIDADES' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 826.45, costo_flete = 0, margen_aplicado = 150 WHERE upper(trim(nombre)) = 'SORBETES X100 COLOR' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 826.45, costo_flete = 0, margen_aplicado = 100 WHERE upper(trim(nombre)) = 'SORBETES X100 NEGRO' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 16047.93, costo_flete = 12, margen_aplicado = 60.93 WHERE upper(trim(nombre)) = 'FILM STRICH X 50 CM C/MANGO X (4,5KG)' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1527.27, costo_flete = 12, margen_aplicado = 78.77 WHERE upper(trim(nombre)) = 'TAPA ALUMINIO F75 X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 557.85, costo_flete = 0, margen_aplicado = 70.37 WHERE upper(trim(nombre)) = 'TAPA VASOS TERMICOS X 120 C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4800, costo_flete = 12, margen_aplicado = 61.42 WHERE upper(trim(nombre)) = 'TAPAS BANDEJA 107 PP COTNYL X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2836.36, costo_flete = 12, margen_aplicado = 62.6 WHERE upper(trim(nombre)) = 'TAPAS BANDEJA 102 PP COTNYL X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3818.18, costo_flete = 12, margen_aplicado = 64.27 WHERE upper(trim(nombre)) = 'TAPAS BANDEJA 103 PP COTNYL X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3636.36, costo_flete = 12, margen_aplicado = 62.34 WHERE upper(trim(nombre)) = 'TAPAS BANDEJA 105 PP COTNYL X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 661.16, costo_flete = 0, margen_aplicado = 75 WHERE upper(trim(nombre)) = 'TAPAS VASOS TERMICOS X 180 C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 640.5, costo_flete = 0, margen_aplicado = 74.19 WHERE upper(trim(nombre)) = 'TAPAS VASOS TERMICOS X 240 C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 764.46, costo_flete = 0, margen_aplicado = 72.97 WHERE upper(trim(nombre)) = 'TAPAS VASOS TERMICOS X 300C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 950.41, costo_flete = 12, margen_aplicado = 70.81 WHERE upper(trim(nombre)) = 'TENEDORES BCO REF X 50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 9669.42, costo_flete = 12, margen_aplicado = 72.47 WHERE upper(trim(nombre)) = 'TOALLA BOB . 2 X 300 MTS PREMIUN' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 9669.42, costo_flete = 12, margen_aplicado = 72.47 WHERE upper(trim(nombre)) = 'TOALLA BOB. KING PACK 2X300MTS PREMIUN' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3533.06, costo_flete = 0, margen_aplicado = 59.06 WHERE upper(trim(nombre)) = 'TOALLA INTER. ECO LUXE X1000U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3590.91, costo_flete = 12, margen_aplicado = 72.61 WHERE upper(trim(nombre)) = 'TOALLA INTER. ECO KING PACK X1000U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 217.36, costo_flete = 0, margen_aplicado = 71.1 WHERE upper(trim(nombre)) = 'TORTERA PET T26 ALTA BASE -TAPA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 214.05, costo_flete = 0, margen_aplicado = 77.61 WHERE upper(trim(nombre)) = 'TORTERA PET T26 BAJA BASE -TAPA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 295.87, costo_flete = 0, margen_aplicado = 78.77 WHERE upper(trim(nombre)) = 'TORTERA PET T28 BAJA BASE -TAPA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 485.12, costo_flete = 0, margen_aplicado = 70.36 WHERE upper(trim(nombre)) = 'TORTERA PET T32 ALTA BASE -TAPA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 395.04, costo_flete = 0, margen_aplicado = 77.82 WHERE upper(trim(nombre)) = 'TORTERA PET T32 BAJA BASE -TAPA' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2066.12, costo_flete = 0, margen_aplicado = 60 WHERE upper(trim(nombre)) = 'TRIPODES X 1KG' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 9090.91, costo_flete = 12, margen_aplicado = 62.34 WHERE upper(trim(nombre)) = 'VASO 12 OZ C/TAPA RIPPLE KRAF X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 6363.64, costo_flete = 12, margen_aplicado = 62.34 WHERE upper(trim(nombre)) = 'VASO 8 OZ C/TAPA RIPPLE X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1322.31, costo_flete = 0, margen_aplicado = 68.75 WHERE upper(trim(nombre)) = 'VASO TRAGO LARGO COLOR X10U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 9380.17, costo_flete = 0, margen_aplicado = 63 WHERE upper(trim(nombre)) = 'VASOS DEGUSTACION ACRILICO X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 12314.05, costo_flete = 0, margen_aplicado = 67.79 WHERE upper(trim(nombre)) = 'VASOS MILANO 370 C.C C/TAPA X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 5272.73, costo_flete = 12, margen_aplicado = 73.53 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 1 LTS X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2066.12, costo_flete = 0, margen_aplicado = 60 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 110C.C X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1963.64, costo_flete = 12, margen_aplicado = 69.1 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 180 C.C X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2254.55, costo_flete = 12, margen_aplicado = 76.74 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 220C.C X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2909.09, costo_flete = 12, margen_aplicado = 69.95 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 300 C.C TRAS X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 3272.73, costo_flete = 12, margen_aplicado = 71.36 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 330C.C X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 2690.91, costo_flete = 12, margen_aplicado = 71.39 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 500C.C X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1818.18, costo_flete = 0, margen_aplicado = 72.73 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 70 C.C X100U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4218.18, costo_flete = 12, margen_aplicado = 74.93 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 800C.C X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 4690.91, costo_flete = 12, margen_aplicado = 62.02 WHERE upper(trim(nombre)) = 'VASOS PLASTICOS X 800C.C WORK X50U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 867.77, costo_flete = 0, margen_aplicado = 71.43 WHERE upper(trim(nombre)) = 'VASOS TERMICOS X 120 C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1053.72, costo_flete = 0, margen_aplicado = 68.63 WHERE upper(trim(nombre)) = 'VASOS TERMICOS X 180 C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1219.01, costo_flete = 0, margen_aplicado = 69.49 WHERE upper(trim(nombre)) = 'VASOS TERMICOS X 240 C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1446.28, costo_flete = 0, margen_aplicado = 71.43 WHERE upper(trim(nombre)) = 'VASOS TERMICOS X 300 C.C X25U' AND deleted_at IS NULL;
UPDATE articulos SET costo_base = 1280.99, costo_flete = 0, margen_aplicado = 65.16 WHERE upper(trim(nombre)) = 'VASOS TRAGO LARGO TRASLUCIDOS X10U' AND deleted_at IS NULL;

-- 2. Desactivar los artículos que el cliente sacó del Excel
UPDATE articulos SET activo = false
 WHERE deleted_at IS NULL AND activo = true
   AND upper(trim(nombre)) NOT IN (
  'AGITADORES CAFE TRAS.X 100 UNID.',
  'AGITADORES CAFE TRAS.X 1000 UNID.',
  'AGITADORES TRAGO LARGO COLOR X100 UNID.',
  'PAPEL ALUMINIO FAMILIAR X 5 MTS',
  'PAPEL ALUMINIO X 1KG',
  'BANDEJA ORO LAMINA X 28 CM',
  'BANDEJA ORO LAMINADA 30 CM',
  'BANDEJA ORO LAMINADA 33 CM',
  'BANDEJA ORO LAMINADA X 25 CM',
  'BANDEJA REC. LAMIMINA P/3 KG',
  'BANDEJA TERGOPOR 615X50UNID.',
  'BANDEJA TERGOPOR 618X50NUD.',
  'BANDEJA TERGOPOR 619X50UNID.',
  'BANDEJA TERGOPOR 625X50UNID.',
  'BANDEJA TERGOPOR 628X50UNID.',
  'BANDEJA CARTON GRIS N1 X 100UNID.',
  'BANDEJA CARTON GRIS N2 X 100 UNID.',
  'BANDEJA CARTON GRIS N3 X 100 UNID.',
  'BANDEJA CARTON GRIS N4 X 100 UNID.',
  'BANDEJA REC. ALUMINIO F100 X 50 UNID.',
  'BANDEJA REC.ALUMINIO F75 X 5OUNID.',
  'BANDEJA REC.ALUMINIO P21 X50UNID.',
  'BANDEJA RED.ALUMINIO P30 X50UNID.',
  'BANDEJA RED.ALUMINIO P33 X50UNID.',
  'BANDEJA CARTON GRIS RED. N12 X1OO UNID.',
  'BANDEJA ESTUCHE 103 PP X 50UNID.',
  'BANDEJA ESTUCHE 105 PP OVAL X50UNID.',
  'BANDEJA LAMINA P/1 KG 23X28',
  'BANDEJA LAMINADA P/ 2 KG 28X30',
  'BANDEJAS CARTON GRIS RED N 13X1OOU.',
  'BANDEJA PLAST. 101 PP COTNYL X100U.',
  'BANDEJA PLAST.102 COTNYL X100U.',
  'BANDEJA PLAST. 102 PP X100U.',
  'BANDEJA PLAST.102 PP NEGRAS X100U.',
  'BANDEJA PLAST.103 PP X1OOU.',
  'BANDEJA PLAST. 103 PP COTNYL X100U.',
  'BANDEJA PLAST. 105 PP X100U.',
  'BANDEJA PLAST. 105 PP WORK X1OOU.',
  'BANDEJA PLAST. 105 REC. PP COTNYL X1OOU.',
  'BANDEJA PLAST. 107 PP X1OOU.',
  'BANDEJAS PLAST.107 PP COTNYL X100U.',
  'BANDEJA REC ALUMINIO F200 X50U.',
  'BANDEJA REC ALUMINIO F50 X50U.',
  'BANDEJA RED ALUMINIO P12 X50U.',
  'BANDEJA RED ALUMINIO P15 X50U.',
  'BANDEJA RED ALUMINIO P26 X50U.',
  'BANDEJA CARTON GRIS RED. N 14 X100U.',
  'BANDEJA CARTON GRIS RED. N 15 X100U.',
  'BANDEJA CARTON GRIS RED. N 16 X100U.',
  'BENGALAS X 4 UNID.',
  'BOB. ARRANQ 40X60X1,2 KG',
  'BOB. ARRANQ. 20X30X1,2KG',
  'BOB. ARRANQ. 25X35 1,2KG',
  'BOB. ARRANQ. 30X40X1,2KG',
  'BOB. ARRANQ. 35X45X1,2KG',
  'BOB. ARRANQ. 50X701,2KG',
  'BOB. ARRANQUE 60X90X1,5KG',
  'BOB. IND"KING PACK" X 25CMX400MTS X 2 UNID. BCA',
  'BOB. IND "REVENTA" X 25CM X 400MTS X 2 UNID. BCA',
  'BOB. PAPEL GRIS X 60CM (11.500KG)',
  'BOB. ARRANQ. 15X20X400GR',
  'BOB. ARRANQ. 15X25X400GR',
  'BOB. PAPEL GRIS X 40 CM (8 KG)',
  'BOB. PAPEL GRIS X 20 CM X 3.500KG',
  'BOB. PAPEL PANADERIA "FANTASIA" X40CM (2.500)KG.',
  'BOB. PAPEL PANADERIA "FANTASIA"X60CM (6.500) KG',
  'BOLSA DE HORNO X 10 UNID.',
  'BOLSAS 10X20 X100 UNID (AJI)',
  'BOLSAS 4X25 X100 (JUGUITO)',
  'BOLSAS CAM. 30X40 BCAS LIV.X 100U',
  'BOLSAS CAM. 40X50 OF BCAS X 100U',
  'BOLSAS CAM. 30X40 BCAS REF KING PACK X100U',
  'BOLSAS CAM. 40X50 BCAS REF KING PACK X100U',
  'BOLSAS CAM. 45X60 BCAS REF X 100U',
  'BOLSAS CAM. 50X60 BCASX100U',
  'BOLSAS CAM. 50X70 BCAS X100U',
  'BOLSAS CAM. 60X80 BCASX100U',
  'BOLSAS CAM. 40X50 NEGRAS X 100U',
  'BOLSAS CONS. 60X90 REF X10 UNID.',
  'BOLSAS CONS. 80X110 REF X 10 UNID.',
  'BOLSAS CONS. 80X110 S.REF X10 UNID.',
  'BOLSAS CUBIERTOS PP 5X25 X100U',
  'BOLSAS DELIVERY 20X30 F5 X50U',
  'BOLSAS DELIVERY 25X12 F3 X50U',
  'BOLSAS DELIVERY 25X16 F4 X50U',
  'BOLSAS DELIVERY 26X37 FM9 X50U',
  'BOLSAS DELIVERY 26X38 F10 X50U',
  'BOLSAS DELIVERY 38X26 F7 X50U',
  'BOLSAS DELIVERY 38X26 F8 X50U',
  'BOLSAS EMBLOCADAS 15X20X100U',
  'BOLSAS EMBLOCADAS 15X25X100U',
  'BOLSAS EMBLOCADAS 20X30X100U',
  'BOLSAS EMBLOCADAS 25X35X100U',
  'BOLSAS EMBLOCADAS 30X40X100U',
  'BOLSAS EMBLOCADAS 35X45X100U',
  'BOLSAS EMBLOCADAS 40X60X100U',
  'BOLSAS PAPEL KP NUMERO 2 X25U',
  'BOLSAS PAPEL KP NUMERO 3 X25U',
  'BOLSAS PAPEL KP NUMERO 5 X25U',
  'BOLSAS PAPEL KP P/1VINO X25U',
  'BOLSAS PAPEL KP P/2VINOS X25U',
  'BOLSAS PAPEL N 1 X100U',
  'BOLSAS PAPEL N 2 X100U',
  'BOLSAS PAPEL N 3 X 100U',
  'BOLSAS PAPEL N 4 X100U',
  'BOLSAS PAPEL N 5 X100U',
  'BOLSAS PAPEL N 6 X100U',
  'BOLSAS PAPEL N 7 X100U',
  'BOLSAS PAPEL N 8 X 100U',
  'BOLSAS PP 10X15X100U',
  'BOLSAS PP 10X20X100U',
  'BOLSAS PP 12,5X24(CD) X100U',
  'BOLSAS PP 12X20X100U',
  'BOLSAS PP 12X25X100U',
  'BOLSAS PP 15X20X100U',
  'BOLSAS PP 15X24 X100U',
  'BOLSAS PP 15X35X100U',
  'BOLSAS PP 16X24 X100U',
  'BOLSAS PP 20X30 X100U',
  'BOLSAS PP 25X35 X100U',
  'BOLSAS PP 30X40X100U',
  'BOLSAS PP 40X50X100U',
  'BOLSAS PP 40X60X100U',
  'BOLSAS PP 6X10X100U',
  'BOLSAS PP 6X15X100',
  'BOLSAS PP 6X20 X100U',
  'BOLSAS PP 8X10X100U',
  'BOLSAS PP 8X15X100U',
  'BOLSAS PP 8X20X100',
  'BOLSAS PRE-PIZZA ESTAMPADA X 100 UNID.',
  'BOLSAS RESIDUOS PATOGENAS ROJAS 50X70X100U',
  'BOLSAS RIÑON BCA 20X30X50UNID.',
  'BOLSAS RIÑON BCAS 15X20X50UNID.',
  'BOLSAS RIÑON BCAS 25X35X50 UNID.',
  'BOLSAS RIÑON BCAS 30X40X50 UNID.',
  'BOLSAS RIÑON BCAS 35X45X50 UNID.',
  'BOLSAS RIÑON BCAS 40X50X50 UNID.',
  'BOX BANDEJA ARMABLE P/ DESAYUNO IMPRESA PETALOS (30X25X8) FELIZ DIA',
  'BOX CARTULINA EN TAPA Y BASE MICRO 25X25X12 "LINEA ARGENTINA"',
  'BUDINERA ALUMINIO 300 GRX25U',
  'BUDINERA PAPEL 240GRSX25U',
  'BUDINERA PAPEL X 280GRX25U',
  'CAJA "LOVE"',
  'CAJA 1/2 PIZZA ECO "INTERMEDIA"X100U',
  'CAJA 1/2 PIZZA ECO GRIS X100U',
  'CAJA 1/2 PIZZA MICRO X50U',
  'CAJA BOMBONES CHICA 1/4',
  'CAJA BOMBONES CHICA BLANCA',
  'CAJA BOMBONES GRANDE',
  'CAJA BOMBONES GRANDE 1/2',
  'CAJA BOX 25X25 C/BASE MICROCORRUGADA Y TAPA VISOR IMPRESA IMPRESA FUN',
  'CAJA BOX CARTULINA C/VISOR B.MICRO LAMINADA 25X25X12',
  'CAJA BOX CARTULINA CON TAPA VISOR 25X25X12',
  'CAJA BOX CON TAPA VISOR 30X30X12',
  'CAJA CARTULINA BLANCA P/ MUFFINS',
  'CAJA CARTULINA BLANCO CON VISOR 33X33X15',
  'CAJA CARTULINA C/VISOR CAMISETA ARGENTINA 18X23X8',
  'CAJA CARTULINA CON VISOR 26X26X14.6',
  'CAJA CARTULINA CON VISOR FELIZ DIA PREMIUM',
  'CAJA CARTULINA PREMIUN 19X19X10 IMPRESA LINEA ARGENTINA C/VISOR',
  'CAJA CARTULINA PREMIUN CON VISOR CON PORTA HUEVO',
  'CAJA CARTULINA PREMIUN TAPA CORAZON IMPRESA FELIZ DIA',
  'CAJA COOKIES 10X10X5 COLOR',
  'CAJA DE CARTULINA PREMIUN BLANCA 19X19 CON PORTA HUEVO',
  'CAJA DESAYUNO',
  'CAJA DOBLE HAMBURGUESA MICRO X50U',
  'CAJA DRIPCAKE 30X30X32 CON BASE MICRO Y TAPA MARRON',
  'CAJA HAMBURGUESA DOBLE ECO X100U',
  'CAJA HAMBURGUESA MICRO (18X18X6)X50U',
  'CAJA LOMO CHICO ECO (22X16X6CM)X100U',
  'CAJA LOMO GRANDE ECO( 28X11X6 CM)X100U',
  'CAJA LOMO MICRO GRANDE X50U',
  'CAJA MINI BOX 12X12',
  'CAJA P/ MACARONS IMPRESA FELIZ DIA',
  'CAJA P/ MACAROONS 6X20X6',
  'CAJA P/HUEVO CON VISOR 16,5X23X10',
  'CAJA PIZZA 1/2 METRO MICRO (25X55X5)X50U',
  'CAJA PIZZA CHICA MICRO X50U',
  'CAJA PIZZA ECO (33X33X4) X100U',
  'CAJA TAZA CORAZONES 12X12X12',
  'CAJA TOALLA INTER X 2500 BCAS.',
  'CAJA TOALLA MANO INTER X2500 KING PACK BCA.',
  'CAJA TORTA CHICA CON VISOR',
  'CAJA VALIJITA CON VISOR CARTULINA FELIZ DIA 14X25X13',
  'CAJAS LOMO CHICO GRIS X100U',
  'CAJAS LOMO GRANDE GRIS X100U',
  'CAJAS PIZZA MICRO (33X33X5) X50U',
  'BOLSAS CAMISETAS 20X30X100U.BCAS',
  'CINTA ANCHA X 100 MTS',
  'CINTA ANCHA X 50 MTS',
  'CONO CHICO CARTON X 100UNID.',
  'CONO GRANDE CARTON X100UNID.',
  'BOLSAS CONSORCIOS 90X120X10UNID REF',
  'COPA ACRILICO AGUA',
  'COPA ACRILICO NANCY CHAMPANG',
  'COPAS DEGUSTACION X 70 C.C',
  'CUCHARA SOPERA BCA REF X50U',
  'CUCHARITAS SUNDAE BCA REF X50U',
  'CUCHILLOS BCO REF X50U',
  'DIPS POTES 55 C.C C/TAPA NATURAL X100U',
  'DISPENSER DE PARED P/ 5KG',
  'DISPENSER JABON LIQUIDO ACERO',
  'DISPENSER JABON LIQUIDO NO TOUCH',
  'DISPENSER JABON LIQUIDO TECLA AZUL',
  'DISPENSER P/ TOALLA INTERCALADAS',
  'DISPENSER P/PAPEL HIG. X 500 MTS',
  'DISPENSER P/TOALLA BOBINA BCO',
  'DISPENSER PAPEL HIG P/300MTS',
  'DISPENSER PAPEL HIG P/300MTS ACERO',
  'DISPENSER TOALLA INTERCALADA ACERO',
  'ENSALADERA CRISTAL X 1.100 C.C C/TAPA X50U',
  'ESCARBADIENRTES X 5000UNID.GRANEL',
  'ESCARBADIENTES ENSOBRADOS X 500 UNID.',
  'ESCARBADIENTES SUELTOS X 3500 UNID.',
  'ESCARBADIENTES X 500 UNID. SUELTOS',
  'ESCARBADIENTES X100 UNID.',
  'ESCARBADIENTES X200 UNID.',
  'ESTRUCHE 1 PORCION DE TORTA X25U',
  'ESTUCHE 12X18 LINEA ARGENTINA',
  'ESTUCHE CON LATERALES IMPRESOS 10X10X7',
  'ESTUCHE CON VISOR FELIZ DIA 12X18',
  'ESTUCHE CON VISOR Y MANIJA LINEA PASCUAS 12X18',
  'ESTUCHE P/ FRITAS CHICO CARTULINA MARRON X 100 UNID.',
  'ESTUCHE P/ FRITAS CHICO CARTULINA BCA X 100',
  'FAJAS X 60CM X 1KG BCAS.',
  'PAPEL FILM 38X200 MTS INCA',
  'PAPEL FILM 38X600 MTS "INCA" PLUS',
  'PAPEL FILM 45X600 MTS "INCA" PLUS',
  'PAPEL FILM FAMILIAR 30X30 MTS',
  'FILM STRICH X 10 CM (X 500 GR)',
  'FILM STRICH X 10CM X 500GR NEGRO',
  'FILM STRICH X 50 CM S/MANGO (4,5KG)',
  'FOLEX 20X25 ROLLO X 750GR.',
  'FOLEX EN PLANCHA 20X25 X 1KG',
  'FOLEX EN PLANCHA 25X35 X 1KG',
  'FRAPERA PLASTICO REF.',
  'GOMILLAS REF X 1KG',
  'GUANTES LATEX X100U',
  'GUANTES MANOPLAS X100U',
  'GUANTES NITRILO "L" X100U',
  'GUANTES NITRILO "M" X100U',
  'GUANTES NITRILO "S" X100U',
  'GUANTES NITRILO "XL" X100U',
  'HAMBURGUESA SIMPLE ECO X100U',
  'HILO ALGODON X 300 GR.',
  'HILO CHORIZERO 300 GR.',
  'KG. PERIODICO BLANCO',
  'MANTELES INDIVIDUALES X200',
  'MOLDE PAN DULCE 1KG X50U',
  'MOLDE PAN DULCE 500GR X50U',
  'MOLDES PAN DULCE 250GR X50U',
  'MOLDES ROSCA 18CM X25U',
  'MOLDES ROSCA 20CM X25U',
  'OBLEA TERGOPOR 618 X50U',
  'PALITOS BROCHETT MADERA X80U',
  'PALITOS HELADOS X 50UNID.',
  'PAPEL FAMILIAR X4X30MTS BCO PREMIUM',
  'PAPEL GRIS X 1KG (40X50CM)',
  'PAPEL HIG 8 X 300 MTS PREMIUN. KING PACK TISSUE',
  'PAPEL HIG 8X300 MTS . BCO TISSUE',
  'PAPEL HIG ECO BCO INTERMEDIO X 8 "KING PACK"',
  'PAPEL HIG ECO BCO INTERMEDIO X 8UNID.',
  'PAPEL HIG. 4X 500 MTS BCO PREMIUN',
  'PAPEL HIGIENICO TUB ANCHO PREMIUN X 300MTS X8UNID.',
  'PAPEL MANTECA FAMILIAR X 5MTS.',
  'PAPEL MANTECA X 1 KG',
  'PAPEL PARAFINADO C/MOTIVOS P/HAMBURGUESA (CUADROS) X 1KG',
  'PAPEL PARAFINADO MUNDIAL X 1 KG',
  'PAPEL PARAFINADO P/ HAMBURG. 36X40CM X 1KG',
  'PAPEL SATINADO P/FONDO PIZZA BCO X 1KG',
  'PAPEL SATINADO RAVIOLERO X 1KG',
  'PAQ SERVILLETA 33X33 X 50 UN',
  'PAQ SERVILLETAS 18X17 X 50 UNID',
  'PARAGUA - FRUTA X100 UNID.',
  'PINCHES ESPADITAS X1000 UNID.',
  'PINCHES ESPADITASX100UNID',
  'PINCHOS DE MADERA X 10 CM X 50 UNID.',
  'PINCHOS MADERA X 15CM X 50 UNID.',
  'PIROTINES N¼10 X25 UNID.',
  'PIROTINES N¼2 X 25 UNID.',
  'PIROTINES N¼5 X 25 UNID.',
  'PIROTINES N¼7 X 25 UNID.',
  'PLATOS X 17 CM X 50 UNID.',
  'PLATOS X 17CM CELESTES X 50 UNID.',
  'PLATOS X 22 CM X 50 UNID.',
  'PLATOS X 34 "MARMITAS " X 50U',
  'PORTA PANCHOS X 100UNID.',
  'POTE ADEREZO',
  'POTES BISAGRA 270 C.C X50U',
  'POTES BISAGRA 250 C.C WORK REF X50U',
  'POTES BISAGRA 340 C.C X50U',
  'POTES BISAGRA 350 C.C WORK REF X50U',
  'POTES BISAGRA 440 C.C X50U',
  'POTES BISAGRA 500 C.C WORK REF X50U',
  'POTES PLAST. WORK 1/2 C/TAPAS X50U',
  'POTES PLAST. WORK 1/4 C/TAPAS X50U',
  'POTES PLAST. WORK 1/8 C/TAPAS X50U',
  'POTES PLAST. WORK 1KG C/TAPAS CRISTAL X50U',
  'POTES PLAST. X 1/2 C/TAPA NAT. X50U',
  'POTES PLAST. X 1/4 C/TAPA NAT. X50U',
  'POTES PLAST. X 1/8 C/TAPA NAT. X50U',
  'POTES PLASTICOS X 1KG C/TAPA NAT. X50U',
  'PRECINTOS X 100GR',
  'BOLSAS RESIDUOS 45X60X30U.',
  'BOLSAS RESIDUOS 50X70X10U.',
  'ROCIADOR CHICO',
  'ROCIADOR TRASLUCIDO',
  'ROLLO SERVILLETAS X 200 PAÑOS X 8 UNID.',
  'SERVI EXPRES 14X14 PAPEL SEDA "MRC"',
  'SERVILLETAS 18X17COD2000 BCAS.',
  'SERVILLETAS 18X17COD2000 C/GUARDA',
  'SERVILLETAS 24X24X2000UNI.BCAS TISSUE',
  'SERVILLETAS 30X30 BCASX500UNID.',
  'SERVILLETAS 30X30X1000UNID.',
  'SERVILLETAS (33X33) ELEGANTE X 1000UNID.',
  'SORBETES BCOS X 1000 C/ FUNDA',
  'SORBETES COLOR FLUOR X500UNID',
  'SORBETES CON FUNDA X100UNID.',
  'SORBETES NEGROS X500 UNIDADES',
  'SORBETES X100 COLOR',
  'SORBETES X100 NEGRO',
  'FILM STRICH X 50 CM C/MANGO X (4,5KG)',
  'TAPA ALUMINIO F75 X50U',
  'TAPA VASOS TERMICOS X 120 C.C X25U',
  'TAPAS BANDEJA 107 PP COTNYL X50U',
  'TAPAS BANDEJA 102 PP COTNYL X50U',
  'TAPAS BANDEJA 103 PP COTNYL X50U',
  'TAPAS BANDEJA 105 PP COTNYL X50U',
  'TAPAS VASOS TERMICOS X 180 C.C X25U',
  'TAPAS VASOS TERMICOS X 240 C.C X25U',
  'TAPAS VASOS TERMICOS X 300C.C X25U',
  'TENEDORES BCO REF X 50U',
  'TOALLA BOB . 2 X 300 MTS PREMIUN',
  'TOALLA BOB. KING PACK 2X300MTS PREMIUN',
  'TOALLA BOBINAS X 200 X 4 UNID. MTS BCA.',
  'TOALLA INTER. ECO LUXE X1000U',
  'TOALLA INTER. ECO KING PACK X1000U',
  'TORTERA PET T26 ALTA BASE -TAPA',
  'TORTERA PET T26 BAJA BASE -TAPA',
  'TORTERA PET T28 BAJA BASE -TAPA',
  'TORTERA PET T32 ALTA BASE -TAPA',
  'TORTERA PET T32 BAJA BASE -TAPA',
  'TRIPODES X 1KG',
  'VASO 12 OZ C/TAPA RIPPLE KRAF X50U',
  'VASO 8 OZ C/TAPA RIPPLE X50U',
  'VASO TRAGO LARGO COLOR X10U',
  'VASOS DEGUSTACION ACRILICO X50U',
  'VASOS MILANO 370 C.C C/TAPA X50U',
  'VASOS PLASTICOS X 1 LTS X50U',
  'VASOS PLASTICOS X 110C.C X100U',
  'VASOS PLASTICOS X 180 C.C X100U',
  'VASOS PLASTICOS X 220C.C X100U',
  'VASOS PLASTICOS X 300 C.C TRAS X100U',
  'VASOS PLASTICOS X 330C.C X100U',
  'VASOS PLASTICOS X 500C.C X50U',
  'VASOS PLASTICOS X 70 C.C X100U',
  'VASOS PLASTICOS X 800C.C X50U',
  'VASOS PLASTICOS X 800C.C WORK X50U',
  'VASOS TERMICOS X 120 C.C X25U',
  'VASOS TERMICOS X 180 C.C X25U',
  'VASOS TERMICOS X 240 C.C X25U',
  'VASOS TERMICOS X 300 C.C X25U',
  'VASOS TRAGO LARGO TRASLUCIDOS X10U'
);
