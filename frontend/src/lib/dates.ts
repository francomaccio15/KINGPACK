const TZ = 'America/Argentina/Buenos_Aires';
const LOCALE = 'es-AR';

export function fmtFecha(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ,
  });
}

export function fmtFechaCorta(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LOCALE, {
    day: '2-digit', month: '2-digit', timeZone: TZ,
  });
}

export function fmtFechaLarga(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LOCALE, {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ,
  });
}

export function fmtHora(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}

export function fmtFechaHora(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}

export function fmtMesAnio(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LOCALE, {
    month: 'short', year: '2-digit', timeZone: TZ,
  });
}

export function fmtDiaMes(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LOCALE, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ,
  });
}
