'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;

type Categoria = { id: string; nombre: string };
type Lista     = { id: string; nombre: string; tipo: string };

export default function ExportarPDF({
  lista,
  categorias,
}: {
  lista: Lista;
  categorias: Categoria[];
}) {
  const [open, setOpen]           = useState(false);
  const [descuento, setDescuento] = useState(0);
  const [porCat, setPorCat]       = useState(false);
  const [descCats, setDescCats]   = useState<Record<string, number>>({});
  const [loading, setLoading]     = useState(false);
  const panelRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setCatDesc = (id: string, val: number) =>
    setDescCats(prev => ({ ...prev, [id]: Math.max(0, Math.min(100, val)) }));

  const generar = async () => {
    setLoading(true);
    try {
      const parts = [`lista_id=${lista.id}`];
      if (descuento > 0) parts.push(`descuento=${descuento}`);
      if (porCat) {
        const cats = Object.entries(descCats)
          .filter(([, v]) => v > 0)
          .map(([id, v]) => `${id}:${v}`)
          .join(',');
        if (cats) parts.push(`desc_cats=${cats}`);
      }
      const token = getToken();
      const res = await fetch(`${API}/api/articulos/pdf-precios?${parts.join('&')}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Error al generar PDF');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-kp-red hover:bg-kp-red-dark text-kp-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 10v6m0 0-3-3m3 3 3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3M16 6l-4-4-4 4" />
        </svg>
        Exportar PDF
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-kp-surface border border-kp-border rounded-xl shadow-2xl shadow-black/60 z-20 p-5 space-y-4">
          <h3 className="text-sm font-bold text-kp-white flex items-center gap-2">
            <span className="w-1 h-4 bg-kp-red rounded-full block" />
            Exportar — {lista.nombre}
          </h3>

          <div>
            <label className="block text-xs text-kp-gray mb-1 uppercase tracking-wide">
              Descuento adicional (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={100} step={0.5}
                value={descuento}
                onChange={e => setDescuento(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-24 bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5 text-sm text-kp-white focus:outline-none focus:border-kp-red"
              />
              <span className="text-xs text-kp-gray">
                {descuento > 0 ? `−${descuento}% extra` : 'Sin descuento extra'}
              </span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox" checked={porCat}
                onChange={e => setPorCat(e.target.checked)}
                className="accent-kp-red w-3.5 h-3.5"
              />
              <span className="text-xs text-kp-gray-lt">Descuento por categoría</span>
            </label>

            {porCat && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {categorias.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-kp-gray-lt truncate flex-1">{c.nombre}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
          </div>

          <div className="flex gap-2 pt-1 border-t border-kp-border">
            <button onClick={() => setOpen(false)}
              className="flex-1 text-xs py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white transition-colors">
              Cancelar
            </button>
            <button onClick={generar} disabled={loading}
              className="flex-1 text-xs py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark text-kp-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'Generando...' : 'Generar PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
