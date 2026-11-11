/**
 * Utilidades de seguridad: IP real del cliente y registro de eventos sospechosos.
 *
 * Todo evento se escribe en el log con la etiqueta [security] (grep: [security])
 * y, si la base responde, en la tabla eventos_seguridad, que la campanita de los
 * administradores resume (routes/notificaciones.js).
 */
const { pool } = require('../config/db');

/**
 * IP real del cliente. El tráfico llega Cloudflare → nginx → Express:
 *  - CF-Connecting-IP la pone Cloudflare con la IP del visitante.
 *  - X-Real-IP la pone nginx con $remote_addr (sin real_ip configurado, es la IP
 *    del nodo de Cloudflare).
 * NO se usa el primer valor de X-Forwarded-For: lo puede inventar el atacante.
 */
function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim().slice(0, 64);
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim().slice(0, 64);
  return (req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null;
}

/** Registra un evento de seguridad. Nunca lanza: es best-effort. */
function registrarEvento(tipo, { req, email = null, usuario_id = null, ...detalle } = {}) {
  const ip   = req ? clientIp(req) : null;
  const ruta = req ? `${req.method} ${(req.originalUrl || req.url || '').split('?')[0]}`.slice(0, 255) : null;
  const linea = { evento: tipo, email, usuario_id, ip, ruta, ...detalle };
  console.warn('[security]', JSON.stringify(linea));

  pool.query(
    `INSERT INTO eventos_seguridad (tipo, email, usuario_id, ip, ruta, detalle)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tipo, email, usuario_id, ip, ruta, Object.keys(detalle).length ? detalle : null]
  ).catch(err => console.error('[security] no se pudo guardar el evento:', err.message));
}

module.exports = { clientIp, registrarEvento };
