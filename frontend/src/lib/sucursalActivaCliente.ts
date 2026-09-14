// Lee la sucursal activa (la del selector TODAS/HUAICO/LAPRIDA del header) desde
// la cookie `kp_sucursal_id`, del lado del cliente. Devuelve '' cuando la vista
// activa es "Todas" o no hay cookie todavía.
//
// Sirve para que los formularios de alta (ventas, compras/cargas de productos,
// pagos, cheques, etc.) arranquen con la sucursal que el usuario tiene elegida
// arriba, en vez de forzar siempre Laprida.
export function getSucursalActivaCliente(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)kp_sucursal_id=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

// Igual que arriba pero validando contra la lista de sucursales disponibles y
// con fallback a Laprida (o la primera) cuando la activa es "Todas" / no existe.
// Úsese como valor por defecto de los selectores de sucursal en los formularios.
export function sucursalPorDefecto(
  sucursales: { id: string; nombre: string }[],
): string {
  const activa = getSucursalActivaCliente();
  if (activa && sucursales.some(s => s.id === activa)) return activa;
  return (
    sucursales.find(s => /laprida/i.test(s.nombre))?.id ??
    sucursales[0]?.id ??
    ''
  );
}
