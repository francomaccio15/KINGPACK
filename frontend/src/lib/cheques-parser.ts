// Carga rápida de cheques: interpreta líneas de texto plano como
//   "ECHEQ Santander 12345678 $150000 Venc: 15/11 Client: Distribuidora Norte"
// y las convierte en borradores. Nunca inventa un dato que no está en el texto:
// lo que falta queda vacío y la pantalla lo pide antes de guardar. Las únicas
// inferencias (forma y modalidad) se marcan como tales para que se vean.

import { type Forma, type Modalidad, soloDigitos, cuitValido, formatearCuit, diasEntre } from './cheques';

export interface BorradorCheque {
  linea: string;
  forma: Forma;
  formaInferida: boolean;
  modalidad: Modalidad;
  modalidadInferida: boolean;
  banco: string;
  bancoSucursal: string;
  cbu: string;
  numero: string;
  importe: string;          // con punto decimal, listo para el backend
  fechaEmision: string;     // YYYY-MM-DD o ''
  fechaVencimiento: string; // YYYY-MM-DD o ''
  libradorCuit: string;
  libradorNombre: string;
  clienteTexto: string;     // lo que vino después de "Cliente:"
  clienteId: string;
  observaciones: string;
}

// Bancos más comunes en Argentina. El primero de cada fila es el nombre canónico.
const BANCOS: string[][] = [
  ['Santander', 'santander', 'rio'],
  ['Galicia', 'galicia'],
  ['Nación', 'nacion', 'nación', 'bna'],
  ['Provincia', 'provincia', 'bapro'],
  ['Macro', 'macro'],
  ['BBVA', 'bbva', 'frances', 'francés'],
  ['Credicoop', 'credicoop'],
  ['ICBC', 'icbc'],
  ['HSBC', 'hsbc'],
  ['Patagonia', 'patagonia'],
  ['Supervielle', 'supervielle'],
  ['Ciudad', 'ciudad'],
  ['Comafi', 'comafi'],
  ['Hipotecario', 'hipotecario'],
  ['Itaú', 'itau', 'itaú'],
  ['Industrial', 'industrial', 'bind'],
  ['Columbia', 'columbia'],
  ['Masventas', 'masventas'],
  ['Salta', 'salta'],
];

// Etiquetas que cortan el valor de "Cliente: …", "Suc: …", etc.
const ETIQUETAS = '(?:venc(?:imiento)?|vto|emi(?:si[oó]n)?|emitido|fecha|cliente?|cli|librador|cuit|cuil|suc(?:ursal)?|cbu|banco|monto|importe|obs(?:ervaciones?)?|fact(?:ura)?|pedido|ref)';
const valorEtiqueta = (linea: string, etiqueta: string) => {
  const re = new RegExp(`\\b${etiqueta}\\.?\\s*[:=]?\\s*(.+?)(?=\\s+${ETIQUETAS}\\b\\.?\\s*[:=]|$)`, 'i');
  return linea.match(re)?.[1]?.trim() ?? '';
};

