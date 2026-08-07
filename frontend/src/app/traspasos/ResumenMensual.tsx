'use client';

import { useState } from 'react';

type ArticuloDetalle = {
  nombre: string;
  codigo: string;
  unidades: number;
  costo_total: number;
};

export type ResumenRow = {
  mes: string;                       // 'YYYY-MM'
  sucursal_origen_nombre: string;
  sucursal_destino_nombre: string;
  traspasos_count: number;
  unidades: number;
  costo_total: number;
  articulos: ArticuloDetalle[] | null;
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 'YYYY-MM' → 'Agosto 2026'
const mesLabel = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  const s = new Date(y, (m || 1) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const Flecha = () => (
  <svg className="w-3.5 h-3.5 text-kp-red flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function ResumenMensual({ resumen }: { resumen: ResumenRow[] }) {
  const [abierto, setAbierto] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setAbierto(prev => ({ ...prev, [k]: !prev[k] }));

  // Agrupar por mes (ya vienen ordenadas por mes desc).
  const porMes = resumen.reduce((acc, r) => {
    (acc[r.mes] ??= []).push(r);
    return acc;
  }, {} as Record<string, ResumenRow[]>);

  // Acumulado histórico por dirección (todo el historial).
  const acumulado = Object.values(
    resumen.reduce((acc, r) => {
      const k = `${r.sucursal_origen_nombre}→${r.sucursal_destino_nombre}`;
      const a = (acc[k] ??= {
        sucursal_origen_nombre: r.sucursal_origen_nombre,
        sucursal_destino_nombre: r.sucursal_destino_nombre,
        traspasos_count: 0, unidades: 0, costo_total: 0,
      });
      a.traspasos_count += Number(r.traspasos_count) || 0;
      a.unidades        += Number(r.unidades) || 0;
      a.costo_total     += Number(r.costo_total) || 0;
      return acc;
    }, {} as Record<string, Omit<ResumenRow, 'mes' | 'articulos'>>)
  );
  const acumuladoTotal = acumulado.reduce((s, a) => s + a.costo_total, 0);

  const vacio = resumen.length === 0;

  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden shadow-lg shadow-black/40">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-kp-border bg-kp-surface2">
        <svg className="w-4 h-4 text-kp-red flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
          Mercadería traspasada por mes <span className="text-kp-gray/60 normal-case tracking-normal font-normal">(valorizada a costo)</span>
        </h3>
      </div>

      {vacio ? (
        <p className="px-5 py-8 text-center text-sm text-kp-gray">Todavía no hay traspasos enviados o recibidos para valorizar.</p>
      ) : (
        <>
          {/* Acumulado histórico por dirección */}
          <div className="px-5 py-4 bg-kp-surface2/40 border-b border-kp-border">
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Acumulado histórico</h4>
              <span className="text-sm font-bold text-kp-white tabular-nums">{ars.format(acumuladoTotal)}</span>
            </div>
            <div className="space-y-1.5">
              {acumulado.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-kp-gray-lt truncate">{a.sucursal_origen_nombre}</span>
                    <Flecha />
                    <span className="text-kp-white font-medium truncate">{a.sucursal_destino_nombre}</span>
                    <span className="text-xs text-kp-gray/70 whitespace-nowrap">
                      · {a.traspasos_count} {a.traspasos_count === 1 ? 'traspaso' : 'traspasos'} · {a.unidades} u.
                    </span>
                  </div>
                  <span className="text-kp-white font-semibold tabular-nums whitespace-nowrap">{ars.format(a.costo_total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detalle mes a mes (cada dirección se puede desplegar) */}
          <div className="divide-y divide-kp-border">
            {Object.entries(porMes).map(([mes, filas]) => {
              const totalMes = filas.reduce((s, f) => s + Number(f.costo_total), 0);
              return (
                <div key={mes} className="px-5 py-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <h4 className="text-sm font-bold text-kp-white">{mesLabel(mes)}</h4>
                    <span className="text-sm font-bold text-kp-white tabular-nums">{ars.format(totalMes)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {filas.map((f, i) => {
                      const key = `${f.mes}|${f.sucursal_origen_nombre}|${f.sucursal_destino_nombre}`;
                      const open = !!abierto[key];
                      const articulos = f.articulos ?? [];
                      return (
                        <div key={i}>
                          <button
                            type="button"
                            onClick={() => toggle(key)}
                            className="w-full flex items-center justify-between gap-3 text-sm text-left hover:bg-kp-surface2/60 rounded-lg -mx-2 px-2 py-1 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <svg className={`w-3.5 h-3.5 text-kp-gray flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                              <span className="text-kp-gray-lt truncate">{f.sucursal_origen_nombre}</span>
                              <Flecha />
                              <span className="text-kp-white font-medium truncate">{f.sucursal_destino_nombre}</span>
                              <span className="text-xs text-kp-gray/70 whitespace-nowrap">
                                · {f.traspasos_count} {Number(f.traspasos_count) === 1 ? 'traspaso' : 'traspasos'} · {f.unidades} u.
                              </span>
                            </div>
                            <span className="text-kp-gray-lt tabular-nums whitespace-nowrap">{ars.format(Number(f.costo_total))}</span>
                          </button>

                          {open && (
                            <div className="ml-5 mt-1.5 mb-2 rounded-lg border border-kp-border overflow-hidden">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="bg-kp-surface2 text-kp-gray">
                                    <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wide">Artículo</th>
                                    <th className="text-right px-3 py-1.5 font-semibold uppercase tracking-wide">Unid.</th>
                                    <th className="text-right px-3 py-1.5 font-semibold uppercase tracking-wide">Costo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-kp-border">
                                  {articulos.map((art, j) => (
                                    <tr key={j} className="hover:bg-kp-surface2/50">
                                      <td className="px-3 py-1.5">
                                        <span className="text-kp-gray-lt">{art.nombre}</span>
                                        <span className="text-kp-gray/50 font-mono ml-2">{art.codigo}</span>
                                      </td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-kp-gray-lt">{art.unidades}</td>
                                      <td className="px-3 py-1.5 text-right tabular-nums text-kp-white">{ars.format(Number(art.costo_total))}</td>
                                    </tr>
                                  ))}
                                  {articulos.length === 0 && (
                                    <tr><td colSpan={3} className="px-3 py-2 text-center text-kp-gray">Sin detalle.</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
