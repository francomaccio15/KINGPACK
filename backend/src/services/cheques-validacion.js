// Validación de datos de cheques (mig 059).
//
// Un cheque mal cargado es plata que no se puede reclamar: un CUIT con un dígito
// cambiado no identifica a nadie, y un vencimiento fuera de vigencia es un
// cheque que el banco no va a pagar. Por eso se valida estructura (dígitos
// verificadores), no solo que el campo "tenga algo".
//
// Los campos de la mig 059 son obligatorios SOLO en altas nuevas. El histórico
// quedó en NULL y no se toca.

const FORMAS      = ['fisico', 'echeq'];
const MODALIDADES = ['al_dia', 'diferido'];

const CAUSALES_RECHAZO = {
  sin_fondos:        'Causal 1 — Sin fondos suficientes',
  defecto_formal:    'Causal 2 — Defecto formal',
  orden_no_pagar:    'Orden de no pagar',
  cuenta_cerrada:    'Cuenta cerrada / inhabilitada',
  firma_falsa:       'Firma falsa o adulteración',
  denuncia_extravio: 'Denuncia de extravío / robo',
  otro:              'Otro',
};

// Vigencia máxima emisión → vencimiento, en días corridos.
//   al_dia   : cheque común, 30 días (Ley 24.452 art. 25)
//   diferido : pago diferido, hasta 360 días (art. 54)
const VIGENCIA_DIAS = { al_dia: 30, diferido: 360 };

const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

// CUIT/CUIL: 11 dígitos, el último es verificador módulo 11.
function cuitValido(valor) {
  const d = soloDigitos(valor);
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false; // AFIP no emite CUIT con verificador 10
  return dv === Number(d[10]);
}

// "20123456786" → "20-12345678-6"
function formatearCuit(valor) {
  const d = soloDigitos(valor);
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

// CBU: 22 dígitos en dos bloques, cada uno con su verificador.
//   bloque 1 (8)  = banco(3) + sucursal(4) + DV
//   bloque 2 (14) = cuenta(13) + DV
function cbuValido(valor) {
  const d = soloDigitos(valor);
  if (d.length !== 22) return false;
  const dv = (digitos, pesos) => {
    const s = pesos.reduce((acc, p, i) => acc + p * Number(digitos[i]), 0);
    return (10 - (s % 10)) % 10;
  };
  const b1 = d.slice(0, 8);
  const b2 = d.slice(8);
  return dv(b1, [7, 1, 3, 9, 7, 1, 3]) === Number(b1[7])
      && dv(b2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) === Number(b2[13]);
}

// Número de cheque físico: solo dígitos (los bancos argentinos usan 8).
// ID de ECHEQ: alfanumérico, lo asigna la red (COELSA).
function numeroValido(numero, forma) {
  const n = String(numero ?? '').trim();
  if (forma === 'echeq') return /^[A-Za-z0-9-]{6,30}$/.test(n);
  return /^\d{4,12}$/.test(n);
}

function diasEntre(desdeISO, hastaISO) {
  const a = Date.UTC(...desdeISO.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))));
  const b = Date.UTC(...hastaISO.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))));
  return Math.round((b - a) / 86_400_000);
}

const esFechaISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(s));

// Devuelve el mensaje de error de vigencia, o null si está bien.
function errorVigencia(fechaEmision, fechaVencimiento, modalidad) {
  const dias = diasEntre(fechaEmision, fechaVencimiento);
  if (dias < 0) return 'El vencimiento no puede ser anterior a la emisión';
  const max = VIGENCIA_DIAS[modalidad];
  if (dias > max) {
    return modalidad === 'al_dia'
      ? `Cheque al día: el vencimiento supera los 30 días corridos desde la emisión (${dias} días). Si es de pago diferido, marcalo como tal.`
      : `Cheque diferido: el vencimiento supera los 360 días desde la emisión (${dias} días).`;
  }
  return null;
}

