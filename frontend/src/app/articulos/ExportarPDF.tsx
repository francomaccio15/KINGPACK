'use client';

import { useEffect, useRef, useState } from 'react';

type Lista     = { id: string; nombre: string; tipo: string; descuento_base_pct: string };
type Categoria = { id: string; nombre: string };

const TIPO_LABEL: Record<string, string> = {
  madre:            'Precio Base',
  publica:          'Precio Público',
  revendedor:       'Lista Reventa',
  cuenta_corriente: 'Cuenta Corriente',
};

export default function ExportarPDF({
  listas,
  categorias,
}: {
  listas: Lista[];
  categorias: Categoria[];
}) {
  const [open, setOpen]         = useState(false);
  const [listaId, setListaId]   = useState(listas[0]?.id ?? '');
  const [descuento, setDescuento] = useState(0);
  const [porCat, setPorCat]     = useState(false);
  const [descCats, setDescCats] = useState<Record<string, number>>({});
  const panelRef                = useRef<HTMLDivElement>(null);
  const apiBase                 = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sincronizar listId cuando llegan las listas
  useEffect(() => {
    if (!listaId && listas.length) setListaId(listas[0].id);
  }, [listas]);

  const setCatDesc = (id: string, val: number) =>
    setDescCats(prev => ({ ...prev, [id]: Math.max(0, Math.min(100, val)) }));

  const generar = () => {
    const parts: string[] = [];
    if (listaId)    parts.push(`lista_id=${listaId}`);
    if (descuento > 0) parts.push(`descuento=${descuento}`);
    if (porCat) {
      const cats = Object.entries(descCats)
        .filter(([, v]) => v > 0)
        .map(([id, v]) => `${id}:${v}`)
        .join(',');
      if (cats) parts.push(`desc_cats=${cats}`);
    }
    window.open(`${apiBase}/api/articulos/pdf-precios${parts.length ? '?' + parts.join('&') : ''}`, '_blank');
    setOpen(false);
  };

  const listaSeleccionada = listas.find(l => l.id === listaId);

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
        <div className="absolute right-0 top-full mt-2 w-80 bg-kp-surface border border-kp-border rounded-xl shadow-2xl shadow-black/60 z-20 p-5 space-y-4">

          <h3 className="text-sm font-bold text-kp-white flex items-center gap-2">
            <span className="w-1 h-4 bg-kp-red rounded-full block" />
            Exportar lista de precios
          </h3>

          {/* Selector de lista */}
          <div>
            <label className="block text-xs text-kp-gray mb-1 uppercase tracking-wide">
              Lista de precios
            </label>
            <select
              value={listaId}
              onChange={e => setListaId(e.target.value)}
              className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red cursor-pointer"
            >
              {listas.map(l => (
                <option key={l.id} value={l.id}>
                  {TIPO_LABEL[l.tipo] ?? l.nombre}
                  {parseFloat(l.descuento_base_pct) > 0 ? ` (−${parseFloat(l.descuento_base_pct).toFixed(0)}%)` : ''}
                </option>
              ))}
            </select>
            {listaSeleccionada && parseFloat(listaSeleccionada.descuento_base_pct) > 0 && (
              <p className="text-[11px] text-kp-gray mt-1">
                Incluye {parseFloat(listaSeleccionada.descuento_base_pct).toFixed(0)}% de descuento sobre precio base.
              </p>
            )}
          </div>

          {/* Descuento adicional */}
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
                {descuento > 0 ? `−${descuento}% sobre precios de lista` : 'Sin descuento extra'}
              </span>
            </div>
          </div>

          {/* Descuento por categoría */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={porCat}
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

          {/* Acciones */}
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
