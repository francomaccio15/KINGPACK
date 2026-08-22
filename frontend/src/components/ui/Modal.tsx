'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/ui';
import { useScrollLock } from '@/lib/useScrollLock';

/**
 * Modal unico del sistema.
 * ══════════════════════════════════════════════════════════════════════════
 *
 *  · MOBILE  → bottom-sheet: pegado abajo, ancho completo, esquinas superiores
 *              redondeadas, handle visual, alto maximo 92dvh.
 *  · DESKTOP → dialogo centrado, identico a los ~42 modales que habia escritos
 *              a mano en cada pantalla.
 *
 * Resuelve de una sola vez lo que ninguno de esos modales hacia: portal (para
 * no quedar recortado por contenedores con overflow), bloqueo del scroll de
 * fondo, cierre con Escape respetando el anidamiento, foco inicial y trap,
 * semantica ARIA, safe-area del home indicator y print:hidden.
 *
 * El footer usa flex-col-reverse en mobile: por eso los botones se escriben
 * SIEMPRE en el orden [secundaria, primaria] y la primaria termina arriba en el
 * telefono y a la derecha en escritorio.
 */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ModalVariant = 'auto' | 'sheet' | 'center';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Contenido extra en la cabecera, a la izquierda del boton de cerrar. */
  headerRight?: React.ReactNode;
  /** Barra de acciones fija al pie. Orden: [secundaria, primaria]. */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** auto (default) = sheet en mobile, centrado en escritorio. */
  variant?: ModalVariant;
  /** form conserva el submit nativo con Enter. */
  as?: 'div' | 'form';
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  /** Elemento a enfocar al abrir. En mobile evitar inputs: abren el teclado. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  hideCloseButton?: boolean;
  bodyClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}

const SIZE: Record<ModalSize, string> = {
  sm:   'md:max-w-md',
  md:   'md:max-w-lg',
  lg:   'md:max-w-2xl',
  xl:   'md:max-w-4xl',
  // full ocupa toda la pantalla del telefono (es el modo del POS).
  full: 'md:max-w-7xl md:h-[90dvh] h-[100dvh] rounded-none md:rounded-2xl',
};

/* Pila de modales abiertos: solo el ultimo responde a Escape. */
const escStack: Array<() => void> = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  footer,
  size = 'md',
  variant = 'auto',
  as = 'div',
  onSubmit,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  hideCloseButton = false,
  bodyClassName,
  panelClassName,
  children,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef   = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId    = useId();

  useEffect(() => setMounted(true), []);
  useScrollLock(open);

  /* ── Escape (solo el modal del tope de la pila) ── */
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    escStack.push(onClose);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (escStack[escStack.length - 1] !== onClose) return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = escStack.lastIndexOf(onClose);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [open, closeOnEscape, onClose]);

  /* ── Foco: al abrir entra al panel, al cerrar vuelve a donde estaba ── */
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const t = setTimeout(() => {
      // Sin initialFocusRef se enfoca el panel, no el primer input: en mobile
      // enfocar un campo levanta el teclado y tapa medio sheet apenas abre.
      (initialFocusRef?.current ?? panelRef.current)?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  /* ── Focus trap ── */
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) return;

    const first = items[0];
    const last  = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!mounted || !open) return null;

  const isSheet  = variant !== 'center';
  const isCenter = variant !== 'sheet';

  const overlayCls = cn(
    'fixed inset-0 z-modal bg-black/70 backdrop-blur-sm flex justify-center overscroll-contain print:hidden',
    isSheet ? 'items-end' : 'items-center',
    isCenter && 'md:items-center md:p-4',
    variant === 'center' && 'p-4',
  );

  const panelCls = cn(
    'relative w-full bg-kp-surface border border-kp-border shadow-2xl shadow-black/60',
    'flex flex-col overflow-hidden focus:outline-none',
    isSheet && 'rounded-t-2xl animate-sheet-in',
    isCenter && 'md:rounded-2xl md:animate-fade-in',
    variant === 'center' && 'rounded-2xl animate-fade-in',
    size !== 'full' && 'max-h-[92dvh] md:max-h-[90dvh]',
    SIZE[size],
    panelClassName,
  );

  const Panel = (as === 'form' ? 'form' : 'div') as React.ElementType;
  const panelProps: Record<string, unknown> = as === 'form' ? { onSubmit } : {};

  const node = (
    <div
      className={overlayCls}
      onMouseDown={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <Panel
        {...panelProps}
        ref={panelRef as never}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={panelCls}
      >
        {/* Handle del sheet: senal visual de que se cierra hacia abajo */}
        {isSheet && (
          <div className={cn('mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-kp-border shrink-0', isCenter && 'md:hidden')} />
        )}

        {(title || headerRight || !hideCloseButton) && (
          <div className="shrink-0 flex items-start justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-kp-border">
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="text-sm md:text-base font-bold uppercase tracking-wide text-kp-white truncate">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-2xs md:text-xs text-kp-gray mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {headerRight}
              {!hideCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="inline-flex items-center justify-center rounded-lg text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors w-10 h-10 md:w-8 md:h-8 -mr-1"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-5 h-5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className={cn('flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 py-4 md:py-5 space-y-4', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-kp-border bg-kp-surface px-4 md:px-6 py-3 pb-safe md:pb-3 flex flex-col-reverse md:flex-row md:justify-end gap-2">
            {footer}
          </div>
        )}
      </Panel>
    </div>
  );

  return createPortal(node, document.body);
}
