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

export function numeroValido(numero: string, forma: Forma): boolean {
  const n = numero.trim();
  return forma === 'echeq' ? /^[A-Za-z0-9-]{6,30}$/.test(n) : /^\d{4,12}$/.test(n);
}

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
