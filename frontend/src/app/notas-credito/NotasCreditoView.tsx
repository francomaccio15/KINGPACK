'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { NotaCredito } from './page';
import NuevaNotaCredito from './NuevaNotaCredito';
import { useAuth } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string,string>||{}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

type Cliente        = { id: string; razon_social: string; cuit: string | null };
type Sucursal       = { id: string; nombre: string };
type TipoComprobante = { id: string; codigo_afip: number; letra: string; descripcion: string };

interface Props {
  notasIniciales: NotaCredito[];
  totalCount: number;
  clientes: Cliente[];
  sucursales: Sucursal[];
  tiposNC: TipoComprobante[];
}

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={[
      'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize',
      estado === 'emitida'
        ? 'bg-green-500/10 border-green-500/30 text-green-400'
        : 'bg-kp-border/30 border-kp-border/50 text-kp-gray',
    ].join(' ')}>
      <span className={`w-1 h-1 rounded-full ${estado === 'emitida' ? 'bg-green-400' : 'bg-kp-gray'}`} />
      {estado}
    </span>
  );
}

function LetraBadge({ letra }: { letra: string | null }) {
  const colors: Record<string, string> = {
    A: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
    B: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    C: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  };
  const cls = colors[letra ?? ''] ?? 'bg-kp-surface2 border-kp-border text-kp-gray';
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded border ${cls}`}>
      {letra ?? '?'}
    </span>
  );
}

export default function NotasCreditoView({ notasIniciales, totalCount, clientes, sucursales, tiposNC }: Props) {
  const { user } = useAuth();
  const isAdmin   = user?.rol === 'administrador'; // eliminar solo admin
  const puedeAnular = user?.rol === 'administrador' || user?.rol === 'cajero';

  const [notas,        setNotas]        = useState<NotaCredito[]>(notasIniciales);
  const [showForm,     setShowForm]     = useState(false);
  const [anulando,     setAnulando]     = useState<string | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [eliminando,   setEliminando]   = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [q,            setQ]            = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Filtro client-side simple
  const filtered = notas.filter(n => {
    if (filtroEstado && n.estado !== filtroEstado) return false;
    if (q) {
      const lower = q.toLowerCase();
      return (
        n.cliente_razon_social?.toLowerCase().includes(lower) ||
        n.motivo.toLowerCase().includes(lower) ||
        String(n.numero ?? '').includes(lower) ||
        (n.numero_referencia ?? '').toLowerCase().includes(lower)
      );
    }
    return true;
  });

  const handleCreate = (nc: NotaCredito) => {
    setNotas(prev => [nc, ...prev]);
  };

  const handleAnular = async (id: string) => {
    setAnulando(id);
    try {
      const r = await apiFetch(`/api/notas-credito/${id}/anular`, { method: 'PATCH' });
      if (r.ok) {
        setNotas(prev => prev.map(n => n.id === id ? { ...n, estado: 'anulada' } : n));
      }
    } finally {
      setAnulando(null);
      setConfirmId(null);
    }
  };

  const handleEliminar = async (id: string) => {
    setEliminando(id);
    try {
      const r = await apiFetch(`/api/notas-credito/${id}`, { method: 'DELETE' });
      if (r.ok) setNotas(prev => prev.filter(n => n.id !== id));
    } finally {
      setEliminando(null);
      setConfirmDelId(null);
    }
  };

  const IcoPlus  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>;
  const IcoPrint = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
  const IcoTrash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

  return (
    <section className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Notas de Crédito</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {filtered.length} {filtered.length === 1 ? 'documento' : 'documentos'}
            {filtroEstado ? ` · ${filtroEstado}` : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 transition-colors"
        >
          <IcoPlus /> Nueva Nota de Crédito
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar por cliente, motivo, número..."
            className="w-full bg-kp-surface border border-kp-border rounded-lg pl-9 pr-4 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
          />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-kp-border text-xs font-semibold">
          {(['', 'emitida', 'anulada'] as const).map(est => {
            const labels: Record<string, string> = { '': 'Todas', emitida: 'Emitidas', anulada: 'Anuladas' };
            return (
              <button
                key={est}
                onClick={() => setFiltroEstado(est)}
                className={`px-3 py-2 transition-colors ${filtroEstado === est ? 'bg-kp-red text-white' : 'bg-kp-surface text-kp-gray hover:text-kp-white'}`}
              >
                {labels[est]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Tipo / N°</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Fecha</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Cliente</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Motivo</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Referencia</th>
              <th className="text-right px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Total</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Estado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-kp-gray">
                  {q || filtroEstado
                    ? 'No se encontraron notas con esos filtros.'
                    : 'No hay notas de crédito emitidas todavía.'}
                </td>
              </tr>
            ) : (
              filtered.map(n => (
                <tr key={n.id} className="hover:bg-kp-surface2 transition-colors group">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <LetraBadge letra={n.tipo_letra} />
                      <span className="text-xs text-kp-gray-lt font-mono">
                        {n.numero ? `N° ${String(n.numero).padStart(8, '0')}` : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-kp-gray-lt">
                    {new Date(n.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 max-w-[180px]">
                    <p className="text-xs font-medium text-kp-white truncate">
                      {n.cliente_razon_social ?? 'Consumidor final'}
                    </p>
                    {n.cliente_cuit && (
                      <p className="text-[10px] text-kp-gray font-mono">{n.cliente_cuit}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-xs text-kp-gray-lt truncate">{n.motivo}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[11px] font-mono text-kp-gray">{n.numero_referencia ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={`text-sm font-bold tabular-nums ${n.estado === 'anulada' ? 'text-kp-gray line-through' : 'text-kp-red'}`}>
                      {ars.format(n.total)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <EstadoBadge estado={n.estado} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Imprimir */}
                      <Link
                        href={`/notas-credito/${n.id}`}
                        target="_blank"
                        title="Ver e imprimir"
                        className="w-7 h-7 flex items-center justify-center rounded-md text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors"
                      >
                        <IcoPrint />
                      </Link>

                      {/* Anular (solo emitidas) — admin y cajero */}
                      {puedeAnular && n.estado === 'emitida' && (
                        confirmId === n.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleAnular(n.id)} disabled={anulando === n.id}
                              className="text-[10px] font-bold text-rose-400 hover:underline">
                              {anulando === n.id ? '…' : 'Anular'}
                            </button>
                            <span className="text-kp-border">/</span>
                            <button onClick={() => setConfirmId(null)}
                              className="text-[10px] font-bold text-kp-gray hover:underline">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmId(n.id)}
                            className="text-[10px] font-semibold text-kp-gray hover:text-rose-400 transition-colors px-1">
                            Anular
                          </button>
                        )
                      )}

                      {/* Eliminar (todas) — solo admin */}
                      {isAdmin && (
                        confirmDelId === n.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEliminar(n.id)} disabled={eliminando === n.id}
                              className="text-[10px] font-bold text-rose-500 hover:underline">
                              {eliminando === n.id ? '…' : '¡Eliminar!'}
                            </button>
                            <span className="text-kp-border">/</span>
                            <button onClick={() => setConfirmDelId(null)}
                              className="text-[10px] font-bold text-kp-gray hover:underline">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelId(n.id)} title="Eliminar"
                            className="w-7 h-7 flex items-center justify-center rounded-md text-kp-gray hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                            <IcoTrash />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal nueva NC ── */}
      {showForm && (
        <NuevaNotaCredito
          clientes={clientes}
          sucursales={sucursales}
          tiposNC={tiposNC}
          onCreate={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

    </section>
  );
}