// "150.000,50" · "150000" · "150,000.50" · "1.500.000" → "150000.50" etc.
export function parsearImporte(txt: string): string {
  let t = txt.replace(/[^\d.,]/g, '');
  if (!t) return '';
  const ultPunto = t.lastIndexOf('.');
  const ultComa  = t.lastIndexOf(',');
  if (ultPunto >= 0 && ultComa >= 0) {
    // El separador que aparece último es el decimal.
    const dec = ultComa > ultPunto ? ',' : '.';
    const mil = dec === ',' ? '.' : ',';
    t = t.split(mil).join('').replace(dec, '.');
  } else if (ultComa >= 0) {
    // Solo comas: decimal si hay 1-2 dígitos al final y una sola coma; si no, miles.
    t = /^\d+,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.split(',').join('');
  } else if (ultPunto >= 0) {
    // Solo puntos: miles si todos los grupos tienen 3 dígitos (formato AR).
    t = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.split('.').join('') : t;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return '';
  return (Math.round(n * 100) / 100).toFixed(2);
}

// "15/11", "15/11/26", "15-11-2026" → YYYY-MM-DD. Sin año: la próxima
// ocurrencia a partir de `ref` (un vencimiento "15/01" cargado en diciembre es
// del año que viene). Para emisión se usa la ocurrencia pasada más cercana.
export function parsearFecha(txt: string, ref: string, sentido: 'futuro' | 'pasado'): string {
  const m = txt.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (!m) return '';
  const d = Number(m[1]);
  const mes = Number(m[2]);
  if (d < 1 || d > 31 || mes < 1 || mes > 12) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  let anio: number;
  if (m[3]) {
    anio = Number(m[3]);
    if (anio < 100) anio += 2000;
  } else {
    anio = Number(ref.slice(0, 4));
    const cand = `${anio}-${pad(mes)}-${pad(d)}`;
    if (sentido === 'futuro' && cand < ref) anio += 1;
    if (sentido === 'pasado' && cand > ref) anio -= 1;
  }
  const iso = `${anio}-${pad(mes)}-${pad(d)}`;
  // Descarta 31/02 y similares.
  const dt = new Date(iso + 'T00:00:00Z');
  return dt.getUTCDate() === d && dt.getUTCMonth() + 1 === mes ? iso : '';
}

export interface ClienteRef { id: string; nombre: string; cuit?: string | null }

export function parsearLinea(linea: string, hoy: string, clientes: ClienteRef[]): BorradorCheque {
  let resto = ` ${linea} `;
  const quitar = (frag: string) => { if (frag) resto = resto.replace(frag, ' '); };

  // Forma
  const echeq = /\be-?cheq\b/i.test(linea);
  const fisicoExplicito = /\bf[ií]sico\b/i.test(linea);
  quitar(linea.match(/\be-?cheq\b/i)?.[0] ?? '');
  quitar(linea.match(/\bf[ií]sico\b/i)?.[0] ?? '');

  // Fechas (por etiqueta)
  const vencTxt = valorEtiqueta(linea, '(?:venc(?:imiento)?|vto)');
  const emiTxt  = valorEtiqueta(linea, '(?:emi(?:si[oó]n)?|emitido)');
  const fechaVencimiento = parsearFecha(vencTxt, hoy, 'futuro');
  const fechaEmision = parsearFecha(emiTxt, hoy, 'pasado');
  quitar(linea.match(new RegExp(`\\b(?:venc(?:imiento)?|vto)\\.?\\s*[:=]?\\s*${escapar(vencTxt.split(/\s/)[0] ?? '')}`, 'i'))?.[0] ?? '');
  quitar(linea.match(new RegExp(`\\b(?:emi(?:si[oó]n)?|emitido)\\.?\\s*[:=]?\\s*${escapar(emiTxt.split(/\s/)[0] ?? '')}`, 'i'))?.[0] ?? '');

  // Cliente / librador (texto libre hasta la próxima etiqueta)
  const clienteTexto = valorEtiqueta(linea, '(?:cliente?|cli)');
  const libradorTexto = valorEtiqueta(linea, 'librador');
  const sucTexto = valorEtiqueta(linea, 'suc(?:ursal)?');
  const obsTexto = valorEtiqueta(linea, '(?:obs(?:ervaciones?)?|fact(?:ura)?|pedido|ref)');
  for (const et of ['(?:cliente?|cli)', 'librador', 'suc(?:ursal)?', '(?:obs(?:ervaciones?)?|fact(?:ura)?|pedido|ref)']) {
    const v = valorEtiqueta(linea, et);
    if (v) quitar(linea.match(new RegExp(`\\b${et}\\.?\\s*[:=]?\\s*${escapar(v)}`, 'i'))?.[0] ?? '');
  }

  // CBU (22 dígitos) y CUIT (11, con o sin guiones)
  const cbu = resto.match(/\b\d{22}\b/)?.[0] ?? '';
  quitar(cbu);
  const cuitMatch = resto.match(/\b\d{2}-?\d{8}-?\d\b/)?.[0] ?? '';
  quitar(cuitMatch);
  quitar(resto.match(/\b(?:cuit|cuil)\.?\s*[:=]?/i)?.[0] ?? '');

  // Importe: "$ 150.000", o "monto/importe: …"
  const impTxt = resto.match(/\$\s*[\d.,]+/)?.[0]
    ?? resto.match(/\b(?:monto|importe)\.?\s*[:=]?\s*[\d.,]+/i)?.[0] ?? '';
  const importe = parsearImporte(impTxt);
  quitar(impTxt);

  // Banco
  let banco = '';
  for (const [canon, ...alias] of BANCOS) {
    const hit = alias.find(a => new RegExp(`\\b${a}\\b`, 'i').test(resto));
    if (hit) { banco = canon; quitar(resto.match(new RegExp(`\\b(?:banco\\s+)?${hit}\\b`, 'i'))?.[0] ?? ''); break; }
  }
  if (!banco) {
    const b = resto.match(/\bbanco\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/i);
    if (b) { banco = b[1]; quitar(b[0]); }
  }

  // Número / ID: con prefijo explícito, o el primer token que tenga forma de número.
  let numero = '';
  const conPrefijo = resto.match(/(?:\bn[°ºro.]*|\bid|#)\s*:?\s*([A-Za-z0-9-]{4,30})/i);
  if (conPrefijo) numero = conPrefijo[1];
  else numero = (echeq
    ? resto.match(/\b(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{6,30}\b/)?.[0]
    : resto.match(/\b\d{4,12}\b/)?.[0]) ?? '';

  // Modalidad: explícita, o inferida por el plazo.
  let modalidad: Modalidad;
  let modalidadInferida = false;
  if (/\b(?:diferido|cpd|pago\s+diferido)\b/i.test(linea)) modalidad = 'diferido';
  else if (/\bal\s+d[ií]a\b/i.test(linea)) modalidad = 'al_dia';
  else {
    modalidadInferida = true;
    const base = fechaEmision || hoy;
    modalidad = fechaVencimiento && diasEntre(base, fechaVencimiento) > 30 ? 'diferido' : 'al_dia';
  }

  // Cliente: si el texto coincide con uno solo de la base, se vincula y propone
  // librador (nombre + CUIT). Si coincide con varios, no se elige ninguno.
  let clienteId = '';
  let libradorNombre = libradorTexto;
  let libradorCuit = cuitMatch && cuitValido(cuitMatch) ? formatearCuit(cuitMatch) : soloDigitos(cuitMatch);
  if (clienteTexto) {
    const q = normalizar(clienteTexto);
    const exactos = clientes.filter(c => normalizar(c.nombre) === q);
    const parciales = exactos.length ? exactos : clientes.filter(c => normalizar(c.nombre).includes(q));
    if (parciales.length === 1) {
      const c = parciales[0];
      clienteId = c.id;
      if (!libradorNombre) libradorNombre = c.nombre;
      if (!libradorCuit && c.cuit) libradorCuit = c.cuit;
    } else if (!libradorNombre) {
      libradorNombre = clienteTexto;
    }
  }

  return {
    linea,
    forma: echeq ? 'echeq' : 'fisico',
    formaInferida: !echeq && !fisicoExplicito,
    modalidad,
    modalidadInferida,
    banco,
    bancoSucursal: sucTexto,
    cbu,
    numero,
    importe,
    fechaEmision,
    fechaVencimiento,
    libradorCuit,
    libradorNombre,
    clienteTexto,
    clienteId,
    observaciones: obsTexto,
  };
}

export function parsearTexto(texto: string, hoy: string, clientes: ClienteRef[]): BorradorCheque[] {
  return texto
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => parsearLinea(l, hoy, clientes));
}

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
