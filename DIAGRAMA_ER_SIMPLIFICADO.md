# Diagrama de Entidades y Relaciones (DER) — KINGPACK

## Vista simplificada para no-técnicos

### Los "tablos" principales y cómo se conectan

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          USUARIOS Y SEGURIDAD                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐         ┌──────────────┐      ┌─────────────────┐        │
│  │  USUARIOS   │         │ SUCURSALES   │      │  ROL_PERMISOS   │        │
│  │             │         │              │      │                 │        │
│  │ • Email     │◄────────│ • Nombre     │      │ • Rol           │        │
│  │ • Nombre    │         │ • Dirección  │      │ • Módulo        │        │
│  │ • Rol       │◄────────│ • Tel        │      │ • Acción        │        │
│  │ • Sucursal  │         │ • Punto AFIP │      │ • Permitido?    │        │
│  └─────────────┘         └──────────────┘      └─────────────────┘        │
│        │                       │                                           │
│        │ "trabaja en"          │ "pertenece a"                            │
│        └───────────────────────┴────────────────────────────────────────  │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                       CATÁLOGO DE PRODUCTOS                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐          │
│  │ CATEGORIAS   │    │  ARTICULOS   │    │  ALICUOTAS_IVA     │          │
│  │              │    │              │    │                    │          │
│  │ • Nombre     │◄───│ • Código     │    │ • Porcentaje (21%) │          │
│  │ • Margen %   │    │ • Nombre     │───►│ • Descripción      │          │
│  └──────────────┘    │ • Costo base │    └────────────────────┘          │
│                      │ • Costo flete│                                     │
│                      │ • Precio madre│  ◄── CALCULADO AUTOMÁTICAMENTE   │
│                      │ • Margen %    │   (costo + flete) × (1 + iva%)   │
│                      │ • Stock bajo? │    × (1 + margen%)                │
│                      └──────────────┘                                     │
│                            │                                              │
│                            │ "tiene"                                      │
│                            ▼                                              │
│              ┌────────────────────────────────┐                          │
│              │   LISTA_PRECIO_ITEMS           │                          │
│              │  (4 listas × N artículos)      │                          │
│              │                                │                          │
│              │ • Lista (madre/público/etc)    │                          │
│              │ • Artículo                     │                          │
│              │ • Descuento %                  │                          │
│              │ • Precio final (calculado)     │                          │
│              │                                │                          │
│              │  ◄── ACTUALIZA AUTOMÁTICAMENTE  │                          │
│              │      cuando precio_madre cambia │                          │
│              └────────────────────────────────┘                          │
│                            ▲                                              │
│                            │ "está en"                                    │
│                            │                                              │
│        ┌───────────────────┴───────────────────┐                        │
│        ▼                                       ▼                         │
│  ┌──────────────┐                    ┌──────────────┐                  │
│  │LISTAS_PRECIOS│                    │ARTICULO_TAGS │                  │
│  │              │                    │              │                  │
│  │ • Tipo:      │                    │ • Artículo   │                  │
│  │   - madre    │                    │ • Tag        │                  │
│  │   - pública  │                    │   (ej:"oferta")                 │
│  │   - reventa  │                    └──────────────┘                  │
│  │   - CC       │                                                       │
│  └──────────────┘                                                       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                      CLIENTES Y VENTAS                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                   ┌──────────────┐                      │
│  │  CLIENTES    │                   │   VENTAS     │                      │
│  │              │                   │              │                      │
│  │ • Nombre     │◄──────"compra"────│ • Número     │                      │
│  │ • CUIT       │                   │ • Cliente    │────┐                │
│  │ • Lista asig.│                   │ • Vendedor   │    │                │
│  │ • Lim.crédit.│                   │ • Fecha      │    │                │
│  │ • Saldo      │                   │ • Total      │    │                │
│  └──────────────┘                   │ • Estado     │    │                │
│        ▲                             └──────────────┘    │                │
│        │                                   │             │                │
│        │ "pertenece a"                     │ "contiene"  │                │
│        │                                   ▼             │                │
│        │                          ┌──────────────┐       │                │
│        │                          │ VENTA_ITEMS  │       │                │
│        │                          │              │       │                │
│        │                          │ • Artículo   │       │                │
│        │                          │ • Cantidad   │       │                │
│        │                          │ • Precio lista │      │                │
│        │                          │ • Descuento %│       │                │
│        │                          │ • IVA monto  │       │                │
│        │                          └──────────────┘       │                │
│        │                                   │             │                │
│        └───────────────────────────────────┴─────────────┘                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                 │
│  │  CUENTAS_CORRIENTES_CLIENTE                          │                 │
│  │  (El libro mayor: cuánto debe cada cliente)          │                 │
│  │                                                      │                 │
│  │  • Cliente                                           │                 │
│  │  • Debe (lo que facturamos)                          │                 │
│  │  • Haber (lo que pagó)                               │                 │
│  │  • Saldo actual = Debe - Haber                       │                 │
│  │  • Fecha                                             │                 │
│  └──────────────────────────────────────────────────────┘                 │
│        ▲ "refleja"                                                        │
│        │ (se actualiza cada vez que hay una venta o pago)               │
│        │                                                                  │
│  ┌─────┴──────────────────────────────────────────────────────────────┐  │
│  │ CORRECCIONES_SALDO_CLIENTE                                         │  │
│  │ (Si hubo error: "le cobramos $100 de más, corregimos")            │  │
│  │                                                                    │  │
│  │ • Cliente                                                          │  │
│  │ • Monto (puede ser negativo si devolvemos dinero)                │  │
│  │ • Motivo (ej: "Error de facturación — se devuelven $50")        │  │
│  │ • Quién hizo la corrección                                        │  │
│  │ • Fecha                                                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                    FACTURACIÓN (AFIP) Y DINERO                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                          │
│  │ FACTURACIONES│  ◄── EMITIDA DESDE UNA VENTA                            │
│  │              │                                                          │
│  │ • Venta #    │─────► Vinculada a una venta específica                 │
│  │ • CAE        │  (Código de Autorización electrónica de AFIP)          │
│  │ • Punto venta│  (Cada sucursal tiene el suyo)                          │
│  │ • Número fac.│  (Numeración separada por sucursal)                     │
│  │ • Estado     │  (Aprobada / Rechazada / Pendiente)                    │
│  │ • Respuesta  │  (Lo que respondió AFIP)                                │
│  │   AFIP       │                                                          │
│  │ • QR         │  (Para que el cliente verifique)                        │
│  └──────────────┘                                                          │
│        │                                                                    │
│        │ "genera"                                                          │
│        ▼                                                                    │
│  ┌──────────────────────────────────┐                                     │
│  │  NOTAS_CREDITO                   │                                     │
│  │  (Devoluciones / Ajustes)        │                                     │
│  │                                  │                                     │
│  │  • Factura original              │                                     │
│  │  • Motivo (ej: "Producto dañado")│                                     │
│  │  • Monto a devolver              │                                     │
│  │  • CAE de la nota                │                                     │
│  └──────────────────────────────────┘                                     │
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐    ┌────────────────┐             │
│  │   CAJAS      │     │ MOVIMIENTOS  │    │    GASTOS      │             │
│  │              │     │     CAJA     │    │                │             │
│  │ • Sucursal   │────►│              │    │ • Descripción  │             │
│  │ • Fecha      │     │ • Tipo:      │    │ • Monto        │             │
│  │   apertura   │     │   - venta    │    │ • Subrubro     │             │
│  │ • Saldo      │     │   - pago     │    │ • Medio pago   │             │
│  │   inicial    │     │   - retiro   │    │ • Es fijo?     │             │
│  │ • Saldo final│     │ • Monto      │    │ • Fecha        │             │
│  │ • Diferencia │     │ • Concepto   │    └────────────────┘             │
│  │   (real vs   │     │ • Origen     │                                    │
│  │    sistema)  │     └──────────────┘                                    │
│  └──────────────┘                                                          │
│                                                                              │
│  ┌──────────────┐                                                          │
│  │ MEDIOS_PAGO  │                                                          │
│  │              │                                                          │
│  │ • Efectivo   │  (tipo de pago disponible)                              │
│  │ • Transf.    │                                                          │
│  │ • Tarjeta    │                                                          │
│  │ • Cheque     │                                                          │
│  │ • MercadoPago│                                                          │
│  └──────────────┘                                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                        STOCK Y COMPRAS                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐        ┌────────────────┐      │
│  │   STOCK      │         │PEDIDOS_COMPRA│        │   PROVEEDORES  │      │
│  │              │         │              │        │                │      │
│  │ • Artículo   │◄────────│ • Proveedor  │───────►│ • Razón Social │      │
│  │ • Sucursal   │         │ • Sucursal   │        │ • CUIT         │      │
│  │ • Cantidad   │         │ • Cantidad   │        │ • Cond. pago   │      │
│  │   (real)     │         │   total      │        └────────────────┘      │
│  │ • Mínimo     │         │ • Estado     │                                │
│  │             │         │ • Flete      │                                │
│  └──────────────┘         │   total      │                                │
│        ▲                  └──────────────┘                                │
│        │ "se actualiza"          │                                        │
│        │ cuando se vende         │ "contiene"                            │
│        │ o se recibe compra      ▼                                        │
│                         ┌──────────────┐                                  │
│                         │ PEDIDO_ITEMS │                                  │
│                         │              │                                  │
│                         │ • Artículo   │                                  │
│                         │ • Cantidad   │                                  │
│                         │ • Precio     │                                  │
│                         │   compra     │                                  │
│                         │ • Flete      │                                  │
│                         │   asignado   │                                  │
│                         └──────────────┘                                  │
│                                                                              │
│  ┌─────────────────────────────┐                                          │
│  │   AJUSTES_STOCK             │                                          │
│  │   (Inventario o correcciones)│                                          │
│  │                             │                                          │
│  │ • Artículo                  │                                          │
│  │ • Cantidad delta (+ o -)    │                                          │
│  │ • Motivo (ej: "pérdida")    │                                          │
│  │ • Quién lo hizo             │                                          │
│  │ • Fecha                     │                                          │
│  └─────────────────────────────┘                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Cómo se comunican las tablas (relaciones)

