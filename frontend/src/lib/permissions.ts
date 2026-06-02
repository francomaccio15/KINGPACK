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
  supervisor:    ['/empleados', '/clientes', '/ventas', '/articulos', '/categorias', '/dashboard'],
  cajero:        ['/caja', '/ventas', '/clientes', '/notas', '/notas-credito'],
  vendedor:      [],   // definir más adelante
};

/** Devuelve true si el rol puede acceder al módulo dado su href. */
export function puedeAcceder(rol: Rol, href: string): boolean {
  const p = PERMISOS[rol];
  if (p === '*') return true;
  return p.some(m => href === m || href.startsWith(m + '/'));
}

/** Devuelve la lista de hrefs permitidos (o '*' para admin). */
export function modulosPermitidos(rol: Rol): string[] | '*' {
  return PERMISOS[rol];
}
