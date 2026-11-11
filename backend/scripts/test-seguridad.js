/**
 * Pruebas de las protecciones de seguridad del backend, sin base de datos real:
 * reemplaza src/config/db por una base simulada en memoria y levanta la API
 * en un puerto local.
 *
 *   node scripts/test-seguridad.js
 *
 * No toca ninguna base ni servicio externo.
 */
const path   = require('path');
const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

process.env.JWT_SECRET   = 'test-secret-'.padEnd(48, 'x');
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.PORT         = '3999';
process.env.AFIP_MODO    = 'produccion';
process.env.NODE_ENV     = 'test';

// ─── Base simulada ───────────────────────────────────────────────────────────
const PASS = 'ClaveDePrueba123';
const HASH = bcrypt.hashSync(PASS, 4);
const usuarios = {
  'u-admin':  { id: 'u-admin',  email: 'admin@test.local',  rol: 'administrador', activo: true, tokens_desde: null },
  'u-cajero': { id: 'u-cajero', email: 'cajero@test.local', rol: 'cajero',        activo: true, tokens_desde: null },
  'u-vend':   { id: 'u-vend',   email: 'vend@test.local',   rol: 'vendedor',      activo: true, tokens_desde: null },
  'u-baja':   { id: 'u-baja',   email: 'baja@test.local',   rol: 'cajero',        activo: false, tokens_desde: null },
  'u-rev':    { id: 'u-rev',    email: 'rev@test.local',    rol: 'administrador', activo: true,
                tokens_desde: Math.floor(Date.now() / 1000) + 3600 },
};
const eventos = [];

