'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useRef, useState } from 'react';

type Categoria = { id: string; nombre: string };

export default function FiltrosArticulos({
  categorias,
  stockBajoActivo = false,
}: {
  categorias: Categoria[];
  stockBajoActivo?: boolean;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const timer    = useRef<ReturnType<typeof setTimeout>>();

  const [q, setQ] = useState(params.get('q') || '');

  const push = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    next.delete('offset');
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  const handleQ = (val: string) => {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: val }), 300);
  };

  const activo = params.get('activo') || 'true';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Chip stock bajo activo */}
      {stockBajoActivo && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-semibold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Stock bajo
          <button
            onClick={() => push({ stock_bajo: '' })}
            className="ml-0.5 hover:text-amber-200 transition-colors"
            aria-label="Quitar filtro de stock bajo"
          >✕</button>
        </div>
      )}
      {/* Búsqueda */}
      <div className="relative flex-1 min-w-52">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray w-4 h-4 pointer-events-none"
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={e => handleQ(e.target.value)}
          placeholder="Buscar por nombre o código..."
          className="w-full bg-kp-surface border border-kp-border rounded-lg pl-9 pr-4 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
        />
        {q && (
          <button
            onClick={() => handleQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray hover:text-kp-white transition-colors text-xs"
          >✕</button>
        )}
      </div>

      {/* Categorías */}
      <select
        value={params.get('categoria_id') || ''}
        onChange={e => push({ categoria_id: e.target.value })}
        className="bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors cursor-pointer"
      >
        <option value="">Todas las categorías</option>
        {categorias.map(c => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>

      {/* Toggle activo */}
      <div className="flex rounded-lg overflow-hidden border border-kp-border text-xs font-semibold">
        {(['true', 'all', 'false'] as const).map(val => {
          const labels = { true: 'Activos', all: 'Todos', false: 'Inactivos' } as const;
          const isOn = activo === val;
          return (
            <button
              key={val}
              onClick={() => push({ activo: val })}
              className={`px-3 py-2 transition-colors ${
                isOn
                  ? 'bg-kp-red text-kp-white'
                  : 'bg-kp-surface text-kp-gray hover:text-kp-white'
              }`}
            >
              {labels[val]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
