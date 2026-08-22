'use client';

import { Children, cloneElement, isValidElement } from 'react';
import Link from 'next/link';
import { badgeCls, cn, type Tone } from '@/lib/ui';

/**
 * Patron de tablas responsive — KingPack
 * ══════════════════════════════════════════════════════════════════════════
 *
 * En escritorio se conserva la tabla tal cual esta hoy; en mobile se reemplaza
 * por una lista de tarjetas. Se descarto un <DataTable> generico dirigido por
 * definicion de columnas porque contra las tablas reales del sistema no sirve:
 * varias tienen filas expandibles con sub-tabla, inputs editables inline y
 * filas colSpan de loading/vacio/totales. Con cell: (row) => JSX en media
 * columna la abstraccion no aporta y obliga a reescribir las 70 tablas.
 *
 * La consistencia visual se garantiza igual, porque el render mobile NO es
 * libre: es siempre <RecordCard>, con una anatomia fija.
 *
 * Uso:
 *
 *   <TableWrap>
 *     <table>...la tabla actual, intacta...</table>
 *   </TableWrap>
 *   <MobileCards>
 *     {rows.map(r => <RecordCard key={r.id} title={...} fields={[...]} />)}
 *   </MobileCards>
 */

/* ── Contenedor de la tabla (escritorio) ──────────────────────────────────── */

export interface TableWrapProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Muestra la tabla tambien en mobile, con scroll horizontal.
   * Reservado para matrices que no tienen forma de tarjeta: Libro IVA, posicion
   * de IVA, resumen de cheques emitidos. Acompanar con <TableScrollHint />.
   */
  scrollable?: boolean;
}

export function TableWrap({ children, className, scrollable = false }: TableWrapProps) {
  // Marca la <table> con data-rt="1" para excluirla del parche global de
  // globals.css, que sigue vigente solo para las tablas todavia no migradas.
  const marked = Children.map(children, (child) =>
    isValidElement(child) && child.type === 'table'
      ? cloneElement(child as React.ReactElement<Record<string, unknown>>, { 'data-rt': '1' })
      : child,
  );

  return (
    <div
      className={cn(
        // print:block es obligatorio: sin el, la impresion sale vacia porque el
        // bloque de tarjetas es mobile-only y la tabla quedaria oculta.
        scrollable ? 'block' : 'hidden md:block print:block',
        'overflow-x-auto rounded-xl border border-kp-border',
        className,
      )}
    >
      {marked}
    </div>
  );
}

/** Aviso de scroll lateral. Solo para las tablas con scrollable. */
export function TableScrollHint({ className }: { className?: string }) {
  return (
    <p className={cn('md:hidden print:hidden text-2xs text-kp-gray flex items-center gap-1 mb-1.5', className)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-3.5 h-3.5">
        <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />
      </svg>
      Desliza para ver todas las columnas
    </p>
  );
}

/* ── Contenedor de tarjetas (mobile) ──────────────────────────────────────── */

export function MobileCards({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('md:hidden print:hidden space-y-2', className)}>{children}</div>;
}

/* ── Tarjeta de registro ──────────────────────────────────────────────────── */

export interface CardField {
  label: string;
  value: React.ReactNode;
  align?: 'left' | 'right';
  /** Resalta el dato: usar para el numero que importa (total, saldo, stock). */
  strong?: boolean;
}

export interface RecordCardProps {
  /** Identidad del registro: numero de comprobante, nombre, codigo. */
  title: React.ReactNode;
  /** Una linea de contexto: fecha, sucursal, categoria. */
  subtitle?: React.ReactNode;
  badge?: { label: string; tone?: Tone };
  /** Maximo 4. Mas que eso deja de ser una tarjeta y hay que ir al detalle. */
  fields?: CardField[];
  /** Si se pasa, toda la tarjeta navega. */
  href?: string;
  onClick?: () => void;
  /** Botones al pie, separados por un borde. */
  actions?: React.ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  /** Contenido revelado al expandir (items del pedido, detalle de la venta). */
  children?: React.ReactNode;
  className?: string;
}

export function RecordCard({
  title,
  subtitle,
  badge,
  fields,
  href,
  onClick,
  actions,
  expandable = false,
  expanded = false,
  onToggle,
  children,
  className,
}: RecordCardProps) {
  const head = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-kp-white truncate">{title}</p>
          {subtitle && <p className="text-2xs text-kp-gray mt-0.5 truncate">{subtitle}</p>}
        </div>
        {badge && <span className={badgeCls(badge.tone)}>{badge.label}</span>}
      </div>

      {fields && fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5">
          {fields.map((f, i) => (
            <div key={i} className={cn('min-w-0', f.align === 'right' && 'text-right')}>
              <p className="text-2xs text-kp-gray uppercase tracking-wide truncate">{f.label}</p>
              <p className={cn('text-sm tabular-nums truncate', f.strong ? 'font-semibold text-kp-white' : 'text-kp-gray-lt')}>
                {f.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const base = cn('rounded-xl border border-kp-border bg-kp-surface p-3 block w-full text-left', className);

  return (
    <article className={cn(base, (href || onClick) && 'active:bg-kp-surface2 transition-colors')}>
      {href ? (
        <Link href={href} className="block">{head}</Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className="block w-full text-left">{head}</button>
      ) : (
        head
      )}

      {expandable && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="mt-2 flex items-center gap-1 text-2xs font-semibold uppercase tracking-widest text-kp-gray hover:text-kp-white min-h-touch"
        >
          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
            className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {expandable && expanded && children && (
        <div className="mt-2 pt-2 border-t border-kp-border space-y-2">{children}</div>
      )}

      {actions && (
        <div className="mt-3 pt-2 border-t border-kp-border flex items-center gap-2">{actions}</div>
      )}
    </article>
  );
}

/* ── Estado vacio ─────────────────────────────────────────────────────────── */

export function EmptyState({
  title,
  hint,
  icon,
  action,
  className,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-dashed border-kp-border py-10 px-4 text-center', className)}>
      {icon && <div className="flex justify-center text-kp-border mb-3">{icon}</div>}
      <p className="text-sm text-kp-gray">{title}</p>
      {hint && <p className="text-2xs text-kp-gray/70 mt-1">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
