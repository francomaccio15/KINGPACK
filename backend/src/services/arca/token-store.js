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

function get(cuit, servicio = 'wsfe') {
  const key = `${cuit}:${servicio}`;
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() >= entry.expira) {
    delete _cache[key];
    _persist();
    return null;
  }
  return { token: entry.token, sign: entry.sign };
}

function set(cuit, servicio, token, sign, ttlMs) {
  _cache[`${cuit}:${servicio}`] = { token, sign, expira: Date.now() + ttlMs };
  _persist();
}

function clear(cuit, servicio = 'wsfe') {
  delete _cache[`${cuit}:${servicio}`];
  _persist();
}

module.exports = { get, set, clear };
