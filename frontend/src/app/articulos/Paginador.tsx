'use client';

import Link from 'next/link';

interface Props {
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  searchParams: Record<string, string>;
}

function buildHref(searchParams: Record<string, string>, page: number) {
  const qs = new URLSearchParams({ ...searchParams, page: String(page) });
  return `/articulos?${qs.toString()}`;
}

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export default function Paginador({ page, totalPages, count, pageSize, searchParams }: Props) {
  if (totalPages <= 1) return null;

  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, count);

  const btnBase = 'h-8 min-w-[32px] px-2 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors';
  const btnActivo = 'bg-kp-red text-white';
  const btnNormal = 'bg-kp-surface2 border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-border/60';
  const btnDisabled = 'bg-kp-surface2 border border-kp-border/30 text-kp-border cursor-not-allowed pointer-events-none';

  const pages = pageNumbers(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-2">
      {/* Info */}
      <p className="text-xs text-kp-gray order-2 sm:order-1">
        Mostrando <span className="text-kp-white font-semibold">{desde}–{hasta}</span> de{' '}
        <span className="text-kp-white font-semibold">{count}</span> artículos
      </p>

      {/* Controles */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* Anterior */}
        {page <= 1 ? (
          <span className={`${btnBase} ${btnDisabled}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </span>
        ) : (
          <Link href={buildHref(searchParams, page - 1)} className={`${btnBase} ${btnNormal}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        )}

        {/* Números */}
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className={`${btnBase} text-kp-gray`}>…</span>
          ) : (
            <Link
              key={p}
              href={buildHref(searchParams, p)}
              className={`${btnBase} ${p === page ? btnActivo : btnNormal}`}
            >
              {p}
            </Link>
          )
        )}

        {/* Siguiente */}
        {page >= totalPages ? (
          <span className={`${btnBase} ${btnDisabled}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        ) : (
          <Link href={buildHref(searchParams, page + 1)} className={`${btnBase} ${btnNormal}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
