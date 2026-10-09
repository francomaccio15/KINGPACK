// Venta por unidad: bulto o suelto (mig 063, docs/PLAN_VENTA_POR_UNIDAD.md).
//
// El stock se guarda SIEMPRE en la unidad más chica (la unidad suelta). Cada
// línea de un comprobante dice en qué unidad se cargó (`unidad_venta`) y cuántas
// unidades de stock vale cada una (`factor`, congelado en la línea):
//   bulto  → factor = articulos.unidades_por_bulto
//   unidad → factor = 1
// Movimiento de stock de la línea = cantidad × factor. TODOS los lugares que
// escriben stock pasan por acá: si uno se saltea el factor, el stock se
// descuadra sin que nadie lo note.
//
// Mientras un artículo tenga unidades_por_bulto = 1 (todos, hasta la conversión
// del paso 4), factor = 1 y el sistema se comporta exactamente igual que antes.

const UNIDADES = ['bulto', 'unidad'];

function normalizarUnidad(u) {
  return u === 'unidad' ? 'unidad' : 'bulto';
}

function unidadesPorBulto(art) {
  const n = parseInt(art?.unidades_por_bulto, 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

// ¿Se puede vender suelto? Marcado por el admin, con bulto real y precio propio.
function puedeVenderPorUnidad(art) {
  return !!art?.vende_por_unidad && unidadesPorBulto(art) > 1 && parseFloat(art?.precio_unidad) > 0;
}

function factorDe(art, unidad) {
  return normalizarUnidad(unidad) === 'unidad' ? 1 : unidadesPorBulto(art);
}

// Factor congelado de una línea ya guardada. Las líneas sin factor (JSONB de
// devoluciones/NC anteriores a la mig 063) eran todas por bulto.
function factorGuardado(linea, art) {
  const f = parseInt(linea?.factor, 10);
  if (Number.isFinite(f) && f >= 1) return f;
  return factorDe(art, linea?.unidad_venta);
}

// Unidades de stock que mueve una línea.
function cantidadStock(cantidad, factor) {
  return parseFloat((parseFloat(cantidad) * (parseInt(factor, 10) || 1)).toFixed(3));
}

async function cargarArticulos(db, ids) {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return {};
  const { rows } = await db.query(
    `SELECT id, nombre, vende_por_unidad, unidades_por_bulto, precio_unidad
       FROM articulos WHERE id = ANY($1::uuid[])`,
    [unicos]
  );
  return Object.fromEntries(rows.map(a => [a.id, a]));
}

// Agrega `unidad_venta` y `factor` a cada ítem con articulo_id, según el
// artículo de hoy. Si un ítem pide 'unidad' en un artículo que no se vende
// suelto devuelve { error }. Uso: altas (venta, NC, devolución, traspaso).
async function resolverUnidades(db, items, { esDevolucion = false } = {}) {
  const arts = await cargarArticulos(db, items.map(i => i.articulo_id));
  const out = [];
  for (const it of items) {
    if (!it.articulo_id) { out.push(it); continue; }
    const art = arts[it.articulo_id];
    const unidad = normalizarUnidad(it.unidad_venta);
    // Una devolución puede traer sueltas de un artículo que ya no se vende así:
    // la unidad de la venta original manda (factor 1, siempre correcto).
    if (unidad === 'unidad' && !esDevolucion && !puedeVenderPorUnidad(art)) {
      return { error: `"${art?.nombre ?? it.articulo_id}" no se vende por unidad` };
    }
    out.push({ ...it, unidad_venta: unidad, factor: factorDe(art, unidad) });
  }
  return { items: out, arts };
}

// Para devolver/revertir líneas guardadas (JSONB): usa el factor congelado.
async function factoresGuardados(db, items) {
  const arts = await cargarArticulos(db, items.map(i => i.articulo_id));
  return items.map(it => (it.articulo_id
    ? { ...it, factor: factorGuardado(it, arts[it.articulo_id]) }
    : it));
}

// Unidades por bulto de HOY de un artículo. Las compras se cargan siempre por
// bulto: lo que entra al stock es cantidad × esto.
async function unidadesPorBultoDe(db, articuloId) {
  const { rows } = await db.query(
    `SELECT unidades_por_bulto FROM articulos WHERE id = $1`, [articuloId]
  );
  return unidadesPorBulto(rows[0]);
}

// ¿La sucursal vende suelto? (mig 067: Laprida no, solo por bulto.)
async function sucursalVendePorUnidad(db, sucursalId) {
  if (!sucursalId) return true;
  const { rows } = await db.query(
    `SELECT vende_por_unidad FROM sucursales WHERE id = $1`, [sucursalId]
  );
  return rows[0]?.vende_por_unidad !== false;
}

// Formato «7 bultos + 20 u.» para mensajes del backend (stock insuficiente).
function formatoStock(cantidad, upb) {
  const n = parseFloat(cantidad) || 0;
  const f = parseInt(upb, 10) || 1;
  if (f <= 1) return String(+n.toFixed(3));
  const bultos = Math.trunc(n / f);
  const sueltas = +(n - bultos * f).toFixed(3);
  const partes = [];
  if (bultos) partes.push(`${bultos} ${bultos === 1 ? 'bulto' : 'bultos'}`);
  if (sueltas || !bultos) partes.push(`${sueltas} u.`);
  return partes.join(' + ');
}

module.exports = {
  UNIDADES,
  normalizarUnidad,
  unidadesPorBulto,
  puedeVenderPorUnidad,
  factorDe,
  factorGuardado,
  cantidadStock,
  resolverUnidades,
  factoresGuardados,
  unidadesPorBultoDe,
  sucursalVendePorUnidad,
  formatoStock,
};
