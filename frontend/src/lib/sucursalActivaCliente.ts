'use client';

import { useEffect, useState } from 'react';

// Nombre del evento que dispara el selector del header (SucursalSelector) cuando
// el usuario cambia de sucursal. Sirve para avisarle a todos los desplegables de
// sucursal de los formularios, que viven en componentes cliente que NO se
// remontan con el router.refresh del selector.
export const SUCURSAL_EVENT = 'kp-sucursal-change';

// Lee la sucursal activa (la del selector TODAS/HUAICO/LAPRIDA del header) desde
// la cookie `kp_sucursal_id`, del lado del cliente. Devuelve '' cuando la vista
// activa es "Todas" o no hay cookie todavía.
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

// Hook reactivo: devuelve el id de la sucursal activa del header y se actualiza
// solo cuando cambia (evento del selector, cookie compartida entre pestañas, o
// al volver el foco a la pestaña). '' = vista "Todas".
export function useSucursalActiva(): string {
  const [id, setId] = useState<string>('');

  useEffect(() => {
    setId(getSucursalActivaCliente());
    const sync = () => setId(getSucursalActivaCliente());
    window.addEventListener(SUCURSAL_EVENT, sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(SUCURSAL_EVENT, sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return id;
}
