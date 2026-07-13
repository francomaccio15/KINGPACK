const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET no está definido en el entorno. El servidor no puede arrancar de forma segura.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const token = auth.slice(7);
  try {
    req.usuario = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    // Instrumentación de cierres de sesión: registrar por qué se rechaza un token
    // que SÍ vino (expirado vs. firma inválida) con los tiempos reales, para
    // diagnosticar si la sesión se cae antes de lo esperado. Grep: [auth-401]
    try {
      const decoded = jwt.decode(token) || {};
      const now  = Math.floor(Date.now() / 1000);
      const info = {
        motivo:  err.name === 'TokenExpiredError' ? 'EXPIRADO' : 'INVALIDO',
        ruta:    `${req.method} ${(req.originalUrl || req.url || '').split('?')[0]}`,
        ip:      req.headers['x-forwarded-for'] || req.ip || null,
        usuario: decoded.email || decoded.id || null,
      };
      if (err.name === 'TokenExpiredError' && decoded.iat && decoded.exp) {
        info.vida_util_min     = Math.round((decoded.exp - decoded.iat) / 60);
        info.expirado_hace_min = Math.round((now - decoded.exp) / 60);
      }
      console.warn('[auth-401]', JSON.stringify(info));
    } catch { /* logging best-effort */ }
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Sin permiso para esta acción' });
    }
    next();
  };
}

/**
 * Para cajeros devuelve siempre su sucursal del JWT (ignora query params).
 * Si el cajero no tiene sucursal asignada en el JWT devuelve un UUID imposible
 * para que ninguna query retorne datos en lugar de devolver todo.
 * Para otros roles devuelve req.query.sucursal_id (puede ser undefined).
 */
function sucursalEfectiva(req) {
  if (req.usuario?.rol === 'cajero') {
    return req.usuario.sucursal_default_id || '00000000-0000-0000-0000-000000000000';
  }
  return req.query?.sucursal_id ?? null;
}

module.exports = { verifyToken, requireRol, sucursalEfectiva };
