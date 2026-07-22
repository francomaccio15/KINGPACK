'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

type Venta = {
  id: string;
  numero: number;
  fecha: string;
  estado: 'preventa' | 'confirmada' | 'facturada' | 'anulada';
  total: string;
  subtotal: string;
  descuento_total: string;
  descuento_madre: string;
  cliente_nombre: string | null;
  sucursal_nombre: string | null;
  lista_precio: string | null;
  cae: string | null;
  facturada_ok: boolean | null;
  items_count: number;
  medios_pago: string | null;
  fue_editada: boolean;
  vendedor_nombre: string | null;
  vendedor_rol: string | null;
};

type VentaItem = {
  articulo_id: string;
  cantidad: number;
  codigo: string;
  nombre: string;
  precio_lista: string;
  precio_madre: string;
  descuento_pct: string;
  precio_unitario_final: string;
};

const ESTADO_STYLE: Record<string, string> = {
  preventa:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmada: 'bg-green-500/10 text-green-400 border-green-500/30',
  facturada:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  anulada:    'bg-kp-border/30 text-kp-gray border-kp-border/50',
};

const ESTADO_LABEL: Record<string, string> = {
  preventa:   'Preventa',
  confirmada: 'Confirmada',
  facturada:  'Facturada',
  anulada:    'Anulada',
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

export default function VentasTable({ ventas, hayFiltros }: { ventas: Venta[]; hayFiltros: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, VentaItem[]>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function toggle(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (itemsCache[id]) return;

    setLoading(id);
    try {
      const r = await apiFetch(`/api/ventas/${id}`);
      if (r.ok) {
        const data = await r.json();
        setItemsCache(prev => ({ ...prev, [id]: data.items ?? [] }));
      }
    } finally {
      setLoading(null);
    }
  }

  if (ventas.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface py-16 flex flex-col items-center gap-3">
        <svg className="w-10 h-10 text-kp-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        <p className="text-kp-gray text-sm">
          {hayFiltros ? 'No hay ventas que coincidan con los filtros.' : 'No hay ventas registradas todavía.'}
        </p>
        {!hayFiltros && (
          <p className="text-kp-gray/50 text-xs">Usá el botón "Nueva Venta" para registrar la primera.</p>
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
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold whitespace-nowrap">Nº</th>
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Fecha</th>
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Cliente</th>
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Sucursal</th>
            <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Medios de Pago</th>
            <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Descuento</th>
            <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Total</th>
            <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody className="bg-kp-surface divide-y divide-kp-border">
          {ventas.map((v) => {
            // Descuento total real (incluye el de la lista), no solo el extra.
            const descuento = parseFloat(v.descuento_madre || v.descuento_total || '0');
            const fecha = new Date(v.fecha).toLocaleDateString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            });
            const isOpen = expanded === v.id;
            const items = itemsCache[v.id] ?? [];
            const isLoading = loading === v.id;

            return (
              <Fragment key={v.id}>
                <tr
                  className={`hover:bg-kp-surface2 transition-colors group cursor-pointer ${isOpen ? 'bg-kp-surface2' : ''}`}
                  onClick={() => toggle(v.id)}
                >
                  {/* Chevron */}
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block text-kp-gray transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray-lt tabular-nums">
                    #{v.numero}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">
                    {fecha}
                  </td>
                  <td className="px-4 py-3 font-medium text-kp-white group-hover:text-kp-red transition-colors">
                    {v.cliente_nombre ?? <span className="text-kp-gray italic text-xs">Consumidor Final</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">
                    {v.sucursal_nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {v.medios_pago ? (
                      <div className="flex flex-wrap gap-1">
                        {v.medios_pago.split(', ').map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-kp-surface2 text-kp-gray-lt border border-kp-border whitespace-nowrap"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-kp-border">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs">
                    {descuento > 0
                      ? <span className="text-kp-red">−{fmt(descuento)}</span>
                      : <span className="text-kp-border">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                    {fmt(v.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[v.estado] ?? ''}`}>
                        {v.cae && (
                          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
                        )}
                        {ESTADO_LABEL[v.estado] ?? v.estado}
                      </span>
                      {v.estado === 'preventa' && v.vendedor_rol === 'vendedor' && (
                        <span
                          title={v.vendedor_nombre ? `Preventa creada por el preventista ${v.vendedor_nombre}` : 'Preventa creada por un preventista'}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30 whitespace-nowrap max-w-[140px]"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5 flex-shrink-0">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                          <span className="truncate">
                            Preventista{v.vendedor_nombre ? ` · ${v.vendedor_nombre}` : ''}
                          </span>
                        </span>
                      )}
                      {v.fue_editada && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          Editada
                        </span>
                      )}
                      {v.estado === 'anulada' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                          Anulada
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/ventas/${v.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1
                        text-xs text-kp-gray hover:text-kp-white px-2 py-1 rounded border border-transparent
                        hover:border-kp-border hover:bg-kp-surface2"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>

                {/* ── Fila expandida con detalle de ítems ── */}
                {isOpen && (
                  <tr className="bg-kp-surface2/50">
                    <td colSpan={10} className="px-6 py-3">
                      {isLoading ? (
                        <p className="text-xs text-kp-gray py-2">Cargando ítems...</p>
                      ) : items.length === 0 ? (
                        <p className="text-xs text-kp-gray/60 italic py-2">Sin ítems registrados.</p>
                      ) : (
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-kp-border">
                              <th className="text-left pb-1.5 pr-4 text-kp-gray font-semibold uppercase tracking-wider">Código</th>
                              <th className="text-left pb-1.5 pr-4 text-kp-gray font-semibold uppercase tracking-wider">Artículo</th>
                              <th className="text-center pb-1.5 px-4 text-kp-gray font-semibold uppercase tracking-wider">Cant.</th>
                              <th className="text-right pb-1.5 px-4 text-kp-gray font-semibold uppercase tracking-wider">P. Lista</th>
                              <th className="text-right pb-1.5 px-4 text-kp-gray font-semibold uppercase tracking-wider">Dto%</th>
                              <th className="text-right pb-1.5 pl-4 text-kp-gray font-semibold uppercase tracking-wider">P. Final</th>
                              <th className="text-right pb-1.5 pl-4 text-kp-gray font-semibold uppercase tracking-wider">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-kp-border/50">
                            {items.map((it, i) => {
                              const pFinal = parseFloat(it.precio_unitario_final || '0');
                              const subtotal = pFinal * it.cantidad;
                              // P. LISTA = madre congelado; DTO% = descuento respecto al
                              // madre (incluye el de la lista), igual que el detalle.
                              const madre = parseFloat(it.precio_madre || it.precio_lista || '0') || 0;
                              const base = madre >= pFinal ? madre : (parseFloat(it.precio_lista || '0') || madre);
                              const dto = base > 0 ? (1 - pFinal / base) * 100 : 0;
                              return (
                                <tr key={i} className="hover:bg-kp-surface transition-colors">
                                  <td className="py-1.5 pr-4 font-mono text-kp-gray/70">{it.codigo}</td>
                                  <td className="py-1.5 pr-4 text-kp-white font-medium">{it.nombre}</td>
                                  <td className="py-1.5 px-4 text-center tabular-nums text-kp-gray-lt">{it.cantidad}</td>
                                  <td className="py-1.5 px-4 text-right tabular-nums text-kp-gray">{fmt(base)}</td>
                                  <td className="py-1.5 px-4 text-right tabular-nums">
                                    {dto > 0.05
                                      ? <span className="text-kp-red">−{dto.toFixed(1)}%</span>
                                      : <span className="text-kp-border">—</span>}
                                  </td>
                                  <td className="py-1.5 pl-4 text-right tabular-nums text-kp-gray-lt">{fmt(pFinal)}</td>
                                  <td className="py-1.5 pl-4 text-right tabular-nums font-semibold text-kp-white">{fmt(subtotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
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
