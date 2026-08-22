import type { AuthUser } from './auth';

type Rol = AuthUser['rol'];

/**
 * Mapa de acceso por rol.
 * '*'      → acceso total
 * string[] → lista de módulos permitidos (prefijos de href)
 *
 * Para agregar acceso a un rol: añadir el href del módulo al array.
 * Ej: supervisor: ['/ventas', '/clientes']
 */
const PERMISOS: Record<Rol, string[] | '*'> = {
  administrador: '*',
  supervisor:    ['/empleados', '/clientes', '/cobranzas', '/ventas', '/presupuestos', '/articulos', '/categorias', '/dashboard', '/pedidos-proveedores', '/traspasos', '/reportes', '/cheques', '/trazabilidad'],
  cajero:        ['/caja', '/ventas', '/presupuestos', '/clientes', '/cobranzas', '/notas', '/notas-credito', '/devoluciones', '/pedidos-proveedores', '/traspasos', '/articulos'],
  // Repartidor: arma presupuestos (preventas) y consulta productos. No opera caja ni cobra.
  vendedor:      ['/presupuestos', '/articulos'],
};

/**
 * Devuelve true si el rol puede acceder al módulo dado su href.
 *
 * `sucursalNombre` habilita reglas que dependen de la sucursal del usuario.
 * Regla especial: /licitaciones lo ven los administradores y, entre los
 * cajeros, SOLO el de Laprida.
 */
export function puedeAcceder(rol: Rol, href: string, sucursalNombre?: string | null): boolean {
  const path = href.split('?')[0]; // ignorar query params al chequear permisos

  // /licitaciones: admin siempre; cajero solo si su sucursal es Laprida.
  if (path === '/licitaciones' || path.startsWith('/licitaciones/')) {
    if (rol === 'administrador') return true;
    return rol === 'cajero' && /laprida/i.test(sucursalNombre ?? '');
  }

  const p = PERMISOS[rol];
  if (p === '*') return true;
  return p.some(m => path === m || path.startsWith(m + '/'));
}

/** Devuelve la lista de hrefs permitidos (o '*' para admin). */
export function modulosPermitidos(rol: Rol): string[] | '*' {
  return PERMISOS[rol];
}

/**
 * Pantalla inicial según el rol. El cajero opera en ventas y el repartidor
 * (vendedor) en presupuestos; ninguno tiene acceso al dashboard. El resto va
 * al dashboard.
 */
export function landingPath(rol: Rol): string {
  if (rol === 'cajero')   return '/ventas';
  if (rol === 'vendedor') return '/presupuestos';
  return '/dashboard';
}