// Valida y normaliza el alta de un cheque. Devuelve { error } o { datos }.
// `datos` trae solo los campos de la mig 059 ya limpios; los de siempre
// (banco, número, importe, fechas) los sigue manejando la ruta.
function validarAltaCheque(body) {
  const tipo  = body.tipo;
  const forma = body.forma;
  const modalidad = body.modalidad;

  if (!FORMAS.includes(forma))         return { error: 'Indicá si es cheque físico o ECHEQ' };
  if (!MODALIDADES.includes(modalidad)) return { error: 'Indicá si es al día o de pago diferido' };

  if (!numeroValido(body.numero_cheque, forma)) {
    return { error: forma === 'echeq'
      ? 'ID de ECHEQ inválido (6 a 30 caracteres alfanuméricos)'
      : 'Número de cheque inválido (solo dígitos, 4 a 12)' };
  }

  if (!esFechaISO(body.fecha_emision))     return { error: 'La fecha de emisión es obligatoria' };
  if (!esFechaISO(body.fecha_vencimiento)) return { error: 'La fecha de vencimiento es obligatoria' };
  const ev = errorVigencia(body.fecha_emision, body.fecha_vencimiento, modalidad);
  if (ev) return { error: ev };

  // Sucursal bancaria o CBU: alcanza con uno. El CBU, si viene, tiene que cerrar.
  const bancoSucursal = body.banco_sucursal?.trim() || null;
  const cbuDig = soloDigitos(body.banco_cbu);
  if (body.banco_cbu && !cbuValido(cbuDig)) return { error: 'CBU inválido (no cierran los dígitos verificadores)' };
  if (!bancoSucursal && !cbuDig) return { error: 'Indicá la sucursal bancaria o el CBU del cheque' };

  // Librador: solo se exige en los RECIBIDOS. En los emitidos el librador es
  // KingPack — pedir el CUIT propio en cada alta es ruido.
  let libradorCuit = null;
  let libradorNombre = body.librador_nombre?.trim() || null;
  if (tipo === 'recibido') {
    if (!body.librador_cuit) return { error: 'El CUIT/CUIL del librador es obligatorio' };
    if (!cuitValido(body.librador_cuit)) return { error: 'CUIT/CUIL del librador inválido (no cierra el dígito verificador)' };
    if (!libradorNombre) return { error: 'El nombre del librador es obligatorio' };
    libradorCuit = formatearCuit(body.librador_cuit);
  }

  return {
    datos: {
      forma,
      modalidad,
      librador_cuit:   libradorCuit,
      librador_nombre: libradorNombre,
      banco_sucursal:  bancoSucursal,
      banco_cbu:       cbuDig || null,
    },
  };
}

// Valida los cheques que llegan embebidos en otra operación (venta, egreso,
// pago a proveedor, movimiento de caja). Mismas reglas que el alta manual,
// más banco/importe, que ahí valida la ruta. Se llama ANTES del BEGIN: un
// error acá es un 400 limpio, sin transacción que deshacer.
// Devuelve { error } o { cheques } con cada cheque normalizado.
function validarListaCheques(lista, tipo) {
  const salida = [];
  const vistos = new Set();
  for (const [i, ch] of (lista || []).entries()) {
    const ref = (lista.length > 1 ? `Cheque ${i + 1}: ` : '');
    if (!ch?.banco?.trim()) return { error: `${ref}falta el banco` };
    const importe = String(ch.importe ?? '').trim();
    if (!(Number(importe) > 0)) return { error: `${ref}el importe debe ser mayor a 0` };
    if (!/^\d+(\.\d{1,2})?$/.test(importe)) return { error: `${ref}el importe admite como máximo 2 decimales` };

    const v = validarAltaCheque({ ...ch, tipo });
    if (v.error) return { error: `${ref}${v.error}` };

    const clave = `${ch.banco.trim().toLowerCase()}|${String(ch.numero_cheque).trim()}`;
    if (vistos.has(clave)) return { error: `${ref}está repetido en la misma operación` };
    vistos.add(clave);

    salida.push({
      ...v.datos,
      banco: ch.banco.trim(),
      numero_cheque: String(ch.numero_cheque).trim(),
      fecha_emision: ch.fecha_emision,
      fecha_vencimiento: ch.fecha_vencimiento,
      importe: Number(importe),
    });
  }
  return { cheques: salida };
}

// ¿Alguno de estos cheques ya existe (no anulado)? Mismo criterio que el alta
// manual: banco + número, y CUIT si ambos lo tienen. Devuelve el mensaje o null.
async function errorDuplicados(db, cheques) {
  for (const ch of cheques) {
    const { rows } = await db.query(`
      SELECT origen_nombre, estado FROM vw_cheques
       WHERE LOWER(TRIM(banco)) = LOWER($1) AND TRIM(numero_cheque) = $2
         AND ($3::text IS NULL OR librador_cuit IS NULL OR librador_cuit = $3)
         AND estado <> 'anulado'
       LIMIT 1`, [ch.banco, ch.numero_cheque, ch.librador_cuit]);
    if (rows.length) {
      return `Ya existe el cheque ${ch.banco} #${ch.numero_cheque} (${rows[0].origen_nombre}, ${rows[0].estado})`;
    }
  }
  return null;
}

module.exports = {
  validarListaCheques,
  errorDuplicados,
  FORMAS,
  MODALIDADES,
  CAUSALES_RECHAZO,
  VIGENCIA_DIAS,
  cuitValido,
  cbuValido,
  formatearCuit,
  numeroValido,
  errorVigencia,
  validarAltaCheque,
};
