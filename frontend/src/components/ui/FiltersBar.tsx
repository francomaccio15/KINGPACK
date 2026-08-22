'use client';

import { useState } from 'react';
import Modal from './Modal';
import { btnFullMobile, btnPrimary, btnSecondary, cn } from '@/lib/ui';

/**
 * Barra de filtros de un listado.
 *
 * En escritorio los filtros van inline, como siempre. En mobile no entran: se
 * reemplazan por un boton "Filtros" con la cantidad de filtros activos, y los
 * mismos controles se muestran apilados dentro de un sheet.
 *
 * Los filtros del sistema escriben en la URL y se aplican al instante, asi que
 * el sheet no necesita un boton "Aplicar": alcanza con "Listo" para cerrarlo.
 *
 * Uso:
 *   <FiltersBar activos={n} onLimpiar={limpiar}>
 *     ...los mismos inputs de siempre...
 *   </FiltersBar>
 *
 * Los hijos deben ser mobile-first (w-full y, si hace falta, md:w-auto): dentro
 * del sheet se apilan en una columna.
 */
export function FiltersBar({
  children,
  activos = 0,
  onLimpiar,
  /** Control que queda SIEMPRE visible en mobile, tipicamente el buscador. */
  alwaysVisible,
  className,
}: {
  children: React.ReactNode;
  activos?: number;
  onLimpiar?: () => void;
  alwaysVisible?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Mobile ── */}
      <div className="md:hidden print:hidden flex items-center gap-2">
        {alwaysVisible && <div className="flex-1 min-w-0">{alwaysVisible}</div>}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(btnSecondary, !alwaysVisible && 'flex-1', 'relative')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-4 h-4">
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
          Filtros
          {activos > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-kp-red text-white text-2xs font-bold">
              {activos}
            </span>
          )}
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Filtros"
        size="md"
        footer={
          <>
            {onLimpiar && (
              <button
                type="button"
                onClick={() => { onLimpiar(); setOpen(false); }}
                className={cn(btnSecondary, btnFullMobile)}
              >
                Limpiar
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className={cn(btnPrimary, btnFullMobile)}>
              Listo
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">{children}</div>
      </Modal>

      {/* ── Escritorio ── */}
      <div className={cn('hidden md:flex flex-wrap items-center gap-3 print:hidden', className)}>
        {alwaysVisible}
        {children}
        {activos > 0 && onLimpiar && (
          <button
            type="button"
            onClick={onLimpiar}
            className="px-3 py-2 rounded-lg text-xs text-kp-gray hover:text-kp-white border border-transparent hover:border-kp-border transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
    </>
  );
}

export default FiltersBar;
