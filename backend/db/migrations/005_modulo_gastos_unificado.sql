-- KINGPACK — Migration 005: Módulo Unificado de Gastos
-- Crea todas las tablas del módulo de egresos unificado.
-- No toca pedidos_compra, gastos ni gastos_fijos (preservados como legado).

-- =============================================================================
-- PLAN DE CUENTAS: RUBROS (nivel padre de subrubro_gastos)
-- =============================================================================

CREATE TABLE rubros_gastos (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  VARCHAR(100) NOT NULL UNIQUE,
  orden   INT NOT NULL DEFAULT 0
);

-- Extender subrubro_gastos con FK a rubros_gastos
-- (el campo texto "rubro" queda para retrocompatibilidad)
ALTER TABLE subrubro_gastos ADD COLUMN rubro_id UUID REFERENCES rubros_gastos(id);

-- Condición IVA en proveedores (Resp. Inscripto, Monotributista, etc.)
ALTER TABLE proveedores ADD COLUMN cond_iva_id UUID REFERENCES cond_iva(id);

-- =============================================================================
-- CUENTAS BANCARIAS DE LA EMPRESA (para transferencias)
-- =============================================================================

CREATE TABLE cuentas_bancarias_empresa (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  VARCHAR(100) NOT NULL,   -- ej. "Cuenta Laprida BBVA"
  banco   VARCHAR(80),
  cbu     VARCHAR(22),
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

-- =============================================================================
-- ANTICIPOS A PROVEEDORES
-- (se crea antes de egresos para resolver la FK circular)
-- =============================================================================

CREATE TABLE anticipos_proveedor (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id          UUID NOT NULL REFERENCES proveedores(id),
  monto                 NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,
  estado                VARCHAR(15) NOT NULL DEFAULT 'disponible'
                          CHECK (estado IN ('disponible','vinculado','anulado')),
  egreso_vinculado_id   UUID,   -- FK a egresos se agrega con ALTER TABLE más abajo
  descripcion           TEXT,
  usuario_id            UUID REFERENCES usuarios(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anticipos_proveedor   ON anticipos_proveedor(proveedor_id, fecha DESC);
CREATE INDEX idx_anticipos_disponibles ON anticipos_proveedor(proveedor_id)
  WHERE estado = 'disponible';

-- =============================================================================
-- EGRESOS: TABLA PRINCIPAL UNIFICADA
-- Reemplaza conceptualmente a "gastos" y "pedidos_compra" en la UI.
-- =============================================================================

CREATE TABLE egresos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo de operación: controla campos visibles y comportamiento del sistema
  tipo_operacion          VARCHAR(30) NOT NULL CHECK (tipo_operacion IN (
                            'compra_mercaderia',      -- actualiza stock
                            'compra_gasto',           -- tiene proveedor, sin stock
                            'carga_social_laboral',   -- sin comprobante
                            'gasto_manual',           -- libre
                            'inversion_bien_uso',     -- factura obligatoria
                            'anticipo_proveedor'      -- adelanto sin factura
                          )),

  -- Cabecera del comprobante (NULL para tipos sin comprobante)
  tipo_comprobante        VARCHAR(20) CHECK (tipo_comprobante IN (
                            'factura_a','factura_b','factura_c',
                            'nota_debito_a','nota_debito_b','nota_debito_c',
                            'nota_credito_a','nota_credito_b','nota_credito_c',
                            'informal'
                          )),
  punto_venta             VARCHAR(10),    -- ej. "00001" — conserva ceros
  numero_comprobante      VARCHAR(20),
  fecha_emision           DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Proveedor (NULL para sueldos, cargas sociales, gastos sin proveedor)
  proveedor_id            UUID REFERENCES proveedores(id),

  -- Imputación principal
  sucursal_id             UUID NOT NULL REFERENCES sucursales(id),
  subrubro_gasto_id       UUID REFERENCES subrubro_gastos(id),
  descripcion             TEXT NOT NULL,

  -- Desglose fiscal
  neto_gravado            NUMERIC(14,2) NOT NULL DEFAULT 0,
  neto_no_gravado         NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_21                  NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_105                 NUMERIC(14,2) NOT NULL DEFAULT 0,
  percepciones_ib         NUMERIC(14,2) NOT NULL DEFAULT 0,
  otros_impuestos         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total                   NUMERIC(14,2) NOT NULL CHECK (total > 0),

  -- Estado de pago y vencimiento
  estado_pago             VARCHAR(15) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado_pago IN ('pendiente','pagado','parcial')),
  fecha_vencimiento_pago  DATE,

  -- Anticipo vinculado (opcional; FK circular resuelta más abajo)
  anticipo_id             UUID REFERENCES anticipos_proveedor(id),

  -- Auditoría
  usuario_id              UUID REFERENCES usuarios(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_egresos_updated_at
  BEFORE UPDATE ON egresos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Prevención de duplicados: mismo proveedor + tipo_comprobante + punto_venta + numero
CREATE UNIQUE INDEX idx_egresos_no_dup
  ON egresos(proveedor_id, tipo_comprobante, punto_venta, numero_comprobante)
  WHERE proveedor_id IS NOT NULL AND numero_comprobante IS NOT NULL;

CREATE INDEX idx_egresos_fecha       ON egresos(sucursal_id, fecha_emision DESC);
CREATE INDEX idx_egresos_proveedor   ON egresos(proveedor_id, fecha_emision DESC)
  WHERE proveedor_id IS NOT NULL;
CREATE INDEX idx_egresos_pendientes  ON egresos(estado_pago)
  WHERE estado_pago IN ('pendiente','parcial');
CREATE INDEX idx_egresos_subrubro    ON egresos(subrubro_gasto_id);
CREATE INDEX idx_egresos_vencimiento ON egresos(fecha_vencimiento_pago)
  WHERE estado_pago IN ('pendiente','parcial') AND fecha_vencimiento_pago IS NOT NULL;

-- Completar la FK circular: anticipos → egresos
ALTER TABLE anticipos_proveedor
  ADD CONSTRAINT fk_anticipos_egreso
  FOREIGN KEY (egreso_vinculado_id) REFERENCES egresos(id);

-- =============================================================================
-- ÍTEMS DE EGRESO (línea por línea)
-- =============================================================================

CREATE TABLE egreso_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  egreso_id               UUID NOT NULL REFERENCES egresos(id) ON DELETE CASCADE,
  articulo_id             UUID REFERENCES articulos(id),   -- NULL para ítems no-mercadería
  descripcion             TEXT NOT NULL,
  cantidad                NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario         NUMERIC(14,2) NOT NULL DEFAULT 0,
  neto_linea              NUMERIC(14,2) NOT NULL DEFAULT 0,  -- cantidad × precio_unitario
  sucursal_imputacion_id  UUID NOT NULL REFERENCES sucursales(id),
  orden                   INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_egreso_items_egreso   ON egreso_items(egreso_id);
CREATE INDEX idx_egreso_items_articulo ON egreso_items(articulo_id)
  WHERE articulo_id IS NOT NULL;

-- =============================================================================
-- PAGOS DE EGRESO
-- =============================================================================

CREATE TABLE egreso_pagos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  egreso_id           UUID NOT NULL REFERENCES egresos(id) ON DELETE CASCADE,
  medio_pago_id       UUID NOT NULL REFERENCES medios_pago(id),
  monto               NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  cuenta_bancaria_id  UUID REFERENCES cuentas_bancarias_empresa(id),
  fecha_pago          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observaciones       TEXT
);

CREATE INDEX idx_egreso_pagos_egreso ON egreso_pagos(egreso_id);

-- =============================================================================
-- CHEQUES (uno o más por pago)
-- =============================================================================

CREATE TABLE egreso_cheques (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  egreso_pago_id    UUID NOT NULL REFERENCES egreso_pagos(id) ON DELETE CASCADE,
  banco             VARCHAR(80) NOT NULL,
  numero_cheque     VARCHAR(30) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  importe           NUMERIC(14,2) NOT NULL CHECK (importe > 0)
);

CREATE INDEX idx_egreso_cheques_venc ON egreso_cheques(fecha_vencimiento);

-- =============================================================================
-- CUENTA CORRIENTE DE PROVEEDORES (espejo de cuentas_corrientes_cliente)
-- =============================================================================

CREATE TABLE cuentas_corrientes_proveedor (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  debe         NUMERIC(14,2) NOT NULL DEFAULT 0,   -- deuda generada (egreso/anticipo)
  haber        NUMERIC(14,2) NOT NULL DEFAULT 0,   -- pago realizado
  saldo        NUMERIC(14,2) NOT NULL DEFAULT 0,   -- debe - haber (positivo = le debemos)
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origen_tipo  VARCHAR(20) NOT NULL
                 CHECK (origen_tipo IN ('egreso','anticipo','pago','correccion')),
  origen_id    UUID NOT NULL,
  descripcion  TEXT
);

CREATE INDEX idx_cc_proveedor ON cuentas_corrientes_proveedor(proveedor_id, fecha DESC);

-- =============================================================================
-- OBLIGACIONES MENSUALES (alerta crítica de cierre de período)
-- =============================================================================

CREATE TABLE obligaciones_mensuales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion   TEXT NOT NULL,        -- "Gastos bancarios", "Formulario 931"
  periodo_mes   INT NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_anio  INT NOT NULL,
  completada    BOOLEAN NOT NULL DEFAULT FALSE,
  egreso_id     UUID REFERENCES egresos(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_obligaciones_periodo
  ON obligaciones_mensuales(descripcion, periodo_mes, periodo_anio);
