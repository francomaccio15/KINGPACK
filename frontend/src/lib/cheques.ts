// Reglas de cheques del lado del cliente (espejo de
// backend/src/services/cheques-validacion.js). El backend es la autoridad;
// esto existe para avisar ANTES de mandar, campo por campo.

export type Forma = 'fisico' | 'echeq';
export type Modalidad = 'al_dia' | 'diferido';

export const FORMA_LABEL: Record<Forma, string> = { fisico: 'Físico', echeq: 'ECHEQ' };
export const MODALIDAD_LABEL: Record<Modalidad, string> = { al_dia: 'Al día', diferido: 'Pago diferido' };

export const CAUSALES_RECHAZO: Record<string, string> = {
  sin_fondos:        'Causal 1 — Sin fondos suficientes',
  defecto_formal:    'Causal 2 — Defecto formal',
  orden_no_pagar:    'Orden de no pagar',
  cuenta_cerrada:    'Cuenta cerrada / inhabilitada',
  firma_falsa:       'Firma falsa o adulteración',
  denuncia_extravio: 'Denuncia de extravío / robo',
  otro:              'Otro',
};

export const VIGENCIA_DIAS: Record<Modalidad, number> = { al_dia: 30, diferido: 360 };

export const soloDigitos = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

export function cuitValido(valor: string): boolean {
  const d = soloDigitos(valor);
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) return false;
  return dv === Number(d[10]);
}

export function formatearCuit(valor: string): string {
  const d = soloDigitos(valor);
  if (d.length !== 11) return valor;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function cbuValido(valor: string): boolean {
  const d = soloDigitos(valor);
  if (d.length !== 22) return false;
  const dv = (dig: string, pesos: number[]) =>
    (10 - (pesos.reduce((acc, p, i) => acc + p * Number(dig[i]), 0) % 10)) % 10;
  const b1 = d.slice(0, 8);
  const b2 = d.slice(8);
  return dv(b1, [7, 1, 3, 9, 7, 1, 3]) === Number(b1[7])
      && dv(b2, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]) === Number(b2[13]);
}

// Por qué no cierra un CBU, en palabras del usuario ('' si está bien o vacío).
// Caso típico: pegaron el CUIT (11 dígitos) en el campo del CBU.
export function avisoCbu(valor: string): string {
  const d = soloDigitos(valor);
  if (!valor.trim() || cbuValido(valor)) return '';
  if (d.length === 11) return 'Eso parece un CUIT, no un CBU (el CBU tiene 22 dígitos). Si no lo tenés, dejalo vacío.';
  if (d.length !== 22) return `El CBU tiene 22 dígitos (cargaste ${d.length}). Si no lo tenés, dejalo vacío.`;
  return 'CBU mal copiado: no cierran los dígitos verificadores.';
}

// Sin mínimo de largo: el número que figura en el cheque/ECHEQ puede ser corto
// y exigir 4-6 caracteres trababa cargas legítimas.
export function numeroValido(numero: string, forma: Forma): boolean {
  const n = numero.trim();
  return forma === 'echeq' ? /^[A-Za-z0-9-]{1,30}$/.test(n) : /^\d{1,12}$/.test(n);
}

export const MSG_NUMERO: Record<Forma, string> = {
  echeq:  'N° de ECHEQ inválido (solo letras, números o guiones, hasta 30)',
  fisico: 'N° de cheque inválido (solo dígitos, hasta 12)',
};

export function diasEntre(desdeISO: string, hastaISO: string): number {
  return Math.round((Date.parse(hastaISO + 'T00:00:00Z') - Date.parse(desdeISO + 'T00:00:00Z')) / 86_400_000);
}

export function errorVigencia(emision: string, venc: string, modalidad: Modalidad): string | null {
  if (!emision || !venc) return null;
  const dias = diasEntre(emision, venc);
  if (dias < 0) return 'El vencimiento no puede ser anterior a la emisión';
  if (dias > VIGENCIA_DIAS[modalidad]) {
    return modalidad === 'al_dia'
      ? `Supera los 30 días corridos (${dias} días). Si es de pago diferido, marcalo como tal.`
      : `Supera los 360 días de un diferido (${dias} días).`;
  }
  return null;
}

export const formatoMonto = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export const formatoFecha = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

// ─── Campos de la mig 059 para formularios con cheques embebidos ────────────
// (venta, egreso, pago a proveedor, movimiento de caja, cobranza). Cada form ya
// maneja banco/número/vencimiento/importe; esto agrega lo demás.

export interface ChequeExtra {
  forma: Forma;
  modalidad: Modalidad;
  fecha_emision: string;
  banco_sucursal: string;
  banco_cbu: string;
  librador_cuit: string;
  librador_nombre: string;
}

export const chequeExtraVacio = (): ChequeExtra => ({
  forma: 'fisico',
  modalidad: 'diferido',
  fecha_emision: '',
  banco_sucursal: '',
  banco_cbu: '',
  librador_cuit: '',
  librador_nombre: '',
});

// Primer error del cheque o null. Mismas reglas que el backend.
export function errorCheque(
  ch: ChequeExtra & { banco?: string; numero_cheque?: string; fecha_vencimiento?: string; importe?: string | number },
  tipo: 'recibido' | 'emitido',
): string | null {
  if (!ch.banco?.trim()) return 'falta el banco';
  if (!ch.numero_cheque?.trim()) return ch.forma === 'echeq' ? 'falta el ID del ECHEQ' : 'falta el número';
  if (!numeroValido(ch.numero_cheque, ch.forma)) return MSG_NUMERO[ch.forma];
  if (!ch.fecha_emision) return 'falta la fecha de emisión';
  if (!ch.fecha_vencimiento) return 'falta la fecha de vencimiento';
  const v = errorVigencia(ch.fecha_emision, ch.fecha_vencimiento, ch.modalidad);
  if (v) return v;
  if (!ch.banco_sucursal.trim() && !ch.banco_cbu.trim()) return 'falta la sucursal bancaria o el CBU';
  const cbu = avisoCbu(ch.banco_cbu);
  if (cbu) return cbu;
  if (tipo === 'recibido') {
    if (!ch.librador_cuit.trim()) return 'falta el CUIT del librador';
    if (!cuitValido(ch.librador_cuit)) return 'CUIT del librador inválido';
    if (!ch.librador_nombre.trim()) return 'falta el nombre del librador';
  }
  return null;
}

// Lo que se manda al backend (además de banco/número/vto/importe).
export const chequeExtraPayload = (ch: ChequeExtra, tipo: 'recibido' | 'emitido') => ({
  forma: ch.forma,
  modalidad: ch.modalidad,
  fecha_emision: ch.fecha_emision,
  banco_sucursal: ch.banco_sucursal.trim() || null,
  banco_cbu: soloDigitos(ch.banco_cbu) || null,
  librador_cuit: tipo === 'recibido' ? ch.librador_cuit.trim() : null,
  librador_nombre: tipo === 'recibido' ? ch.librador_nombre.trim() : null,
});
