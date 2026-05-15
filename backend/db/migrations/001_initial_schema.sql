-- =============================================================================
-- KINGPACK — Schema inicial
-- Migración: 001_initial_schema.sql
-- =============================================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función genérica para updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DOMINIO: AUTH / RBAC
-- =============================================================================

CREATE TABLE sucursales (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(100) NOT NULL UNIQUE,
  direccion           TEXT,
  telefono            VARCHAR(30),
  cuit_sucursal       VARCHAR(13),
  punto_venta_afip    INT,              -- Confirmado: cada sucursal tiene su propio PV en ARCA
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_sucursales_updated_at
  BEFORE UPDATE ON sucursales
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE usuarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password_hash         VARCHAR(255) NOT NULL,
  nombre                VARCHAR(150) NOT NULL,
  telefono              VARCHAR(30),
  rol                   VARCHAR(20) NOT NULL CHECK (rol IN ('administrador','supervisor','cajero','vendedor')),
  sucursal_default_id   UUID REFERENCES sucursales(id),
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  legacy_email          VARCHAR(255)
);

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_usuarios_email ON usuarios(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

CREATE TABLE usuario_sucursales (
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sucursal_id   UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, sucursal_id)
);

CREATE TABLE rol_permisos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol         VARCHAR(20) NOT NULL CHECK (rol IN ('administrador','supervisor','cajero','vendedor')),
  modulo      VARCHAR(50) NOT NULL,
  accion      VARCHAR(80) NOT NULL,
  permitido   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (rol, modulo, accion)
);

-- =============================================================================
-- DOMINIO: CATÁLOGOS AFIP
-- =============================================================================

CREATE TABLE cond_iva (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_afip   INT NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL
);

CREATE TABLE tipos_comprobante (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_afip   INT NOT NULL UNIQUE,
  letra         CHAR(1),
  descripcion   VARCHAR(100) NOT NULL
);

CREATE TABLE alicuotas_iva (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_afip   INT NOT NULL,
  porcentaje    NUMERIC(5,2) NOT NULL,
  descripcion   VARCHAR(50),
  UNIQUE (codigo_afip)
);

-- =============================================================================
-- DOMINIO: CATÁLOGO COMERCIAL
-- =============================================================================

CREATE TABLE categorias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(100) NOT NULL UNIQUE,
  margen_default  NUMERIC(5,2) NOT NULL DEFAULT 0,  -- porcentaje, ej: 30 = 30%
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_categorias_updated_at
  BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE medios_pago (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           VARCHAR(80) NOT NULL UNIQUE,
  requiere_cuenta  BOOLEAN NOT NULL DEFAULT FALSE,
  activo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE subrubro_gastos (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  VARCHAR(100) NOT NULL UNIQUE,
  rubro   VARCHAR(80) NOT NULL
);

CREATE TABLE proveedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social  VARCHAR(200) NOT NULL,
  cuit          VARCHAR(13),
  telefono      VARCHAR(30),
  email         VARCHAR(255),
  direccion     TEXT,
  cond_pago     VARCHAR(100),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_id     TEXT
);

CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Listas de precios: 4 listas + posibles especiales
CREATE TABLE listas_precios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              VARCHAR(100) NOT NULL UNIQUE,
  tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('madre','publica','revendedor','cuenta_corriente','especial')),
  descripcion         TEXT,
  descuento_base_pct  NUMERIC(5,2),   -- descuento % global sobre precio_madre (puede ser NULL si se define por item)
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Artículos: costo separado del flete; precio_madre calculado por trigger
CREATE TABLE articulos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            VARCHAR(80) NOT NULL UNIQUE,
  nombre            VARCHAR(200) NOT NULL,
  categoria_id      UUID NOT NULL REFERENCES categorias(id),
  alicuota_iva_id   UUID NOT NULL REFERENCES alicuotas_iva(id),
  costo_base        NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_flete       NUMERIC(14,2) NOT NULL DEFAULT 0,  -- flete proporcional al artículo
  margen_aplicado   NUMERIC(5,2),                       -- NULL = usa margen_default de categoría
  precio_madre      NUMERIC(14,2) NOT NULL DEFAULT 0,  -- mantenido por trigger
  imagen_url        TEXT,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  legacy_id         TEXT
);

CREATE TRIGGER trg_articulos_updated_at
  BEFORE UPDATE ON articulos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_articulos_codigo ON articulos(codigo) WHERE deleted_at IS NULL;
