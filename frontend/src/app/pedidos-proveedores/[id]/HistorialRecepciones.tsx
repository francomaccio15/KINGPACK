'use client';

import { useState } from 'react';

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtNum = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

type Detalle = { codigo: string; nombre: string; delta: number | string };
type Evento = {
  fecha: string;
  tipo: 'correccion' | 'parcial' | 'completa';
  usuario_nombre: string | null;
  detalle: Detalle[];
};

const TIPO_BADGE: Record<string, string> = {
  correccion: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  parcial:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  completa:   'bg-green-500/10 text-green-400 border-green-500/30',
};
const TIPO_LABEL: Record<string, string> = {
  correccion: 'Corrección',
  parcial:    'Recepción parcial',
  completa:   'Recepción — completó el pedido',
};

export default function HistorialRecepciones({ eventos }: { eventos: Evento[] }) {
  // Por defecto abrimos el último movimiento (el más reciente).
  const [abiertos, setAbiertos] = useState<Set<number>>(
    () => new Set(eventos.length ? [eventos.length - 1] : [])
  );

  const toggle = (idx: number) =>
    setAbiertos(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  if (eventos.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-kp-gray">Historial de Recepciones</h3>
        </div>
        <div className="px-4 py-8 text-center text-sm text-kp-gray">
          Todavía no se registró ninguna recepción para este pedido.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-kp-border overflow-hidden">
      <div className="bg-kp-surface2 border-b border-kp-border px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-kp-gray">Historial de Recepciones</h3>
        <span className="text-xs text-kp-gray/60">{eventos.length} movimiento{eventos.length !== 1 ? 's' : ''}</span>
      </div>

      <ul className="divide-y divide-kp-border bg-kp-surface">
        {eventos.map((ev, idx) => {
          const open = abiertos.has(idx);
          const totalUnidades = (ev.detalle ?? []).reduce((s, d) => s + (parseFloat(String(d.delta)) || 0), 0);
          return (
            <li key={idx}>
              {/* Cabecera clickeable */}
              <button
                onClick={() => toggle(idx)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-kp-surface2 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={`w-4 h-4 text-kp-gray shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>

                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-sm font-medium text-kp-white tabular-nums sm:w-44 shrink-0">
                    {fmtDateTime(ev.fecha)}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${TIPO_BADGE[ev.tipo]} w-fit`}>
                    {TIPO_LABEL[ev.tipo]}
                  </span>
                  <span className="text-xs text-kp-gray truncate">
                    {ev.usuario_nombre
                      ? <>por {ev.usuario_nombre}</>
                      : <span className="italic text-kp-gray/60">usuario no registrado</span>}
                  </span>
                </div>

                <span className={`text-sm font-bold tabular-nums shrink-0 ${totalUnidades < 0 ? 'text-kp-red' : 'text-emerald-400'}`}>
                  {totalUnidades > 0 ? '+' : ''}{fmtNum(totalUnidades)}
                </span>
              </button>

              {/* Detalle expandible */}
              {open && (
                <div className="px-4 pb-4 pt-1">
                  <div className="rounded-lg border border-kp-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-kp-surface2/60 border-b border-kp-border">
                          <th className="text-left px-3 py-2 text-[11px] text-kp-gray uppercase tracking-widest font-semibold">Producto</th>
                          <th className="text-left px-3 py-2 text-[11px] text-kp-gray uppercase tracking-widest font-semibold w-24">Código</th>
                          <th className="text-right px-3 py-2 text-[11px] text-kp-gray uppercase tracking-widest font-semibold w-32">
                            {ev.tipo === 'correccion' ? 'Corrección' : 'Cantidad'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-kp-border">
                        {(ev.detalle ?? []).map((d, j) => {
                          const val = parseFloat(String(d.delta)) || 0;
                          return (
                            <tr key={j} className="hover:bg-kp-surface2/40">
                              <td className="px-3 py-2 text-kp-white">{d.nombre}</td>
                              <td className="px-3 py-2 font-mono text-xs text-kp-gray">{d.codigo}</td>
                              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${val < 0 ? 'text-kp-red' : 'text-emerald-400'}`}>
                                {val > 0 ? '+' : ''}{fmtNum(val)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {ev.tipo === 'correccion' && (
                    <p className="text-[11px] text-kp-gray mt-2">
                      Ajuste sobre lo recibido. Un valor negativo revierte del stock las unidades cargadas de más.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
