# La Base de Datos de KINGPACK — Explicación para el equipo

## ¿Qué es una base de datos relacional?

Imaginá que King Pack usa un **mega-Excel inteligente y automático**. 

Un Excel normal tiene hojas separadas (artículos, clientes, ventas) y si vos cambias algo en artículos, tenés que buscar manualmente todas las ventas de ese artículo para actualizarlas. Es caótico y propenso a errores.

**Una base de datos relacional** es ese mismo Excel, pero:
- Las hojas están **conectadas automáticamente** (cuando cambias un artículo, todas sus ventas se actualizan solas)
- Está **guardada en un servidor seguro**, no en un archivo que se puede perder
- Tiene **permisos y roles** (el cajero no puede ver precios, el vendedor no puede anular ventas)
- Detecta **inconsistencias automáticamente** (no te deja vender un producto que no existe)
- Mantiene un **registro de todo lo que pasó** (quién hizo qué, cuándo)

## Las 4 "zonas" de la BD de KINGPACK

Organizamos todo en 4 áreas temáticas para que sea fácil de entender:

### 1️⃣ USUARIOS Y SEGURIDAD
**¿Quién usa el sistema?**

- **Usuarios**: Admin, Supervisores, Cajeros, Vendedores
- **Sucursales**: Laprida y Huaico (y futuras)
- **Permisos**: Qué puede hacer cada rol (vendedor NO puede bajar precios, solo admin)

💡 *Ejemplo*: El vendedor Franco ingresa con su usuario. El sistema sabe que Franco es vendedor → solo ve los precios de la lista de venta que el admin le asignó → no puede hacer descuentos sin autorización.

---

### 2️⃣ CATÁLOGO DE PRODUCTOS
**¿Qué vendés y a qué precio?**

Aquí está el **corazón del sistema de precios nuevo que pediste**:

#### El viaje de un producto hasta el cliente:

```
[Costo del producto] + [Flete] + [IVA] + [Margen] = PRECIO MADRE
                                                          ↓
                            (El admin define el precio de referencia central)
                                                          ↓
                    ┌─────────────────────────────────────┼─────────────────────────────────────┐
                    ↓                                       ↓                                     ↓
            LISTA REVENDEDOR              LISTA PRECIO PÚBLICO                   LISTA CLIENTES C.C.
         (muy competitiva,                 (mostrador,                        (clientes con cuenta
          para reventa)                  descuento mayor)                    corriente, descuento menor)
                    ↓                                       ↓                                     ↓
              $ más barato                            $ medio                               $ más caro
```

**Lo importante:** Cuando el admin cambia el precio madre (porque bajó el flete o quiere más margen), **todas las listas se actualizan solas automáticamente**.

#### Las tablas del catálogo:

| Tabla | Qué guarda | Por qué es importante |
|---|---|---|
| **articulos** | Código, nombre, costo_base, costo_flete, precio_madre, margen | Fuente central de verdad. Si el precio madre está mal, TODOS los clientes pagan mal |
| **listas_precios** | Nombre, tipo, descuento base | Cuántas "vitrinas" distintas tenemos (4: madre, pública, reventa, CC) |
| **lista_precio_items** | Artículo + Lista + precio final | La relación: cada artículo en cada lista tiene su precio |
| **categorias** | Nombre, margen default | Si no defines margen en un artículo, hereda el de la categoría |

💡 *Ejemplo real*: 
- Admin carga un producto: "Bolsa de plástico descartable"
  - Costo: $10 ARS
  - Flete: $1 ARS (parte proporcional)
  - IVA: 21%
  - Margen: 35%
  - **Precio Madre: $16,24 ARS** (calculado automáticamente por la BD)
- Sistema genera automáticamente:
  - Precio Reventa: $16,24 × (1 - 10% descuento) = $14,62
  - Precio Público: $16,24 × (1 - 5% descuento) = $15,43
  - Precio CC: $16,24 × (1 - 2% descuento) = $15,92