CREATE INDEX idx_articulos_categoria ON articulos(categoria_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_articulos_activo ON articulos(activo) WHERE deleted_at IS NULL;

-- Items de lista de precios (un registro por artículo × lista)
-- precio efectivo = precio_override si metodo='precio_fijo'
--                 = precio_madre * (1 - descuento_pct/100) si metodo='descuento_sobre_madre'
CREATE TABLE lista_precio_items (
  lista_id          UUID NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
  articulo_id       UUID NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
  metodo            VARCHAR(25) NOT NULL CHECK (metodo IN ('descuento_sobre_madre','precio_fijo')),
  descuento_pct     NUMERIC(5,2),        -- usado cuando metodo='descuento_sobre_madre'
  precio_override   NUMERIC(14,2),       -- usado cuando metodo='precio_fijo'
  precio_efectivo   NUMERIC(14,2) NOT NULL DEFAULT 0,  -- denormalizado, mantenido por trigger
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lista_id, articulo_id)
);

CREATE INDEX idx_lista_precio_items_articulo ON lista_precio_items(articulo_id);

-- Tags de artículos: permite aplicar configuraciones de precio a grupos
CREATE TABLE articulo_tags (
  articulo_id   UUID NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
  tag           VARCHAR(80) NOT NULL,
  PRIMARY KEY (articulo_id, tag)
);

CREATE INDEX idx_articulo_tags_tag ON articulo_tags(tag);

-- =============================================================================
-- DOMINIO: CLIENTES
-- =============================================================================

CREATE TABLE clientes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social          VARCHAR(200) NOT NULL,
  cuit                  VARCHAR(13),
  cond_iva_id           UUID NOT NULL REFERENCES cond_iva(id),
  telefono              VARCHAR(50),
  direccion             TEXT,
  sucursal_default_id   UUID REFERENCES sucursales(id),
  lista_precio_id       UUID REFERENCES listas_precios(id),  -- lista asignada por defecto
  limite_credito        NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento_adicional   NUMERIC(5,2) NOT NULL DEFAULT 0,    -- descuento extra autorizado por admin
  saldo_inicial         NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_saldo_0         DATE,
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  legacy_id             TEXT,
  legacy_sucursal_excel TEXT,   -- valor original del Excel (ej: 'Matias')
  UNIQUE (cuit) DEFERRABLE INITIALLY DEFERRED  -- NULL permitido; se maneja con partial unique en app
);

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_clientes_cuit ON clientes(cuit) WHERE cuit IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_clientes_sucursal ON clientes(sucursal_default_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clientes_lista ON clientes(lista_precio_id);

CREATE TABLE correcciones_saldo_cliente (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id),
  monto       NUMERIC(14,2) NOT NULL,
  motivo      TEXT NOT NULL,
  usuario_id  UUID REFERENCES usuarios(id),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correcciones_cliente ON correcciones_saldo_cliente(cliente_id);

CREATE TABLE cuentas_corrientes_cliente (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES clientes(id),
  debe          NUMERIC(14,2) NOT NULL DEFAULT 0,
  haber         NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo         NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origen_tipo   VARCHAR(50),   -- 'venta', 'facturacion', 'pago', 'correccion'
  origen_id     UUID
);

CREATE INDEX idx_cc_cliente ON cuentas_corrientes_cliente(cliente_id, fecha DESC);

-- =============================================================================
-- DOMINIO: STOCK
-- =============================================================================

CREATE TABLE stock (
  articulo_id         UUID NOT NULL REFERENCES articulos(id),
  sucursal_id         UUID NOT NULL REFERENCES sucursales(id),
  cantidad            NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_minimo        NUMERIC(12,3) NOT NULL DEFAULT 0,
  ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (articulo_id, sucursal_id)
);

CREATE INDEX idx_stock_sucursal ON stock(sucursal_id);
CREATE INDEX idx_stock_bajo ON stock(articulo_id, sucursal_id)
  WHERE cantidad <= stock_minimo;

CREATE TABLE ajustes_stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  articulo_id     UUID NOT NULL REFERENCES articulos(id),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id),
  cantidad_delta  NUMERIC(12,3) NOT NULL,
  motivo          TEXT,
  usuario_id      UUID REFERENCES usuarios(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ajustes_stock_articulo ON ajustes_stock(articulo_id, fecha DESC);

CREATE TABLE traspasos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_origen_id    UUID NOT NULL REFERENCES sucursales(id),
  sucursal_destino_id   UUID NOT NULL REFERENCES sucursales(id),
  usuario_id            UUID REFERENCES usuarios(id),
  estado                VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente','en_transito','recibido')),
  fecha_envio           TIMESTAMPTZ,
  fecha_recepcion       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sucursal_origen_id <> sucursal_destino_id)
);

