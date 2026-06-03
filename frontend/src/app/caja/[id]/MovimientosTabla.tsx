'use client';

import { useState } from 'react';

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

export default function MovimientosTabla({
  movimientos,
  esAdmin,
}: {
  movimientos: Movimiento[];
  esAdmin: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todos');

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
              </tr>
            );
          })}
          {filtrados.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-kp-gray text-sm">
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
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
