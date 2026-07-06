'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, {
    ...o,
    headers: {
      'Content-Type': 'application/json',
      ...(o.headers as Record<string, string> || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: number) => ars.format(v);

type Cliente = { id: string; razon_social: string; cuit: string | null };
type Articulo = { id: string; codigo: string; nombre: string; precio_madre: string };

type Item = {
  articulo_id: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  precio_madre_ref: number;
  precio_licitacion: number;
};

export default function NuevaLicitacion() {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [titulo, setTitulo]           = useState('');
  const [observaciones, setObs]       = useState('');
  const [cliente, setCliente]         = useState<Cliente | null>(null);
  const [clienteQ, setClienteQ]       = useState('');
  const [clienteSugs, setClienteSugs] = useState<Cliente[]>([]);
  const [artQ, setArtQ]               = useState('');
  const [artSugs, setArtSugs]         = useState<Articulo[]>([]);
  const [items, setItems]             = useState<Item[]>([]);

  const clienteTimer = useRef<ReturnType<typeof setTimeout>>();
  const artTimer     = useRef<ReturnType<typeof setTimeout>>();

  // ── Búsqueda de clientes ─────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(clienteTimer.current);
    if (!clienteQ.trim()) { setClienteSugs([]); return; }
    clienteTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`/api/clientes?q=${encodeURIComponent(clienteQ)}&limit=8`);
        const d = await r.json();
        setClienteSugs(d.clientes ?? []);
      } catch { setClienteSugs([]); }
    }, 280);
  }, [clienteQ]);

  // ── Búsqueda de artículos ────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(artTimer.current);
    if (!artQ.trim()) { setArtSugs([]); return; }
    artTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`/api/articulos?q=${encodeURIComponent(artQ)}&limit=12`);
        const d = await r.json();
        setArtSugs(d.articulos ?? []);
      } catch { setArtSugs([]); }
    }, 280);
  }, [artQ]);

  const agregarArticulo = (art: Articulo) => {
    const ya = items.find(it => it.articulo_id === art.id);
    if (ya) { setArtQ(''); setArtSugs([]); return; }
    const pMadre = parseFloat(art.precio_madre) || 0;
    setItems(prev => [...prev, {
      articulo_id:       art.id,
      codigo:            art.codigo,
      nombre:            art.nombre,
      cantidad:          1,
      precio_madre_ref:  pMadre,
      precio_licitacion: pMadre,
    }]);
    setArtQ('');
    setArtSugs([]);
  };

  const setItemField = (idx: number, field: 'cantidad' | 'precio_licitacion', val: string) => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return;
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: n } : it));
  };

  const quitarItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const total = items.reduce((acc, it) => acc + it.cantidad * it.precio_licitacion, 0);

  const cerrar = () => {
    setOpen(false);
    setError('');
    setTitulo('');
    setObs('');
    setCliente(null);
    setClienteQ('');
    setClienteSugs([]);
    setArtQ('');
    setArtSugs([]);
    setItems([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) { setError('Agregá al menos un artículo.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/licitaciones', {
        method: 'POST',
        body: JSON.stringify({
          titulo:        titulo.trim() || null,
          cliente_id:    cliente?.id ?? null,
          observaciones: observaciones.trim() || null,
          items: items.map(it => ({
            articulo_id:       it.articulo_id,
            codigo:            it.codigo,
            nombre:            it.nombre,
            cantidad:          it.cantidad,
            precio_madre_ref:  it.precio_madre_ref,
            precio_licitacion: it.precio_licitacion,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      cerrar();
      router.push(`/licitaciones/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark transition-colors text-white text-sm font-semibold shadow shadow-kp-red/30"
      >
        <span className="text-lg leading-none">+</span> Nueva Licitación
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-3xl bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Nueva Licitación</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">

                {/* Título + Cliente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Título</label>
                    <input
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      placeholder="Ej: Municipalidad — Julio 2026"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Cliente</label>
                    <input
                      value={cliente ? cliente.razon_social : clienteQ}
                      onChange={e => { setCliente(null); setClienteQ(e.target.value); }}
                      placeholder="Buscar cliente..."
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                    {clienteSugs.length > 0 && !cliente && (
                      <ul className="absolute top-full left-0 right-0 z-10 mt-1 bg-kp-surface border border-kp-border rounded-lg overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                        {clienteSugs.map(c => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { setCliente(c); setClienteQ(''); setClienteSugs([]); }}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-kp-surface2 transition-colors"
                            >
                              <span className="font-medium text-kp-white">{c.razon_social}</span>
                              {c.cuit && <span className="ml-2 text-xs text-kp-gray">{c.cuit}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {cliente && (
                      <button
                        type="button"
                        onClick={() => { setCliente(null); setClienteQ(''); }}
                        className="absolute right-2 top-8 text-kp-gray hover:text-kp-white text-sm px-1"
                        title="Quitar cliente"
                      >✕</button>
                    )}
                  </div>
                </div>

                {/* Buscador de artículos */}
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Agregar Artículo</label>
                  <div className="relative">
                    <input
                      value={artQ}
                      onChange={e => setArtQ(e.target.value)}
                      placeholder="Buscar por nombre o código..."
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                    />
                    {artSugs.length > 0 && (
                      <ul className="absolute top-full left-0 right-0 z-10 mt-1 bg-kp-surface border border-kp-border rounded-lg overflow-hidden shadow-xl max-h-64 overflow-y-auto">
                        {artSugs.map(art => (
                          <li key={art.id}>
                            <button
                              type="button"
                              onClick={() => agregarArticulo(art)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-kp-surface2 transition-colors flex items-center justify-between gap-4"
                            >
                              <div>
                                <span className="font-medium text-kp-white">{art.nombre}</span>
                                <span className="ml-2 text-xs text-kp-gray font-mono">{art.codigo}</span>
                              </div>
                              <span className="text-xs text-kp-gray font-mono flex-shrink-0">
                                ref. {fmt(parseFloat(art.precio_madre) || 0)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Tabla de items */}
                {items.length > 0 && (
                  <div className="rounded-xl border border-kp-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-kp-surface2 border-b border-kp-border">
                          <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-widest text-kp-gray">Artículo</th>
                          <th className="text-center px-3 py-2 text-xs font-bold uppercase tracking-widest text-kp-gray w-20">Cant.</th>
                          <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-widest text-kp-gray w-32 hidden sm:table-cell">P. Referencia</th>
                          <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-widest text-kp-gray w-36">P. Licitación</th>
                          <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-widest text-kp-gray w-28">Subtotal</th>
                          <th className="w-8 px-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-kp-border">
                        {items.map((it, i) => (
                          <tr key={it.articulo_id} className="hover:bg-kp-surface2/40">
                            <td className="px-3 py-2">
                              <p className="font-medium text-kp-white text-xs">{it.nombre}</p>
                              <p className="text-kp-gray text-[10px] font-mono">{it.codigo}</p>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="number"
                                min="0.001"
                                step="1"
                                value={it.cantidad}
                                onChange={e => setItemField(i, 'cantidad', e.target.value)}
                                className="w-16 text-center bg-kp-surface border border-kp-border rounded px-1.5 py-1 text-xs text-kp-white focus:outline-none focus:border-kp-red"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-kp-gray font-mono hidden sm:table-cell">
                              {fmt(it.precio_madre_ref)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={it.precio_licitacion}
                                onChange={e => setItemField(i, 'precio_licitacion', e.target.value)}
                                className="w-32 text-right bg-kp-surface border border-kp-red/40 rounded px-1.5 py-1 text-xs text-kp-white focus:outline-none focus:border-kp-red"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-mono font-semibold">
                              {fmt(it.cantidad * it.precio_licitacion)}
                            </td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => quitarItem(i)}
                                className="text-kp-gray hover:text-kp-red transition-colors text-base leading-none"
                                title="Quitar"
                              >✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-kp-border bg-kp-surface2">
                          <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-widest text-kp-gray hidden sm:table-cell">Total</td>
                          <td colSpan={4} className="px-3 py-2.5 text-right text-sm font-bold font-mono sm:hidden">Total</td>
                          <td className="px-3 py-2.5 text-right text-sm font-bold font-mono">{fmt(total)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Observaciones */}
                <div>
                  <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Observaciones</label>
                  <textarea
                    value={observaciones}
                    onChange={e => setObs(e.target.value)}
                    rows={2}
                    placeholder="Condiciones especiales, vigencia, etc."
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-kp-border shrink-0">
                <button
                  type="button"
                  onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white hover:border-kp-gray transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || items.length === 0}
                  className="flex-1 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {loading ? 'Guardando…' : 'Crear Licitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
