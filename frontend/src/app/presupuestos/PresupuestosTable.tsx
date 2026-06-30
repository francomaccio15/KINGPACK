'use client';

import { useState, useCallback, Fragment } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fechaFmt = (d: string) => new Date(d).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

type Presupuesto = {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  total: string;
  cliente_nombre: string | null;
  sucursal_nombre: string | null;
  lista_precio: string | null;
  vendedor_nombre: string | null;
  items_count: number;
};

type Item = {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: string;
  precio_lista: string;
  descuento_pct: string;
  precio_unitario_final: string;
};

export default function PresupuestosTable({
  presupuestos,
  hayFiltros,
  esRepartidor,
}: {
  presupuestos: Presupuesto[];
  hayFiltros: boolean;
  esRepartidor: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, Item[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggle = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (itemsCache[id]) return;
    setLoadingId(id);
    try {
      const r = await apiFetch(`/api/ventas/${id}`);
      if (r.ok) {
        const data = await r.json();
        setItemsCache(prev => ({ ...prev, [id]: data.items ?? [] }));
      }
    } catch { /* silencioso */ }
    finally { setLoadingId(null); }
  }, [expanded, itemsCache]);

  if (presupuestos.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-kp-surface2 border border-kp-border flex items-center justify-center text-2xl text-kp-gray mb-3">
          📄
        </div>
        <p className="text-sm text-kp-gray">
          {hayFiltros ? 'No hay presupuestos que coincidan con el filtro.' : 'Todavía no hay presupuestos.'}
        </p>
        {esRepartidor && !hayFiltros && (
          <p className="text-xs text-kp-gray/60 mt-1">Creá uno con el botón “Nuevo Presupuesto”.</p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-kp-surface2 border-b border-kp-border">
            <th className="w-8 px-3 py-3" />
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">N°</th>
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Fecha</th>
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Cliente</th>
            {!esRepartidor && (
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Preventista</th>
            )}
            <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Ítems</th>
            <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Total</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="bg-kp-surface divide-y divide-kp-border">
          {presupuestos.map(p => {
            const isOpen = expanded === p.id;
            const items = itemsCache[p.id];
            const colSpan = esRepartidor ? 7 : 8;
            return (
              <Fragment key={p.id}>
                <tr
                  onClick={() => toggle(p.id)}
                  className="hover:bg-kp-surface2 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-3 text-kp-gray">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </td>
                  <td className="px-4 py-3 font-semibold text-kp-white tabular-nums">#{p.numero}</td>
                  <td className="px-4 py-3 text-kp-gray-lt whitespace-nowrap">{fechaFmt(p.fecha)}</td>
                  <td className="px-4 py-3 text-kp-gray-lt">{p.cliente_nombre ?? <span className="italic text-kp-gray">Público general</span>}</td>
                  {!esRepartidor && (
                    <td className="px-4 py-3 text-kp-gray-lt">{p.vendedor_nombre ?? <span className="text-kp-gray">—</span>}</td>
                  )}
                  <td className="px-4 py-3 text-center text-kp-gray-lt tabular-nums">{p.items_count}</td>
                  <td className="px-4 py-3 text-right font-bold text-kp-white tabular-nums">{ars.format(parseFloat(p.total) || 0)}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    {!esRepartidor ? (
                      <Link
                        href={`/ventas/${p.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          bg-green-600 hover:bg-green-500 text-white transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Confirmar
                      </Link>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/30">
                        Pendiente
                      </span>
                    )}
                  </td>
                </tr>

                {isOpen && (
                  <tr className="bg-kp-surface2/40">
                    <td colSpan={colSpan} className="px-6 py-4">
                      {loadingId === p.id && !items ? (
                        <p className="text-xs text-kp-gray">Cargando ítems…</p>
                      ) : items && items.length > 0 ? (
                        <div className="rounded-lg border border-kp-border overflow-hidden">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="bg-kp-surface border-b border-kp-border">
                                <th className="text-left px-3 py-2 text-kp-gray uppercase tracking-widest font-semibold">Artículo</th>
                                <th className="text-right px-3 py-2 text-kp-gray uppercase tracking-widest font-semibold">Cant.</th>
                                <th className="text-right px-3 py-2 text-kp-gray uppercase tracking-widest font-semibold">P. Final</th>
                                <th className="text-right px-3 py-2 text-kp-gray uppercase tracking-widest font-semibold">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-kp-border">
                              {items.map(it => {
                                const cant = parseFloat(it.cantidad) || 0;
                                const pf   = parseFloat(it.precio_unitario_final) || 0;
                                return (
                                  <tr key={it.articulo_id}>
                                    <td className="px-3 py-2">
                                      <span className="text-kp-white font-medium">{it.nombre}</span>
                                      <span className="text-kp-gray font-mono ml-2">{it.codigo}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-kp-gray-lt">{cant.toFixed(0)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-kp-gray-lt">{ars.format(pf)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-kp-white">{ars.format(pf * cant)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-kp-gray">Sin ítems.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
