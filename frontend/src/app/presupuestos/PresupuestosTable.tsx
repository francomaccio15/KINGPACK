'use client';

import { useState, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState, MobileCards, RecordCard, TableWrap } from '@/components/ui/ResponsiveTable';
import { btnSecondary, cn } from '@/lib/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
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
  despacho_pendiente?: boolean;
  despachada_at?: string | null;
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
  vista = 'pendientes',
}: {
  presupuestos: Presupuesto[];
  hayFiltros: boolean;
  esRepartidor: boolean;
  vista?: 'pendientes' | 'despachar' | 'confirmados';
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [accionId, setAccionId] = useState<string | null>(null);

  // Preventista: confirma su presupuesto como venta en cuenta corriente.
  // Staff: marca como despachada una venta que confirmó un preventista.
  const ejecutar = async (p: Presupuesto, tipo: 'confirmar' | 'despachar') => {
    const msg = tipo === 'confirmar'
      ? `¿Confirmar el presupuesto #${p.numero} como venta en la cuenta corriente de ${p.cliente_nombre}? Se descuenta el stock y se le avisa al cajero para que la despache.`
      : `¿Marcar la venta #${p.numero} como despachada?`;
    if (!window.confirm(msg)) return;
    setAccionId(p.id);
    try {
      const r = await apiFetch(
        tipo === 'confirmar' ? `/api/ventas/${p.id}/confirmar-preventa` : `/api/ventas/${p.id}/despachar`,
        { method: 'PATCH', body: JSON.stringify({}) },
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { window.alert(d.error ?? 'No se pudo completar la acción'); return; }
      router.refresh();
    } finally {
      setAccionId(null);
    }
  };

  const btnBase = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const estadoDespacho = (p: Presupuesto) => p.despacho_pendiente
    ? <span className="px-2 py-1 rounded-md text-2xs md:text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">Pendiente de despacho</span>
    : <span className="px-2 py-1 rounded-md text-2xs md:text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">{p.despachada_at ? 'Despachada' : 'Confirmada'}</span>;

  // Acciones por fila según rol y solapa. El preventista no entra a /ventas/[id]
  // (no tiene permiso): ve el detalle desplegando la fila.
  const acciones = (p: Presupuesto, mobile = false) => {
    const ocupado = accionId === p.id;
    const full = mobile ? 'flex-1' : '';
    if (esRepartidor) {
      if (vista === 'confirmados') return estadoDespacho(p);
      return (
        <button
          type="button"
          onClick={() => ejecutar(p, 'confirmar')}
          disabled={ocupado || !p.cliente_nombre}
          title={p.cliente_nombre ? 'Confirmar en cuenta corriente' : 'El presupuesto no tiene cliente: no se puede pasar a cuenta corriente'}
          className={cn(btnBase, full, 'bg-green-600 hover:bg-green-500 text-white')}
        >
          {ocupado ? 'Confirmando…' : 'Confirmar venta (Cta. Cte.)'}
        </button>
      );
    }
    const ver = (
      <Link href={`/ventas/${p.id}`} className={mobile ? cn(btnSecondary, 'flex-1') : cn(btnBase, 'bg-kp-surface2 hover:bg-kp-border text-kp-gray-lt border border-kp-border')}>
        Ver
      </Link>
    );
    if (vista === 'despachar') {
      return (
        <>
          {ver}
          <button
            type="button"
            onClick={() => ejecutar(p, 'despachar')}
            disabled={ocupado}
            className={cn(btnBase, full, 'bg-green-600 hover:bg-green-500 text-white')}
          >
            {ocupado ? 'Guardando…' : 'Despachado'}
          </button>
        </>
      );
    }
    return (
      <>
        {ver}
        <Link href={`/ventas/${p.id}`} className={cn(btnBase, full, 'bg-green-600 hover:bg-green-500 text-white')}>
          Confirmar
        </Link>
      </>
    );
  };
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
          {hayFiltros
            ? 'No hay registros que coincidan con el filtro.'
            : vista === 'despachar' ? 'No hay ventas pendientes de despacho.'
            : vista === 'confirmados' ? 'Todavía no confirmaste ventas.'
            : 'Todavía no hay presupuestos.'}
        </p>
        {esRepartidor && !hayFiltros && vista === 'pendientes' && (
          <p className="text-xs text-kp-gray/60 mt-1">Creá uno con el botón “Nuevo Presupuesto”.</p>
        )}
      </div>
    );
  }

  return (
    <>
    <TableWrap className="shadow-lg shadow-black/40">
      <table data-rt="1" className="min-w-full text-sm">
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
                    <div className="flex items-center justify-end gap-2">
                      {acciones(p)}
                    </div>
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
      </TableWrap>

      {/* Mobile: el detalle de items se abre dentro de la propia tarjeta. */}
      <MobileCards>
        {presupuestos.map(p => {
          const abierto = expanded === p.id;
          const items   = itemsCache[p.id] ?? [];
          return (
            <RecordCard
              key={p.id}
              title={`#${p.numero} · ${p.cliente_nombre ?? 'Público general'}`}
              subtitle={[fechaFmt(p.fecha), esRepartidor ? null : p.vendedor_nombre].filter(Boolean).join(' · ')}
              fields={[
                { label: 'Total', value: ars.format(parseFloat(p.total) || 0), strong: true },
                { label: 'Ítems', value: p.items_count, align: 'right' },
              ]}
              expandable
              expanded={abierto}
              onToggle={() => toggle(p.id)}
              actions={acciones(p, true)}
            >
              {items.length === 0 ? (
                <p className="text-2xs text-kp-gray">Sin ítems.</p>
              ) : (
                items.map(it => (
                  <div key={it.articulo_id} className="flex items-start justify-between gap-3 py-1">
                    <div className="min-w-0">
                      <p className="text-xs text-kp-white truncate">{it.nombre}</p>
                      <p className="text-2xs text-kp-gray font-mono">{it.codigo}</p>
                    </div>
                    <p className="text-xs text-kp-white font-semibold tabular-nums shrink-0">
                      {(parseFloat(it.cantidad) || 0).toFixed(0)} u
                    </p>
                  </div>
                ))
              )}
            </RecordCard>
          );
        })}
      </MobileCards>
    </>
  );
}