CREATE TABLE traspaso_items (
  traspaso_id   UUID NOT NULL REFERENCES traspasos(id) ON DELETE CASCADE,
  articulo_id   UUID NOT NULL REFERENCES articulos(id),
  cantidad      NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  PRIMARY KEY (traspaso_id, articulo_id)
);

-- =============================================================================
-- DOMINIO: COMPRAS
-- =============================================================================

CREATE TABLE pedidos_compra (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id          UUID NOT NULL REFERENCES proveedores(id),
  sucursal_id           UUID NOT NULL REFERENCES sucursales(id),
  usuario_id            UUID REFERENCES usuarios(id),
  numero_factura_prov   VARCHAR(50),
  costo_flete_total     NUMERIC(14,2) NOT NULL DEFAULT 0,  -- flete total del pedido a distribuir
  estado                VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente','recibido_parcial','recibido','cancelado')),
  fecha_pedido          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_recepcion       TIMESTAMPTZ,
  monto_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_id             TEXT
);

CREATE TRIGGER trg_pedidos_compra_updated_at
  BEFORE UPDATE ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_pedidos_proveedor ON pedidos_compra(proveedor_id, fecha_pedido DESC);

CREATE TABLE pedido_items (
  pedido_id             UUID NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  articulo_id           UUID NOT NULL REFERENCES articulos(id),
  cantidad              NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_compra         NUMERIC(14,2) NOT NULL DEFAULT 0,
  costo_flete_asignado  NUMERIC(14,2) NOT NULL DEFAULT 0,  -- porción del flete asignada a este ítem
  PRIMARY KEY (pedido_id, articulo_id)
);

CREATE TABLE pagos_proveedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id    UUID NOT NULL REFERENCES proveedores(id),
  monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  medio_pago_id   UUID NOT NULL REFERENCES medios_pago(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observaciones   TEXT,
  usuario_id      UUID REFERENCES usuarios(id)
);

CREATE INDEX idx_pagos_prov_proveedor ON pagos_proveedores(proveedor_id, fecha DESC);

-- =============================================================================
-- DOMINIO: VENTAS
-- =============================================================================

CREATE TABLE ventas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          INT NOT NULL,
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id),
  cliente_id      UUID REFERENCES clientes(id),
  vendedor_id     UUID REFERENCES usuarios(id),
  lista_precio_id UUID REFERENCES listas_precios(id),  -- lista usada en esta venta
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  descuento_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado          VARCHAR(20) NOT NULL DEFAULT 'confirmada'
                    CHECK (estado IN ('preventa','confirmada','facturada','anulada')),
  observaciones   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  legacy_id       TEXT,
  UNIQUE (sucursal_id, numero)
);