const pool = {
  on() {},
  async connect() { return { query: pool.query, release() {} }; },
  async query(sql, params = []) {
    if (/INSERT INTO eventos_seguridad/.test(sql)) { eventos.push({ tipo: params[0], email: params[1] }); return { rows: [] }; }
    if (/WHERE u\.email = \$1/.test(sql)) {
      const u = Object.values(usuarios).find(x => x.email === params[0]);
      return { rows: u ? [{ ...u, password_hash: HASH, nombre: u.email, sucursal_default_id: null, sucursal_default_nombre: null }] : [] };
    }
    if (/WHERE u\.id = \$1/.test(sql)) {
      const u = usuarios[params[0]];
      return { rows: u ? [{ rol: u.rol, activo: u.activo, sucursal_default_id: null, sucursal_default_nombre: null, tokens_desde: u.tokens_desde }] : [] };
    }
    return { rows: [], rowCount: 0 };
  },
};
const dbPath = require.resolve(path.join(__dirname, '../src/config/db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool, queryWithUser: (s, p) => pool.query(s, p) } };

require('../src/index');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const BASE = 'http://127.0.0.1:3999';
const tok  = (id, extra = {}) => jwt.sign({ id, email: usuarios[id].email, rol: usuarios[id].rol, ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' });
async function req(method, p, { body, headers = {}, token } = {}) {
  const r = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, headers: r.headers, data };
}
const login = (email, password, ip) => req('POST', '/api/auth/login', { body: { email, password }, headers: { 'CF-Connecting-IP': ip } });

let ok = 0, fail = 0;
async function test(nombre, fn) {
  try { await fn(); ok++; console.log('  ✔', nombre); }
  catch (e) { fail++; console.log('  ✘', nombre, '\n     ', e.message); }
}

(async () => {
  await new Promise(r => setTimeout(r, 300));
  console.log('\nPruebas de seguridad del backend\n');

  await test('login correcto devuelve token', async () => {
    const r = await login('admin@test.local', PASS, '10.0.0.1');
    assert.equal(r.status, 200); assert.ok(r.data.token);
  });

  await test('email no-string → 400 (no 500)', async () => {
    const r = await req('POST', '/api/auth/login', { body: { email: { $ne: 1 }, password: 'x' } });
    assert.equal(r.status, 400);
  });

  await test('JSON mal formado → 400', async () => {
    const r = await req('POST', '/api/auth/login', { body: '{malo' });
    assert.equal(r.status, 400);
  });

  await test('5 contraseñas erradas bloquean la CUENTA aunque cambie la IP', async () => {
    for (let i = 0; i < 5; i++) await login('cajero@test.local', 'mal' + i, `10.1.0.${i}`);
    const r = await login('cajero@test.local', PASS, '10.1.9.9'); // clave correcta, IP nueva
    assert.equal(r.status, 429);
    assert.ok(eventos.some(e => e.tipo === 'login_bloqueo_cuenta'));
  });

  await test('límite por IP real (CF-Connecting-IP), X-Forwarded-For falso no lo esquiva', async () => {
    let last;
    for (let i = 0; i < 31; i++) {
      last = await req('POST', '/api/auth/login', {
        body: { email: `nadie${i}@test.local`, password: 'x' },
        headers: { 'CF-Connecting-IP': '10.2.0.1', 'X-Forwarded-For': `1.2.3.${i}` },
      });
    }
    assert.equal(last.status, 429);
    assert.ok(eventos.some(e => e.tipo === 'login_limite_ip'));
  });

  await test('sin token → 401', async () => {
    assert.equal((await req('GET', '/api/articulos')).status, 401);
  });

  await test('token con firma falsa → 401 y evento token_invalido', async () => {
    const falso = jwt.sign({ id: 'u-admin', rol: 'administrador' }, 'otro-secreto');
    assert.equal((await req('GET', '/api/usuarios', { token: falso })).status, 401);
    assert.ok(eventos.some(e => e.tipo === 'token_invalido'));
  });

  await test('token alg=none → 401', async () => {
    const none = jwt.sign({ id: 'u-admin', rol: 'administrador' }, null, { algorithm: 'none' });
    assert.equal((await req('GET', '/api/usuarios', { token: none })).status, 401);
  });

  await test('usuario desactivado con token vigente → 401', async () => {
    assert.equal((await req('GET', '/api/articulos', { token: tok('u-baja') })).status, 401);
  });

  await test('token emitido antes del cambio de contraseña → 401', async () => {
    assert.equal((await req('GET', '/api/articulos', { token: tok('u-rev') })).status, 401);
  });

  await test('el rol sale de la base, no del token (cajero que se dice admin)', async () => {
    const t = tok('u-cajero', { rol: 'administrador' });
    assert.equal((await req('GET', '/api/usuarios', { token: t })).status, 403);
  });

  await test('cajero no puede emitir factura de prueba ARCA → 403', async () => {
    assert.equal((await req('POST', '/api/arca/test-factura', { token: tok('u-cajero'), body: {} })).status, 403);
  });

  await test('admin tampoco puede emitir factura de prueba en modo producción → 403', async () => {
    const r = await req('POST', '/api/arca/test-factura', { token: tok('u-admin'), body: {} });
    assert.equal(r.status, 403); assert.match(r.data.error, /producción/);
  });

  await test('status de ARCA no muestra la ruta del certificado a un cajero', async () => {
    const r = await req('GET', '/api/arca/status', { token: tok('u-cajero') });
    assert.equal(r.status, 200); assert.equal(r.data.certPath, undefined);
  });

  await test('cajero no puede modificar listas de precios → 403 (pero sí leerlas)', async () => {
    assert.equal((await req('PUT', '/api/listas-precios/x', { token: tok('u-cajero'), body: {} })).status, 403);
    assert.notEqual((await req('GET', '/api/listas-precios', { token: tok('u-cajero') })).status, 403);
  });

  await test('cajero no puede crear cuentas bancarias ni rubros → 403', async () => {
    assert.equal((await req('POST', '/api/cuentas-bancarias', { token: tok('u-cajero'), body: {} })).status, 403);
    assert.equal((await req('POST', '/api/rubros-gastos', { token: tok('u-cajero'), body: {} })).status, 403);
  });

  await test('vendedor no entra a transportes / pago-clientes / anticipos / usuarios → 403', async () => {
    for (const p of ['/api/transportes', '/api/pago-clientes', '/api/anticipos-proveedores', '/api/usuarios']) {
      assert.equal((await req('GET', p, { token: tok('u-vend') })).status, 403, p);
    }
    assert.ok(eventos.some(e => e.tipo === 'acceso_denegado'));
  });

  await test('POST con Origin de otro sitio → 403 (CSRF) y evento origen_rechazado', async () => {
    const r = await req('POST', '/api/auth/login', { body: { email: 'a', password: 'b' }, headers: { Origin: 'https://evil.example' } });
    assert.equal(r.status, 403);
    assert.ok(eventos.some(e => e.tipo === 'origen_rechazado'));
  });

  await test('preflight CORS de otro sitio → 403; del frontend → OK con CORS', async () => {
    const malo = await fetch(BASE + '/api/ventas', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(malo.status, 403);
    const bueno = await fetch(BASE + '/api/ventas', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(bueno.status, 204);
    assert.equal(bueno.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  });

  await test('GET desde otro sitio no recibe cabeceras CORS', async () => {
    const r = await fetch(BASE + '/api/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  });

  await test('cabeceras de seguridad y sin X-Powered-By', async () => {
    const r = await fetch(BASE + '/api/health');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.match(r.headers.get('content-security-policy') || '', /default-src 'none'/);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(r.headers.get('strict-transport-security'));
  });

  console.log(`\n${ok} OK, ${fail} fallidas\n`);
  process.exit(fail ? 1 : 0);
})();
