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

/**
 * Cuenta fija de QR de una sucursal (mig 071, `recibe_qr`): en Huaico el QR
 * cobra siempre en MERCADO PAGO. Si la hay, la pantalla la muestra fija en vez
 * del selector; el backend la fuerza igual aunque llegue otra.
 */
export interface CuentaConQR { id: string; nombre: string; recibe_qr?: boolean | null; sucursal_id?: string | null }

export function esMedioQR(nombre?: string | null): boolean {
  // QR y el medio «Mercado Pago» van a la misma cuenta fija de la sucursal.
  return !!nombre && (/\bqr\b/i.test(nombre) || nombre.trim().toLowerCase() === 'mercado pago');
}

export function cuentaQRFija<T extends CuentaConQR>(
  cuentas: T[], medioNombre?: string | null, sucursalId?: string | null,
): T | null {
  if (!sucursalId || !esMedioQR(medioNombre)) return null;
  return cuentas.find(c => c.recibe_qr && c.sucursal_id === sucursalId) ?? null;
}