### Símbolo de relación: **─►**

- **1 a muchos**: Un cliente TIENE muchas ventas
- **Muchos a muchos**: Un artículo ESTÁ EN muchas listas, una lista TIENE muchos artículos

### Flujo de información (ejemplo real):

```
Usuario "Franco" (vendedor)
  │
  ├─► Ingresa a sucursal "Laprida"
  │
  ├─► Busca cliente "Distribuidora XYZ"
  │     └─► Sistema mira: XYZ está asignada a lista "Clientes CC"
  │
  ├─► Franco selecciona artículo "Bolsa de plástico"
  │     └─► Sistema busca: ¿bolsa en lista CC?
  │           └─► Encuentra en LISTA_PRECIO_ITEMS
  │               Precio: $15,92 (descuento aplicado automáticamente)
  │
  ├─► Franco agrega 100 bolsas a la venta
  │     └─► VENTA_ITEMS registra: 100 × $15,92 = $1.592
  │
  ├─► Franco confirma venta
  │     └─► Sistema automáticamente:
  │         1. Crea registro en VENTAS
  │         2. Registra items en VENTA_ITEMS
  │         3. Actualiza CUENTAS_CORRIENTES_CLIENTE
  │            (XYZ ahora debe $1.592 más)
  │         4. Reduce STOCK en Laprida (100 bolsas menos)
  │         5. Registra en AUDIT_LOG (trazabilidad)
  │
  ├─► Admin luego emite factura
  │     └─► Sistema:
  │         1. Pide CAE a AFIP
  │         2. Si aprobado: crea FACTURACIONES con CAE
  │         3. Genera QR
  │         4. Cliente ve factura con número único y validable
```

