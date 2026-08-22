/**
 * Tokens de clase compartidos — KingPack
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Reemplazan a los `inputCls` / `labelCls` / `cardCls` que hasta ahora se
 * redefinian en cada pantalla (26 y 18 copias respectivamente).
 *
 * REGLA DE ORO — cero regresion en escritorio:
 *   Todo token es mobile-first y lleva un `md:` que reproduce EXACTAMENTE el
 *   valor que la pantalla tiene hoy. En mobile los controles suben a 16px de
 *   fuente (mata el zoom automatico de iOS) y 44px de alto (minimo tactil);
 *   desde 768px vuelven a 14px y 36px, que es lo que hay actualmente.
 *   Si una captura de escritorio cambia, es un bug del token.
 *
 * REGLA DURA — las clases deben ser cadenas literales completas.
 *   Nunca construir con template strings tipo `text-${size}`: Tailwind escanea
 *   el codigo como texto plano y no puede generar una clase que no ve escrita.
 */

type ClassValue = string | false | null | undefined | ClassValue[];

/** Une clases descartando null/false/undefined. Acepta arrays anidados. */
export function cn(...parts: ClassValue[]): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (Array.isArray(p)) { const s = cn(...p); if (s) out.push(s); }
    else out.push(p);
  }
  return out.join(' ');
}

/* ── Campos de formulario ─────────────────────────────────────────────────── */

export const focusRing = 'focus:outline-none focus:border-kp-red';

const fieldBase =
  'w-full rounded-lg border border-kp-border text-kp-white placeholder:text-kp-gray transition-colors ' +
  'text-base md:text-sm min-h-touch md:min-h-touch-sm px-3 py-2.5 md:py-2 ' +
  'focus:outline-none focus:border-kp-red ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

/** Campo sobre el fondo general de la pagina o dentro de un modal. */
export const inputCls = `${fieldBase} bg-kp-surface2`;
/** Campo sobre una card (`bg-kp-surface`), donde surface2 no contrastaria. */
export const inputOnCard = `${fieldBase} bg-kp-surface`;

export const selectCls       = `${inputCls} appearance-none pr-9 cursor-pointer`;
export const selectOnCardCls = `${inputOnCard} appearance-none pr-9 cursor-pointer`;
export const textareaCls     = `${fieldBase} bg-kp-surface2 min-h-[96px] py-2.5 resize-y`;

export const labelCls = 'block text-2xs md:text-[10px] font-semibold uppercase tracking-widest text-kp-gray mb-1.5';
export const helpCls  = 'mt-1 text-2xs text-kp-gray/70';
export const errorCls = 'text-xs text-kp-red bg-kp-red/10 border border-kp-red/20 rounded-lg px-3 py-2';

/** Checkbox / radio: 20px de caja con 44px de area tactil via padding del label. */
export const checkboxCls  = 'w-5 h-5 md:w-4 md:h-4 rounded border-kp-border bg-kp-surface2 text-kp-red focus:ring-kp-red/40 cursor-pointer';
export const checkLabelCls = 'flex items-center gap-2.5 cursor-pointer select-none min-h-touch md:min-h-0 text-sm text-kp-gray-lt';

/* ── Superficies ──────────────────────────────────────────────────────────── */

export const cardCls   = 'rounded-xl border border-kp-border bg-kp-surface';
export const cardPad   = 'p-4 md:p-5';
/** Card completa: borde + fondo + padding. */
export const card      = `${cardCls} ${cardPad}`;
/** Card mas compacta, para items dentro de una lista. */
export const cardListItem = `${cardCls} p-3`;

export const sectionCls      = 'space-y-4 md:space-y-6';
export const pageTitleCls    = 'text-lg md:text-xl font-bold uppercase tracking-wide text-kp-white';
export const pageSubtitleCls = 'text-2xs md:text-xs text-kp-gray mt-0.5';
export const sectionTitleCls = 'text-2xs md:text-[10px] font-bold uppercase tracking-widest text-kp-gray';

/* ── Botones ──────────────────────────────────────────────────────────────── */

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-sm whitespace-nowrap ' +
  'transition-colors min-h-touch md:min-h-touch-sm px-4 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export const btnPrimary   = `${btnBase} bg-kp-red hover:bg-kp-red-dark text-kp-white shadow-lg shadow-kp-red/20`;
export const btnSecondary = `${btnBase} border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray`;
export const btnDanger    = `${btnBase} border border-kp-red/40 text-kp-red hover:bg-kp-red/10`;
export const btnGhost     = `${btnBase} text-kp-gray hover:text-kp-white hover:bg-kp-surface2`;

/** Boton solo-icono. Siempre acompanarlo de aria-label. */
export const btnIcon = 'inline-flex items-center justify-center rounded-lg text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors w-11 h-11 md:w-9 md:h-9 flex-shrink-0';

/** Combinar con un btn*: ancho completo en mobile, natural en escritorio. */
export const btnFullMobile = 'w-full md:w-auto';

/* ── Badges de estado ─────────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-kp-border/30 text-kp-gray border-kp-border/50',
  ok:      'bg-green-500/10 text-green-400 border-green-500/30',
  warn:    'bg-amber-500/10 text-amber-400 border-amber-500/30',
  danger:  'bg-rose-500/10 text-rose-400 border-rose-500/30',
  info:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export const badgeCls = (tone: Tone = 'neutral') =>
  cn(
    'inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide whitespace-nowrap',
    TONES[tone],
  );

/* ── Tablas (vista escritorio) ────────────────────────────────────────────── */

export const tableCls    = 'min-w-full text-sm';
export const theadRowCls = 'bg-kp-surface2 border-b border-kp-border';
export const thCls       = 'text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold';
export const thNumCls    = `${thCls} text-right`;
export const tdCls       = 'px-4 py-3';
export const tdNumCls    = `${tdCls} text-right tabular-nums`;

/* ── Texto auxiliar ───────────────────────────────────────────────────────── */

/** Reemplazo unico de los text-[9px]/[10px]/[11px]: 11px en mobile, 10px en desktop. */
export const metaCls  = 'text-2xs md:text-[10px] text-kp-gray';
/** Todo numero que se lea en columna debe alinear digitos. */
export const moneyCls = 'tabular-nums';
