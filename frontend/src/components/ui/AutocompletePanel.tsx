'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/ui';

/**
 * Panel flotante para buscadores y autocompletes.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Los dropdowns del sistema son `absolute` dentro del contenedor del input.
 * El problema real en mobile no es el ancho (ya son w-full) sino:
 *
 *   1. Quedan RECORTADOS por ancestros con overflow-hidden — el caso del POS,
 *      donde el panel de resultados vive dentro de un contenedor con scroll.
 *   2. El teclado virtual los tapa: si el input esta en la mitad inferior de la
 *      pantalla, la lista aparece justo debajo del teclado.
 *
 * Este componente se renderiza en un portal con position: fixed anclado al
 * rectangulo del input, y se da vuelta hacia arriba cuando no hay lugar abajo.
 * Se reposiciona con scroll, resize y visualViewport.resize (este ultimo es el
 * evento que dispara la apertura y el cierre del teclado virtual).
 *
 * No maneja la seleccion: los handlers de teclado/click siguen viviendo en la
 * pantalla. Aca solo cambia el contenedor.
 */

export interface AutocompletePanelProps {
  /** Input (o su contenedor) al que se ancla el panel. */
  anchorRef: React.RefObject<HTMLElement>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Alto maximo como porcentaje del viewport. */
  maxHeightVh?: number;
  className?: string;
  /** Elementos que no deben disparar el cierre al hacer click (ej. un boton). */
  ignoreRef?: React.RefObject<HTMLElement>;
}

interface Pos { top: number; left: number; width: number; maxHeight: number; }

const GAP = 4;
const MIN_SPACE_BELOW = 180;

export default function AutocompletePanel({
  anchorRef,
  open,
  onClose,
  children,
  maxHeightVh = 45,
  className,
  ignoreRef,
}: AutocompletePanelProps) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // visualViewport refleja el area realmente visible con el teclado abierto;
    // window.innerHeight no se entera de que el teclado ocupa media pantalla.
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const cap = (vh * maxHeightVh) / 100;

    const below = vh - rect.bottom - GAP;
    const above = rect.top - GAP;
    // Si abajo no entra nada util pero arriba hay mas lugar, se da vuelta.
    const flip = below < MIN_SPACE_BELOW && above > below;

    setPos({
      top:   flip ? Math.max(GAP, rect.top - GAP - Math.min(cap, above)) : rect.bottom + GAP,
      left:  rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(cap, flip ? above : below)),
    });
  }, [anchorRef, maxHeightVh]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = () => reposition();
    // capture: true para captar tambien el scroll de contenedores internos.
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    window.visualViewport?.addEventListener('resize', onScrollOrResize);
    window.visualViewport?.addEventListener('scroll', onScrollOrResize);

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      if (ignoreRef?.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.visualViewport?.removeEventListener('resize', onScrollOrResize);
      window.visualViewport?.removeEventListener('scroll', onScrollOrResize);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, reposition, onClose, anchorRef, ignoreRef]);

  if (!mounted || !open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
      className={cn(
        'fixed z-pop rounded-xl border border-kp-border bg-kp-surface shadow-2xl shadow-black/60',
        'overflow-y-auto overscroll-contain print:hidden',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Fila de resultado. Alto minimo tactil y dos lineas de texto, para no repetir
 * el mismo markup en los 12 buscadores del sistema.
 */
export function AutocompleteItem({
  active = false,
  onSelect,
  children,
  className,
}: {
  active?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      // onMouseDown, no onClick: el click llega despues del blur del input y
      // para entonces el panel ya se cerro.
      onMouseDown={(e) => { e.preventDefault(); onSelect(); }}
      className={cn(
        'w-full text-left px-3 py-2.5 min-h-[48px] border-b border-kp-border/50 last:border-b-0',
        'transition-colors',
        active ? 'bg-kp-red/10' : 'hover:bg-kp-surface2',
        className,
      )}
    >
      {children}
    </button>
  );
}
