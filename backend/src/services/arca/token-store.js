/**
 * Cache del Token de Autorización (TA) del WSAA.
 * ARCA emite un único TA válido por servicio (~12 hs) y rechaza pedidos nuevos
 * mientras haya uno vigente ("El CEE ya posee un TA valido"). Por eso el TA se
 * persiste en disco: así sobrevive a los reinicios del backend (cada deploy) y
 * se reutiliza en vez de re-autenticar.
 */

const fs   = require('fs');
const path = require('path');
const config = require('./config');

// El TA se guarda junto a los certificados (carpeta persistente, fuera del repo).
const FILE = path.join(path.dirname(config.certPath), '.afip_ta_cache.json');

let _cache = {}; // { `${cuit}:${servicio}`: { token, sign, expira } }

function _load() {
  try {
    if (fs.existsSync(FILE)) {
      _cache = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
    }
  } catch { _cache = {}; }
}

function _persist() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(_cache), { mode: 0o600 });
  } catch (e) {
    console.warn('[arca] no se pudo persistir el TA:', e.message);
  }
}

_load();

// El TA es distinto en homologación y en producción, pero el CUIT es el mismo:
// sin el modo en la clave, un TA de homo se usaría contra producción (y al revés),
// y ARCA responde error 600 "ValidacionDeToken: Error al verificar hash".
const _key = (cuit, servicio) => `${cuit}:${config.modo}:${servicio}`;

function get(cuit, servicio = 'wsfe') {
  const key = _key(cuit, servicio);
  // Fallback al formato viejo (sin modo) para no descartar el TA vigente en el
  // deploy que introduce este cambio: pedir uno nuevo antes de tiempo falla con
  // "El CEE ya posee un TA valido" y dejaría de facturar hasta que expire.
  const entry = _cache[key] || _cache[`${cuit}:${servicio}`];
  if (!entry) return null;
  if (Date.now() >= entry.expira) {
    delete _cache[key];
    delete _cache[`${cuit}:${servicio}`];
    _persist();
    return null;
  }
  return { token: entry.token, sign: entry.sign };
}

function set(cuit, servicio, token, sign, ttlMs) {
  _cache[_key(cuit, servicio)] = { token, sign, expira: Date.now() + ttlMs };
  _persist();
}

function clear(cuit, servicio = 'wsfe') {
  delete _cache[_key(cuit, servicio)];
  delete _cache[`${cuit}:${servicio}`];
  _persist();
}

module.exports = { get, set, clear };
