import { cookies } from 'next/headers';

// Retorna el sucursal_id activo (UUID) o '' si es vista "Todas".
// En fase-2 este helper también validará permisos del usuario JWT.
export function getSucursalActivaId(): string {
  return cookies().get('kp_sucursal_id')?.value ?? '';
}