---

## Tablas especiales (el "cerebro" del sistema)

### AUDIT_LOG: El registro de TODO

Toda tabla importante tiene un trigger que registra aquí:
- Quién hizo el cambio (usuario_id)
- Qué cambió (datos_antes vs datos_despues)
- Cuándo (timestamp)
- Qué tabla, qué registro

**Por qué**: Si hay disputa ("¿cambió el precio sin autorizarme?"), tenés prueba.

### _MIGRATIONS: Control de versiones de la BD

Cada vez que creamos una nueva tabla o agregamos una columna, lo registramos aquí. Si hay que hacer rollback, tenemos historial.

---

## Resumen visual: Las 4 áreas

```
        ┌─────────────────────────────────────┐
        │   USUARIOS Y SEGURIDAD              │
        │   (Quién entra, qué puede hacer)    │
        └────────────┬────────────────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │   CATÁLOGO DE PRODUCTOS             │
        │   (Precios y listas)                │
        │   ◄── Sistema automático ──►        │
        └────────────┬────────────────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │   CLIENTES Y VENTAS                 │
        │   (Quién compra, cuánto debe)       │
        └────────────┬────────────────────────┘
                     │
        ┌────────────▼────────────────────────┐
        │   FACTURACIÓN Y DINERO              │
        │   (AFIP, caja, gastos)              │
        └─────────────────────────────────────┘
```

---

## Preguntas que el equipo podría hacer

### "¿Y si vendo un producto que no existe en el catálogo?"
No podes. Cuando Franco intenta agregar un artículo a la venta, el sistema valida que exista. Si no → error. Protección automática.

### "¿Cómo sé cuánto stock tengo en cada sucursal?"
Hay una **vista** (tabla virtual) que suma el stock de cada artículo en cada sucursal. Un click → tenés toda la info en tiempo real.

### "¿Qué pasa si hay un descuadre: stock real ≠ stock en BD?"
Se registra en AJUSTES_STOCK con motivo "Inventario". La BD se corrige. El cambio queda en AUDIT_LOG.

### "¿Puedo ver la rentabilidad de este mes?"
Sí. Hay otra vista (vw_resultado_mensual) que calcula:
- Total de ventas
- Total de costo de bienes vendidos
- Total de gastos
- **Utilidad neta**

Todo por sucursal, por mes. Un click.

---

**La BD es el corazón. Si está bien diseñada, todo funciona. Si está mal, el software más bonito del mundo no salva el negocio.**
