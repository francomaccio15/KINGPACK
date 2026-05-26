const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-set-in-env';

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const token = auth.slice(7);
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
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
 * Para otros roles devuelve req.query.sucursal_id (puede ser undefined).
 */
function sucursalEfectiva(req) {
  if (req.usuario?.rol === 'cajero') {
    return req.usuario.sucursal_default_id ?? null;
  }
  return req.query?.sucursal_id ?? null;
}

module.exports = { verifyToken, requireRol, sucursalEfectiva };
