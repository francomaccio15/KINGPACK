/**
 * Cache en memoria para el Token de Autorización (TA) del WSAA.
 * ARCA emite tokens con validez de 12 horas. Los cacheamos para no
 * autenticar en cada factura, lo que reduciría la velocidad y carga al servidor de ARCA.
 */

// key: `${cuit}:${servicio}` → { token, sign, expira }
const _cache = new Map();

function get(cuit, servicio = 'wsfe') {
  const entry = _cache.get(`${cuit}:${servicio}`);
  if (!entry) return null;
  if (Date.now() >= entry.expira) {
    _cache.delete(`${cuit}:${servicio}`);
    return null;
  }
  return { token: entry.token, sign: entry.sign };
}

function set(cuit, servicio, token, sign, ttlMs) {
  _cache.set(`${cuit}:${servicio}`, {
    token,
    sign,
    expira: Date.now() + ttlMs,
  });
}

function clear(cuit, servicio = 'wsfe') {
  _cache.delete(`${cuit}:${servicio}`);
}

module.exports = { get, set, clear };
