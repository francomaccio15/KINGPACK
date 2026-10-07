# Plan: Venta por unidad (bulto o suelto)

> Revisado el 2026-10-02. Versión publicada: https://claude.ai/artifact/GEYPaH67wtQcSBpEoDmcap
> Cotización enviada a King Pack: USD 300, pago único. **Se implementa una vez acreditado el pago.**

## Problema
Hoy todo el catálogo está cargado como bulto: el artículo *es* el paquete de 100. Por eso no se puede vender una unidad suelta.

## Decisión de fondo: una sola unidad de stock
- En la **base de datos** el stock se guarda siempre en la unidad más chica (la unidad suelta).
- En **pantalla** nunca se muestra el número crudo: se muestran los bultos completos + las sueltas. Por ejemplo, 720 con bulto ×100 → **«7 bultos + 20 u.»**. Usar un único helper de formato en todas las pantallas.
- **NO** cargar dos artículos separados («Vaso x100» y «Vaso suelto»): quedan dos stocks del mismo producto y se descuadran cuando se abre un bulto.

## Comportamiento (igual en Laprida y en Huaico)
| Dónde | Qué cambia |
|---|---|
| Artículos (admin) | El admin marca qué artículos se venden por unidad, define las unidades por bulto y carga el **precio por unidad** (precio propio, no precio_bulto ÷ factor). |
| Ventas y presupuestos | Los artículos marcados tienen un selector **Bulto / Unidad**. Bulto toma el precio del bulto y Unidad toma el precio por unidad. Los no marcados se venden igual que hoy. |
| Lista de artículos | El stock se ve como «7 bultos + 20 u.». En los marcados, el ajuste de stock se puede cargar en bultos o en unidades. |
| Compras | **Siempre por bulto, nunca por unidad.** Al ingresar la mercadería se multiplica por el factor. |
| Traspasos, devoluciones, NC | Respetan la unidad del movimiento original. Una devolución de 20 sueltas devuelve 20, no 20 bultos. |

Las dos sucursales venden por unidad, porque así es más simple: no hay reglas por sucursal.

## Cambios en la base
- `articulos`: `vende_por_unidad`, `unidades_por_bulto` (1 = sin bulto) y `precio_unidad`.
- `venta_items`: `unidad_venta` y `factor` **congelados** en la venta (mismo patrón que el precio madre congelado, migraciones 050/051).
- La PK de `venta_items` es `(venta_id, articulo_id)`. Hay que cambiarla para poder vender el mismo artículo por bulto y suelto en un mismo ticket.
- El stock se escribe en **18 lugares de 7 módulos**: ventas (5), traspasos (3), pedidos-compra (3), devoluciones (2), notas-credito (2), articulos/ajustes (2) y licitaciones (1). **Todos** tienen que multiplicar por el factor. Si se olvida uno, el stock se descuadra sin que nadie lo note.
- Pendiente de definir: si el descuento de la lista de precios del cliente (`descuento_base_pct`) también se aplica al precio por unidad.

## Factores (unidades por bulto)
- Ya están en el nombre del artículo en 99 de ~102 casos: `BANDEJA CARTON GRIS N1 X 100UNID.`
- Se pre-cargan parseando el nombre y **los verifica una persona**. Ojo: en `BANDEJA TERGOPOR 615X50UNID.` el factor es 50 y no 615, y hay erratas como `618X50NUD.`
- El factor no verificado queda en 1 y el artículo queda sin marcar.
- Para generar la planilla hace falta un **export CSV en Artículos** (la lectura de producción desde el entorno de desarrollo está bloqueada).

Lista inicial sugerida (~92-100 artículos): BANDEJAS ALUMINIO (12), BANDEJAS Y CAJAS CARTON (37), BANDEJAS PLASTICAS VARIAS (18), BANDEJAS C/TAPAS MICRO (a revisar), TERGOPOL (15) y VASOS solo plásticos (10 seguros + 7 a decidir: RIPPLE KRAF y DEGUSTACION ACRILICO).
Afuera: las gomillas (`GOMILLAS REF X 1KG`, que se venden por kilo).

## Orden de ejecución
1. **Planilla de factores** (depósito): export CSV con el factor pre-cargado → verificación.
2. **Precios por unidad** (admin).
3. **Migración vacía**: campos nuevos con todo en factor 1. El sistema se comporta igual que hoy.
4. **Conversión del stock** de los artículos marcados, solo en la base y en un solo movimiento, junto con la pantalla «bultos + sueltas».
5. **Habilitar Bulto / Unidad** en ventas, en las dos sucursales a la vez, de noche y con un conteo físico del día anterior.

## Invariante
El **valor total del inventario no puede cambiar** con la conversión: 12 bultos a $10.000 = $120.000 = 1.200 u. ÷ 100 × $10.000. Si no cuadra al peso, hay un factor mal cargado y no se avanza.

## No hacer
- Dos artículos separados para el bulto y la unidad.
- Permitir comprar por unidad.
- Mezclar esto con un cambio de precios.
- Vender fracciones de bulto (0,01).
- Adivinar un factor.
- Mostrar el número crudo de la base.
