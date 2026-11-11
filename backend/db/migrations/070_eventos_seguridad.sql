-- 070 — Registro de eventos de seguridad (logins fallidos, bloqueos de cuenta,
-- tokens con firma inválida, accesos denegados, orígenes rechazados).
-- Lo escribe src/services/seguridad.js y lo resume la campanita de los
-- administradores (routes/notificaciones.js).
CREATE TABLE IF NOT EXISTS eventos_seguridad (
  id          BIGSERIAL PRIMARY KEY,
  tipo        VARCHAR(40)  NOT NULL,
  email       VARCHAR(255),
  usuario_id  UUID,
  ip          VARCHAR(64),
  ruta        VARCHAR(255),
  detalle     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_seguridad_created ON eventos_seguridad (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_seguridad_tipo    ON eventos_seguridad (tipo, created_at DESC);

-- Al cambiar la contraseña se cierran las sesiones abiertas: todo JWT emitido
-- antes de esta fecha se rechaza (middleware/auth.js).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tokens_validos_desde TIMESTAMPTZ;
