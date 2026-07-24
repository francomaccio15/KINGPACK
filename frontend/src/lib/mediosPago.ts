/**
 * Medios de pago disponibles según el rol.
 *
 * El cajero cobra en el mostrador: las cajas fuertes son movimientos internos
 * de la empresa y Mercado Pago no se cobra por este circuito, así que no tienen
 * que aparecer en su selector. El resto de los roles ve la lista completa.
 */
const OCULTOS_CAJERO = ['efectivo caja fuerte', 'mercado pago'];

export interface MedioPagoBase { id: string; nombre: string }

export function filtrarMediosPorRol<T extends MedioPagoBase>(medios: T[], rol?: string): T[] {
  if (rol !== 'cajero') return medios;
  return medios.filter(m => !OCULTOS_CAJERO.some(o => m.nombre.toLowerCase().includes(o)));
}

/** Efectivo "a secas" (no las cajas fuertes), que es el default en el mostrador. */
export function medioEfectivo<T extends MedioPagoBase>(medios: T[]): T | undefined {
  return medios.find(m => m.nombre.trim().toLowerCase() === 'efectivo')
      ?? medios.find(m => m.nombre.toLowerCase().includes('efectivo'));
}
