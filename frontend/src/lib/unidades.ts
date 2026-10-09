// Venta por unidad: bulto o suelto (mig 063, docs/PLAN_VENTA_POR_UNIDAD.md).
//
// El stock se guarda en la unidad más chica (la suelta), pero en pantalla NUNCA
// se muestra el número crudo: siempre bultos completos + sueltas. Todas las
// pantallas usan este helper para que se vea igual en todos lados.

export type UnidadVenta = 'bulto' | 'unidad';

export interface ArticuloUnidad {
  vende_por_unidad?: boolean | null;
  unidades_por_bulto?: number | string | null;
  precio_unidad?: number | string | null;
  /** Viene de /api/articulos?sucursal_id=…: FALSE si esa sucursal solo vende por bulto (Laprida). */
  vende_por_unidad_suc?: boolean | null;
}

export function unidadesPorBulto(art?: ArticuloUnidad | null): number {
  const n = parseInt(String(art?.unidades_por_bulto ?? 1), 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/** Marcado por el admin, con bulto real y precio por unidad propio, y la sucursal lo permite. */
export function vendePorUnidad(art?: ArticuloUnidad | null): boolean {
  return !!art?.vende_por_unidad && art?.vende_por_unidad_suc !== false
    && unidadesPorBulto(art) > 1 && Number(art?.precio_unidad) > 0;
}

/** Unidades de stock que vale una línea (bulto → factor; suelta → 1). */
export function factorLinea(art: ArticuloUnidad | null | undefined, unidad: UnidadVenta | undefined): number {
  return unidad === 'unidad' ? 1 : unidadesPorBulto(art);
}

function num(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('es-AR') : n.toLocaleString('es-AR', { maximumFractionDigits: 3 });
}

/**
 * Stock en unidades crudas → «7 bultos + 20 u.» (bulto ×100, 720 en la base).
 * Sin bulto (factor 1) se muestra el número como siempre.
 */
export function formatoStock(cantidad: number | string | null | undefined, upb: number | string | null | undefined): string {
  const n = Number(cantidad) || 0;
  const f = parseInt(String(upb ?? 1), 10) || 1;
  if (f <= 1) return num(n);
  const signo = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const bultos = Math.trunc(abs / f);
  const sueltas = +(abs - bultos * f).toFixed(3);
  const partes: string[] = [];
  if (bultos) partes.push(`${num(bultos)} ${bultos === 1 ? 'bulto' : 'bultos'}`);
  if (sueltas || !bultos) partes.push(`${num(sueltas)} u.`);
  return signo + partes.join(' + ');
}

/** Etiqueta corta de la unidad de una línea: «bulto ×100» / «u.». */
export function etiquetaUnidad(unidad: UnidadVenta | undefined, upb: number): string {
  if (unidad === 'unidad') return 'u.';
  return upb > 1 ? `bulto ×${upb}` : '';
}
