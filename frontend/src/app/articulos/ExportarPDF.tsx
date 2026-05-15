'use client';

import { useEffect, useRef, useState } from 'react';

type Categoria = { id: string; nombre: string; margen_default: string };

export default function ExportarPDF({ categorias }: { categorias: Categoria[] }) {
  const [open, setOpen]           = useState(false);
  const [global, setGlobal]       = useState(0);
  const [porCat, setPorCat]       = useState(false);
  const [descCats, setDescCats]   = useState<Record<string, number>>({});
  const panelRef                  = useRef<HTMLDivElement>(null);
  const apiBase                   = process.env.NEXT_PUBLIC_API_URL || '';

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setCatDesc = (id: string, val: number) =>
    setDescCats(prev => ({ ...prev, [id]: Math.max(0, Math.min(100, val)) }));

  const generar = () => {
    const parts: string[] = [];
    if (global > 0) parts.push(`descuento=${global}`);
    if (porCat) {
      const cats = Object.entries(descCats)
        .filter(([, v]) => v > 0)
        .map(([id, v]) => `${id}:${v}`)
        .join(',');
      if (cats) parts.push(`desc_cats=${cats}`);
    }
    const qs = parts.length ? `?${parts.join('&')}` : '';
    window.open(`${apiBase}/api/articulos/pdf-precios${qs}`, '_blank');
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-kp-red hover:bg-kp-red-dark text-kp-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0-3-3m3 3 3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3M16 6l-4-4-4 4" />
        </svg>
        Exportar PDF
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-kp-surface border border-kp-border rounded-xl shadow-2xl shadow-black/60 z-20 p-5">
          <h3 className="text-sm font-bold text-kp-white mb-4 flex items-center gap-2">
            <span className="w-1 h-4 bg-kp-red rounded-full block" />
            Lista de Precios — PDF
          </h3>

          {/* Descuento global */}
          <label className="block text-xs text-kp-gray mb-1 uppercase tracking-wide">
            Descuento global (%)
          </label>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="number" min={0} max={100} step={0.5}
              value={global}
              onChange={e => setGlobal(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-24 bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5 text-sm text-kp-white focus:outline-none focus:border-kp-red"
            />
            <span className="text-xs text-kp-gray">
              {global > 0 ? `−${global}% sobre todos los precios` : 'Sin descuento'}
            </span>
          </div>

          {/* Por categoría */}
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={porCat}
              onChange={e => setPorCat(e.target.checked)}
              className="accent-kp-red w-3.5 h-3.5"
            />
            <span className="text-xs text-kp-gray-lt">Descuento por categoría</span>
          </label>

          {porCat && (
            <div className="space-y-2 mb-4 max-h-44 overflow-y-auto pr-1">
              {categorias.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-kp-gray-lt truncate flex-1">{c.nombre}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={descCats[c.id] ?? 0}
                      onChange={e => setCatDesc(c.id, Number(e.target.value))}
                      className="w-16 bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-xs text-kp-white focus:outline-none focus:border-kp-red"
                    />
                    <span className="text-xs text-kp-gray">%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1 border-t border-kp-border">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 text-xs py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={generar}
              className="flex-1 text-xs py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark text-kp-white font-semibold transition-colors"
            >
              Generar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
