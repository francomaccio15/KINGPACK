'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => {
  const n = parseFloat(String(v ?? ''));
  return isNaN(n) ? '—' : ars.format(n);
};

const TIPO_STYLE: Record<string, string> = {
  ingreso: 'bg-green-500/10 text-green-400 border-green-500/30',
  egreso:  'bg-kp-red/10 text-kp-red border-kp-red/30',
  retiro:  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  venta:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const TIPO_LABEL: Record<string, string> = {
  ingreso: 'Ingreso',
  egreso:  'Egreso',
  retiro:  'Retiro',
  venta:   'Venta',
};

type Movimiento = {
  id: string;
  fecha: string;
  tipo: string;
  concepto: string;
  monto: string | number;
  medio_pago?: string | null;
  usuario_nombre?: string | null;
  empleado_nombre?: string | null;
};

type Filtro = 'todos' | 'venta' | 'ingreso' | 'egreso' | 'retiro';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',   label: 'Todos' },
  { key: 'venta',   label: 'Ventas' },
  { key: 'ingreso', label: 'Ingresos' },
  { key: 'egreso',  label: 'Egresos' },
  { key: 'retiro',  label: 'Retiros' },
];

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

function EditMovimientoModal({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [concepto, setConcepto] = useState(movimiento.concepto);
  const [monto, setMonto] = useState(String(movimiento.monto));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoLabel = TIPO_LABEL[movimiento.tipo] ?? movimiento.tipo;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch(`/api/caja/movimiento/${movimiento.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ concepto, monto: parseFloat(monto) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return; }
      onSaved();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-kp-surface border border-kp-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border">
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 bg-amber-400 rounded-full block" />
            <h2 className="text-base font-bold">Editar {tipoLabel}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-kp-gray hover:text-kp-white transition-colors p-1 rounded-lg hover:bg-kp-surface2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1.5">
              Concepto
            </label>
            <input
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2.5 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-amber-400/60 transition-colors"
              placeholder="Descripción del retiro"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1.5">
              Monto
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-sm">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-7 pr-3 py-2.5 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-amber-400/60 transition-colors tabular-nums"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MovimientosTabla({
  movimientos,
  esAdmin,
}: {
  movimientos: Movimiento[];
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [editando, setEditando] = useState<Movimiento | null>(null);

  const filtrados = filtro === 'todos'
    ? movimientos
    : movimientos.filter(m => m.tipo === filtro);

  // Totales por tipo
  const totalIngresos = movimientos
    .filter(m => ['ingreso', 'venta'].includes(m.tipo))
    .reduce((acc, m) => acc + parseFloat(String(m.monto ?? 0)), 0);
  const totalEgresos = movimientos
    .filter(m => !['ingreso', 'venta'].includes(m.tipo))
    .reduce((acc, m) => acc + parseFloat(String(m.monto ?? 0)), 0);

  // Conteos por tipo (para mostrar badges en filtros)
  const countPorTipo = movimientos.reduce<Record<string, number>>((acc, m) => {
    acc[m.tipo] = (acc[m.tipo] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {editando && (
        <EditMovimientoModal
          movimiento={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); router.refresh(); }}
        />
      )}

      <div className="rounded-xl border border-kp-border overflow-hidden">
        {/* Header con filtros */}
        <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-kp-gray">
            Movimientos{!esAdmin ? ' — Efectivo' : ''}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTROS.map(f => {
              const count = f.key === 'todos'
                ? movimientos.length
                : (countPorTipo[f.key] ?? 0);
              if (count === 0 && f.key !== 'todos') return null;
              const isActive = filtro === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFiltro(f.key)}
                  className={[
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                    isActive
                      ? 'bg-kp-red/10 border-kp-red/40 text-kp-red'
                      : 'bg-transparent border-kp-border text-kp-gray hover:border-kp-gray hover:text-kp-white',
                  ].join(' ')}
                >
                  {f.label}
                  <span className={[
                    'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                    isActive ? 'bg-kp-red/20 text-kp-red' : 'bg-kp-border/60 text-kp-gray',
                  ].join(' ')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2/50 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Hora</th>
              <th className="text-center px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Concepto</th>
              <th className="text-left px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Medio de Pago</th>
              <th className="text-right px-4 py-3 text-xs text-kp-gray uppercase tracking-widest font-semibold">Monto</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {filtrados.map((m) => {
              const esIngreso = ['ingreso', 'venta'].includes(m.tipo);
              return (
                <tr key={m.id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-3 text-xs text-kp-gray whitespace-nowrap">
                    {new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TIPO_STYLE[m.tipo] ?? ''}`}>
                      {TIPO_LABEL[m.tipo] ?? m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block text-kp-white">{m.concepto}</span>
                    {m.empleado_nombre && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/80 mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
                          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                        </svg>
                        {m.empleado_nombre}
                      </span>
                    )}
                    {m.usuario_nombre && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-kp-gray mt-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        {m.usuario_nombre}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{m.medio_pago ?? '—'}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${esIngreso ? 'text-green-400' : 'text-kp-red'}`}>
                    {esIngreso ? '+' : '−'}{fmt(m.monto)}
                  </td>
                  <td className="px-2 py-3 text-center">
                    {(m.tipo === 'retiro' || m.tipo === 'egreso') && (
                      <button
                        onClick={() => setEditando(m)}
                        title={`Editar ${TIPO_LABEL[m.tipo] ?? m.tipo}`}
                        className="p-1.5 rounded-lg text-kp-gray hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-kp-gray text-sm">
                  No hay movimientos{filtro !== 'todos' ? ` de tipo "${TIPO_LABEL[filtro] ?? filtro}"` : !esAdmin ? ' en efectivo' : ''}.
                </td>
              </tr>
            )}
          </tbody>
          {/* Fila de totales */}
          {movimientos.length > 0 && filtro === 'todos' && (
            <tfoot>
              <tr className="bg-kp-surface2 border-t border-kp-border">
                <td colSpan={3} className="px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-kp-gray">Totales</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-green-400 font-semibold tabular-nums">+{fmt(totalIngresos)}</span>
                  <span className="text-xs text-kp-gray mx-1">/</span>
                  <span className="text-xs text-kp-red font-semibold tabular-nums">−{fmt(totalEgresos)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-bold tabular-nums ${totalIngresos - totalEgresos >= 0 ? 'text-green-400' : 'text-kp-red'}`}>
                    {totalIngresos - totalEgresos >= 0 ? '+' : ''}{fmt(totalIngresos - totalEgresos)}
                  </span>
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
