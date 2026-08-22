'use client';

import { useEffect } from 'react';

/**
 * Bloquea el scroll del documento mientras hay un overlay abierto.
 *
 * Dos detalles que la version ingenua (`body.style.overflow = 'hidden'`) no
 * resuelve y que este modulo si:
 *
 *  1. ANIDAMIENTO. El contador vive a nivel de modulo, no del componente. Si se
 *     abre una confirmacion dentro de un modal y se la cierra, el fondo tiene
 *     que seguir bloqueado: solo se libera cuando el contador vuelve a 0.
 *
 *  2. iOS. Safari ignora `overflow: hidden` en el body y sigue scrolleando por
 *     debajo. La unica tecnica confiable es fijar el body con `position: fixed`
 *     desplazado por el scroll actual, y restaurar la posicion exacta al soltar
 *     (si no, la pagina salta al tope al cerrar cualquier modal).
 */

let lockCount = 0;
let savedScrollY = 0;
let savedStyles: Partial<CSSStyleDeclaration> = {};

function lock() {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  if (lockCount > 1) return; // ya estaba bloqueado por un overlay de mas abajo

  const { body } = document;
  savedScrollY = window.scrollY;
  savedStyles = {
    position: body.style.position,
    top:      body.style.top,
    left:     body.style.left,
    right:    body.style.right,
    width:    body.style.width,
    overflow: body.style.overflow,
  };

  body.style.position = 'fixed';
  body.style.top      = `-${savedScrollY}px`;
  body.style.left     = '0';
  body.style.right    = '0';
  body.style.width    = '100%';
  body.style.overflow = 'hidden';
}

function unlock() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return; // todavia queda algun overlay abierto

  const { body } = document;
  body.style.position = savedStyles.position ?? '';
  body.style.top      = savedStyles.top      ?? '';
  body.style.left     = savedStyles.left     ?? '';
  body.style.right    = savedStyles.right    ?? '';
  body.style.width    = savedStyles.width    ?? '';
  body.style.overflow = savedStyles.overflow ?? '';

  // Restaurar la posicion exacta previa, sin animacion.
  window.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior });
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