CREATE TRIGGER trg_ventas_updated_at
  BEFORE UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_ventas_fecha ON ventas(sucursal_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_ventas_cliente ON ventas(cliente_id, fecha DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_ventas_estado ON ventas(estado) WHERE deleted_at IS NULL;
CREATE INDEX idx_ventas_vendedor ON ventas(vendedor_id, fecha DESC) WHERE deleted_at IS NULL;

CREATE TABLE venta_items (
  venta_id              UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  articulo_id           UUID NOT NULL REFERENCES articulos(id),
  cantidad              NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_lista          NUMERIC(14,2) NOT NULL DEFAULT 0,  -- precio de la lista al momento de la venta
  descuento_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
  precio_unitario_final NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_monto             NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (venta_id, articulo_id)
);

CREATE INDEX idx_venta_items_articulo ON venta_items(articulo_id);

CREATE TABLE venta_pagos (
  venta_id        UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  medio_pago_id   UUID NOT NULL REFERENCES medios_pago(id),
  monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  cuenta_destino  VARCHAR(100),
  PRIMARY KEY (venta_id, medio_pago_id)
);

CREATE TABLE preventas_vendedor (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES usuarios(id),
  cliente_id  UUID REFERENCES clientes(id),
  total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado      VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','confirmada','cancelada')),
  venta_id    UUID REFERENCES ventas(id),  -- FK una vez convertida en venta
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_preventas_updated_at
  BEFORE UPDATE ON preventas_vendedor
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- DOMINIO: AFIP
-- =============================================================================

CREATE TABLE facturaciones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id              UUID REFERENCES ventas(id),
  sucursal_id           UUID NOT NULL REFERENCES sucursales(id),
  tipo_comprobante_id   UUID NOT NULL REFERENCES tipos_comprobante(id),
  punto_venta           INT NOT NULL,  -- punto_venta_afip de la sucursal en el momento de emisión
  numero                INT NOT NULL,
  cae                   VARCHAR(14),
  cae_vencimiento       DATE,
  total                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  qr_url                TEXT,
  qr_img_url            TEXT,
  respuesta_afip        JSONB,
  ok                    BOOLEAN NOT NULL DEFAULT FALSE,
  mensaje_afip          TEXT,
  fecha_emision         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  legacy_id             TEXT,
  UNIQUE (tipo_comprobante_id, punto_venta, numero)
);

CREATE INDEX idx_facturaciones_venta ON facturaciones(venta_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_facturaciones_cae ON facturaciones(cae) WHERE cae IS NOT NULL;
CREATE INDEX idx_facturaciones_fecha ON facturaciones(sucursal_id, fecha_emision DESC) WHERE deleted_at IS NULL;

CREATE TABLE notas_credito (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id      UUID NOT NULL REFERENCES facturaciones(id),
  motivo          TEXT NOT NULL,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  cae             VARCHAR(14),
  numero          INT,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respuesta_afip  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_id       TEXT
);

CREATE INDEX idx_notas_credito_factura ON notas_credito(factura_id);

-- =============================================================================
-- DOMINIO: CAJA
-- =============================================================================

CREATE TABLE cajas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id             UUID NOT NULL REFERENCES sucursales(id),
  usuario_apertura_id     UUID REFERENCES usuarios(id),
  fecha_apertura          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre            TIMESTAMPTZ,
  saldo_inicial           NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_final_sistema     NUMERIC(14,2),
  saldo_final_real        NUMERIC(14,2),
  diferencia              NUMERIC(14,2),
  estado                  VARCHAR(10) NOT NULL DEFAULT 'abierta'
                            CHECK (estado IN ('abierta','cerrada'))
);

CREATE INDEX idx_cajas_sucursal ON cajas(sucursal_id, fecha_apertura DESC);
CREATE INDEX idx_cajas_abierta ON cajas(sucursal_id) WHERE estado = 'abierta';

CREATE TABLE movimientos_caja (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id         UUID NOT NULL REFERENCES cajas(id),
  tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('ingreso','egreso','venta','retiro')),
  concepto        TEXT NOT NULL,
  monto           NUMERIC(14,2) NOT NULL,
  medio_pago_id   UUID REFERENCES medios_pago(id),
  origen_tipo     VARCHAR(50),
  origen_id       UUID,
  usuario_id      UUID REFERENCES usuarios(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimientos_caja ON movimientos_caja(caja_id, fecha DESC);

-- =============================================================================
-- DOMINIO: GASTOS / EMPLEADOS
-- =============================================================================

CREATE TABLE gastos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id         UUID NOT NULL REFERENCES sucursales(id),
  subrubro_gasto_id   UUID NOT NULL REFERENCES subrubro_gastos(id),
  descripcion         TEXT NOT NULL,
  monto               NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  medio_pago_id       UUID REFERENCES medios_pago(id),
  fecha               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  es_fijo             BOOLEAN NOT NULL DEFAULT FALSE,
  comprobante_url     TEXT,
  usuario_id          UUID REFERENCES usuarios(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_id           TEXT
);

CREATE INDEX idx_gastos_sucursal ON gastos(sucursal_id, fecha DESC);
CREATE INDEX idx_gastos_subrubro ON gastos(subrubro_gasto_id);

CREATE TABLE gastos_fijos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion           TEXT NOT NULL,
  monto                 NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  frecuencia            VARCHAR(15) NOT NULL CHECK (frecuencia IN ('mensual','quincenal')),
  proximo_vencimiento   DATE,
  activo                BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE empleados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id     UUID NOT NULL REFERENCES sucursales(id),
  dni             VARCHAR(15),
  nombre          VARCHAR(150) NOT NULL,
  cargo           VARCHAR(100),
  fecha_ingreso   DATE,
  salario         NUMERIC(14,2),
  telefono        VARCHAR(30),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_empleados_updated_at
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- DOMINIO: AUDIT
-- =============================================================================

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  tabla           VARCHAR(80) NOT NULL,
  registro_id     UUID NOT NULL,
  accion          VARCHAR(10) NOT NULL CHECK (accion IN ('insert','update','delete')),
  datos_antes     JSONB,
  datos_despues   JSONB,
  usuario_id      UUID REFERENCES usuarios(id),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tabla ON audit_log(tabla, registro_id);
CREATE INDEX idx_audit_log_fecha ON audit_log(fecha DESC);

-- =============================================================================
-- TABLA TÉCNICA: tracking de migraciones
-- =============================================================================

CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  filename    VARCHAR(200) NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