Si después el cliente dice "la bolsa bajó a $9 de costo", admin solo cambia costo_base de $10 → $9. **Automáticamente** todos los precios en todas las listas se recalculan.

---

### 3️⃣ CLIENTES Y VENTAS
**¿A quién le vendés y qué le vendiste?**

#### El flujo de una venta:

```
Cliente → Asignado a una lista (ej: "Clientes CC")
           ↓
       Vendedor crea venta
           ↓
       Selecciona productos → Sistema automáticamente saca el precio de LA LISTA
           ↓
       Venta se confirma → Saldo del cliente se actualiza automáticamente
           ↓
       Se factura → CAE se emite automáticamente (si está todo bien)
           ↓
       Cliente paga → Sistema registra cuánto debe todavía
```

#### Las tablas clave:

| Tabla | Qué guarda | Por qué importa |
|---|---|---|
| **clientes** | Nombre, CUIT, teléfono, lista_asignada, límite crédito, saldo | Cada cliente sabe qué precios ve y cuánto puede comprar a crédito |
| **ventas** | Número, cliente, vendedor, lista_usada, total | Registro de cada venta. Número único por sucursal (ej: venta #1001 de Laprida) |
| **venta_items** | Artículo, cantidad, precio_lista, descuento | Detalles: qué se vendió, cuánto, a qué precio, si hubo descuento |
| **cuentas_corrientes_cliente** | Debe, haber, saldo | El libro mayor: cuánto facturó al cliente vs cuánto pagó |
| **correcciones_saldo_cliente** | Monto, motivo | Si hubo error de cálculo, se registra la corrección (legal para AFIP) |

💡 *Ejemplo*: 
- Cliente "Distribuidora XYZ" es responsable inscripto → está en lista "Clientes CC"
- Tiene límite de crédito de $50.000
- Vendedor Franco le vende 100 bolsas
  - Sistema agarra precio de la lista CC (no otro)
  - Calcula total: 100 × $15,92 = $1.592
  - Registra la venta
  - Saldo de XYZ: $1.592 debe
- Si XYZ pagó $1.000 antes: Saldo actual = $1.592 - $1.000 = $592 debe

---

### 4️⃣ FACTURACIÓN (AFIP) Y FINANZAS
**¿Cómo se emiten facturas y se rastrea el dinero?**

| Tabla | Qué guarda |
|---|---|
| **facturaciones** | CAE, número de factura, punto de venta, estado (aprobada/rechazada), respuesta de AFIP |
| **notas_credito** | Devoluciones o ajustes (el cliente devolvió 10 bolsas malas) |
| **cajas** | Cada caja abierta en cada sucursal, cuánto entró, cuánto debe quedar |
| **movimientos_caja** | Cada transacción: venta registrada, retiro, pago recibido, etc |
| **gastos** | Servicios, arriendo, fletes, sueldos (todo lo que sale de la caja) |

💡 *Por qué importa*: 
- AFIP exige que cada factura tenga un CAE (código de autorización)
- Si la BD no registra bien, se pierden ventas en auditorías
- Con las correcciones guardadas, podés demostrar ante AFIP: "El cliente X debía $10K, hicimos una corrección de -$5K porque fue error nuestro" (legal, trazable)

---

## EL SISTEMA DE TRIGGERS: El "cerebro automático"

Un **trigger** es una regla automática. Si pasa X → haz Y.

### Ejemplos clave en KINGPACK:

| Trigger | Qué hace | Por qué evita errores |
|---|---|---|
| **Precio Madre → Listas** | Si cambias precio_madre, actualiza automáticamente todos los precios derivados | No hay riesgo de que un precios quede viejo mientras otro se actualiza |
| **Venta → Stock** | Si vendes 10 unidades, el stock de esas 10 unidades baja automáticamente | No overselling (no vendés lo que no tenés) |
| **Facturación → Saldo Cliente** | Si confirmas una factura, el saldo del cliente se actualiza | El cliente no puede pensar que pagó si todavía debe |
| **Auditoría** | Cada cambio se registra: quién, cuándo, qué cambió | Legal para AFIP. Si hay disputa: "Mira, el 5/5 a las 3:15pm Franco cambió el precio de bolsa de $15 a $20" |

---

## ¿Por qué esto es importante para MaccioTEC?

### Sin una BD bien diseñada:
❌ El cliente sigue usando Excel → errores manuales, lentitud, imposible escalar  
❌ Precios inconsistentes (vendedor A vende a $15, vendedor B a $18)  
❌ Stock incorrecto (crees que tenés 100 bolsas, vendes 150)  
❌ AFIP audita y encontramos que faltan 50 facturas  
❌ Cliente quiere saber "¿cuánto me debe Juan?"  → tardás 2 horas buscando en Excel  

### Con una BD bien diseñada:
✅ Un click: ves exactamente cuánto debe cada cliente  
✅ Admin define precios una vez → todos los vendedores usan lo correcto automáticamente  
✅ Stock real + alertas si va bajo  
✅ AFIP audita → tenés registros perfectos + cambios con trazabilidad  
✅ La app es **rápida, confiable, escalable** (podés agregar sucursales sin reescribir nada)  

---

## Las 4 sucursales en el futuro

Ahora tiene 2: Laprida y Huaico.

La BD está diseñada para agregar más **sin cambios en la estructura**:
- Cada sucursal tiene su propio punto de venta AFIP (numeración de facturas separada)
- Cada sucursal tiene su propio stock (bolsas en Laprida ≠ bolsas en Huaico)
- Los usuarios pueden trabajar en varias sucursales o solo una
- Un reporte puede ser "ventas mes de Laprida" o "ventas mes de todas"

---

## Resumen en 30 segundos

**La BD es como el corazón del negocio:**
- **Catálogo**: "¿Cuánto cuestan mis productos en cada modalidad de venta?"
- **Clientes**: "¿Quién me debe? ¿Quién tiene descuento especial?"
- **Ventas**: "¿Qué vendí hoy, a quién, a qué precio?"
- **Dinero**: "¿Cuánto entró en caja? ¿Cuánto se fue?"
- **AFIP**: "Tengo un registro perfecto para auditorías"

**Lo automático**: cambios en precios, actualizaciones de stock, cálculo de saldos. El vendedor y el cajero solo hacen su trabajo; la BD se encarga del resto.

**El beneficio para MaccioTEC**: cuando terminamos este desarrollo en 2 meses, King Pack va a tener un sistema que **escala, es confiable y cero errores manuales**. Eso es lo que se vende.

---

## Preguntas que probablemente tengas

### "¿Y si se corta la luz?"
La BD está en un servidor (VPS) con backups automáticos cada noche. Incluso si se cae, recuperamos la última versión. El Excel legacy no tenía eso.

### "¿Qué pasa si el vendedor intenta hacer algo que no puede?"
El sistema tiene **permisos por rol**. Si Franco es vendedor y lo intenta, la app dice "no autorizado" antes de que pase algo. Sin excepciones.

### "¿Y si cometemos un error al cargar los datos del Excel viejo?"
Tenemos un **proceso de validación** (el ETL): antes de darle la BD al cliente, comparamos "Excel vs BD" — si falta una venta o un cliente, lo detectamos.

### "¿Puedo saber exactamente qué cambió y quién lo hizo?"
Sí. La tabla `audit_log` registra TODO: "el 5/5 a las 15:33, usuario 'admin', cambió el precio de artículo 'bolsa' de $15 a $20". Legal y auditable.

---

**Fin de la explicación.** Si algo no quedó claro, pregunten. Esta base de datos es **el diferencial** de por qué MaccioTEC cobra $1.500 por un sistema web hecho a medida y no $50.
