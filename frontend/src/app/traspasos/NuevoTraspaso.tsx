'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

type Sucursal = { id: string; nombre: string };
type Articulo = { id: string; nombre: string; codigo: string };

interface LineItem {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
}

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

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-kp-gray" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function NuevoTraspaso({
  sucursales,
  articulos,
  sucursalDefaultId,
}: {
  sucursales: Sucursal[];
  articulos: Articulo[];
  sucursalDefaultId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Origen por defecto: sucursal del usuario, sino Laprida, sino la primera.
  const origenDefault = sucursalDefaultId ?? sucursales.find(s => /laprida/i.test(s.nombre))?.id ?? sucursales[0]?.id ?? '';

  const [origenId, setOrigenId]   = useState(origenDefault);
  const [destinoId, setDestinoId] = useState('');
  const [notas, setNotas]         = useState('');
  const [items, setItems]         = useState<LineItem[]>([]);

  const [artQ, setArtQ]         = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef                 = useRef<HTMLDivElement>(null);

  const artFiltrados = artQ.trim().length === 0
    ? articulos
    : articulos.filter(a =>
        a.nombre.toLowerCase().includes(artQ.toLowerCase()) ||
        a.codigo.toLowerCase().includes(artQ.toLowerCase())
      );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sucursalesDestino = sucursales.filter(s => s.id !== origenId);

  const reset = () => {
    setOrigenId(origenDefault);
    setDestinoId('');
    setNotas('');
    setItems([]);
    setArtQ('');
    setDropOpen(false);
    setSaveError(null);
  };

  const addItem = (art: Articulo) => {
    setItems(prev => {
      const existing = prev.find(i => i.articulo_id === art.id);
      if (existing) {
        return prev.map(i => i.articulo_id === art.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { articulo_id: art.id, nombre: art.nombre, codigo: art.codigo, cantidad: 1 }];
    });
    setArtQ('');
    setDropOpen(false);
  };

  const updateCantidad = (idx: number, value: string) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, cantidad: parseFloat(value) || 0 } : item
    ));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);

  const handleSubmit = async () => {
    if (!origenId)  { setSaveError('Seleccioná una sucursal de origen'); return; }
    if (!destinoId) { setSaveError('Seleccioná una sucursal de destino'); return; }
    if (items.length === 0) { setSaveError('Agregá al menos un artículo'); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch('/api/traspasos', {
        method: 'POST',
        body: JSON.stringify({
          sucursal_origen_id: origenId,
          sucursal_destino_id: destinoId,
          notas: notas || null,
          items: items.map(i => ({ articulo_id: i.articulo_id, cantidad: i.cantidad })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Error al guardar'); return; }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setSaveError('Error de conexión con el servidor');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Nuevo Traspaso
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-surface2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-base font-bold uppercase tracking-wide">Nuevo Traspaso de Stock</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Columna izquierda */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-kp-border">

                {/* Sucursales */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Sucursal Origen *</label>
                    <select
                      value={origenId}
                      onChange={e => { setOrigenId(e.target.value); setDestinoId(''); }}
                      className={inputCls}
                      disabled={!!sucursalDefaultId}
                    >
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Sucursal Destino *</label>
                    <select
                      value={destinoId}
                      onChange={e => setDestinoId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">— Seleccionar —</option>
                      {sucursalesDestino.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className={labelCls}>Notas / Motivo</label>
                  <input
                    type="text"
                    placeholder="Ej: Reposición de stock, pedido urgente…"
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Buscador de artículos */}
                <div>
                  <label className={labelCls}>Agregar Artículo</label>
                  <div className="relative" ref={dropRef}>
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código…"
                      value={artQ}
                      onFocus={() => setDropOpen(true)}
                      onChange={e => { setArtQ(e.target.value); setDropOpen(true); }}
                      className={inputCls}
                      autoComplete="off"
                    />
                    {dropOpen && (
                      <div className="absolute z-20 w-full mt-1 bg-kp-surface2 border border-kp-border rounded-lg shadow-2xl flex flex-col" style={{ maxHeight: '220px' }}>
                        <ul className="overflow-y-auto flex-1">
                          {artFiltrados.length === 0 ? (
                            <li className="px-4 py-6 text-center text-xs text-kp-gray">Sin resultados</li>
                          ) : (
                            artFiltrados.map(a => (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  onMouseDown={e => { e.preventDefault(); addItem(a); }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-kp-red/10 transition-colors flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium text-kp-white block truncate">{a.nombre}</span>
                                    <span className="text-xs text-kp-gray font-mono">{a.codigo}</span>
                                  </div>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabla de items */}
                {items.length > 0 && (
                  <div className="rounded-xl border border-kp-border overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-kp-surface2 border-b border-kp-border">
                          <th className="text-left px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold">Artículo</th>
                          <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-28">Cantidad</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-kp-border">
                        {items.map((item, idx) => (
                          <tr key={item.articulo_id} className="bg-kp-surface">
                            <td className="px-3 py-2">
                              <div className="text-sm font-medium text-kp-white">{item.nombre}</div>
                              <div className="text-xs text-kp-gray font-mono">{item.codigo}</div>
                            </td>
                            <td className="px-3 py-2">
                              <NumericInput
                                value={item.cantidad}
                                onChange={e => updateCantidad(idx, e.target.value)}
                                className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                              />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-kp-gray hover:text-kp-red transition-colors"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Columna derecha — resumen */}
              <div className="w-64 flex-shrink-0 flex flex-col p-6 bg-kp-surface2 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Resumen</h4>

                <div className="space-y-3 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-kp-gray">Artículos distintos</span>
                    <span className="tabular-nums text-kp-white">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kp-gray">Total unidades</span>
                    <span className="tabular-nums text-kp-white">{totalUnidades}</span>
                  </div>
                  {origenId && destinoId && (
                    <div className="border border-kp-border rounded-lg p-3 space-y-1 mt-2">
                      <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold">Ruta</p>
                      <p className="text-sm text-kp-white truncate">
                        {sucursales.find(s => s.id === origenId)?.nombre}
                      </p>
                      <p className="text-xs text-kp-gray">↓</p>
                      <p className="text-sm text-kp-white truncate">
                        {sucursales.find(s => s.id === destinoId)?.nombre}
                      </p>
                    </div>
                  )}
                </div>

                {saveError && (
                  <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">
                    {saveError}
                  </p>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={saving || items.length === 0 || !origenId || !destinoId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? <><Spinner /> Guardando…</> : 'Crear Traspaso'}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
