'use client';

import { useSyncExternalStore } from 'react';

/**
 * Media query reactiva, segura para el SSR del App Router.
 *
 * `getServerSnapshot` devuelve siempre `false`, asi que el HTML del servidor y
 * la primera pintura del cliente coinciden (sin hydration mismatch) y recien
 * despues React re-renderiza con el valor real.
 *
 * IMPORTANTE — preferir SIEMPRE CSS (`md:hidden`, `hidden md:block`) para
 * mostrar u ocultar contenido. Este hook es solo para lo que CSS no puede
 * resolver: elegir la variante de un componente, decidir si montar listeners,
 * etc. Si se usa para ocultar contenido habra un parpadeo en la primera
 * pintura, porque el servidor siempre asume `false`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => {
      if (typeof window === 'undefined' || !window.matchMedia) return false;
      return window.matchMedia(query).matches;
    },
    () => false,
  );
}

/** `true` por debajo del breakpoint `md` (768px), el corte del diseno mobile. */
export const useIsMobile = () => !useMediaQuery('(min-width: 768px)');

/** `true` en dispositivos tactiles (sin hover fino). */
export const useIsTouch = () => useMediaQuery('(pointer: coarse)');
