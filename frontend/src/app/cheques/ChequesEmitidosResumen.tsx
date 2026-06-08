'use client';

import { useState } from 'react';
import CambiarEstado from './CambiarEstado';

interface ChequeEmitido {
  proveedor_nombre: string;
  proveedor_id:     string | null;
  nro_factura:      string | null;
  egreso_id:        string;
  cheque_id:        string;
  banco:            string;
  numero_cheque:    string;
  fecha_emision:    string | null;
  fecha_vencimiento: string;
  importe:          string;
  estado:           string;
  fecha_estado:     string | null;
  mes_venc:         string;
  sucursal_nombre:  string;
}

const BADGE: Record<string, string> = {
  emitido:    'bg-blue-900/50 text-blue-300 border-blue-700/50',
  presentado: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
  debitado:   'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  rechazado:  'bg-red-900/50 text-red-300 border-red-700/50',
  anulado:    'bg-zinc-800 text-zinc-400 border-zinc-600',
};

const LABEL_ESTADO: Record<string, string> = {
  emitido: 'Emitido', presentado: 'Presentado', debitado: 'Debitado',
  rechazado: 'Rechazado', anulado: 'Anulado',
};

function fmt(n: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));
}

function fmtMes(iso: string) {
  const [y, m] = iso.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }).replace('.', '');
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR');
}

interface Props {
  cheques: ChequeEmitido[];
  meses:   string[];
}

export default function ChequesEmitidosResumen({ cheques, meses }: Props) {
  const [expandido, setExpandido] = useState<string | null>(null);

  if (cheques.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-12 text-center text-kp-gray text-sm">
        No hay cheques emitidos registrados en el período.
      </div>
    );
  }

  // Agrupar por proveedor + nro_factura
  type Grupo = {
    key:              string;
    proveedor_nombre: string;
    proveedor_id:     string | null;
    nro_factura:      string | null;
    egreso_id:        string;
    sucursal_nombre:  string;
    cheques:          ChequeEmitido[];
    totalGeneral:     number;
    porMes:           Record<string, number>;
  };

  const gruposMap = new Map<string, Grupo>();
  for (const ch of cheques) {
    const key = `${ch.proveedor_id ?? 'sin'}_${ch.egreso_id}`;
    if (!gruposMap.has(key)) {
      gruposMap.set(key, {
        key,
        proveedor_nombre: ch.proveedor_nombre,
        proveedor_id:     ch.proveedor_id,
        nro_factura:      ch.nro_factura,
        egreso_id:        ch.egreso_id,
        sucursal_nombre:  ch.sucursal_nombre,
        cheques:          [],
        totalGeneral:     0,
        porMes:           {},
      });
    }
    const g = gruposMap.get(key)!;
    g.cheques.push(ch);
    g.totalGeneral += parseFloat(ch.importe) || 0;
    const mesKey = ch.mes_venc ? new Date(ch.mes_venc).toISOString().slice(0, 7) : '';
    if (mesKey) g.porMes[mesKey] = (g.porMes[mesKey] || 0) + (parseFloat(ch.importe) || 0);
  }

  const grupos = [...gruposMap.values()].sort((a, b) =>
    a.proveedor_nombre.localeCompare(b.proveedor_nombre)
  );

  // Totales por mes
  const totalesPorMes: Record<string, number> = {};
  for (const g of grupos) {
    for (const [mes, monto] of Object.entries(g.porMes)) {
      totalesPorMes[mes] = (totalesPorMes[mes] || 0) + monto;
    }
  }
  const totalGeneral = grupos.reduce((s, g) => s + g.totalGeneral, 0);

  // Comprometido (emitido + presentado)
  const comprometido = cheques
    .filter(c => ['emitido', 'presentado'].includes(c.estado))
    .reduce((s, c) => s + parseFloat(c.importe), 0);

  const rechazado = cheques
    .filter(c => c.estado === 'rechazado')
    .reduce((s, c) => s + parseFloat(c.importe), 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total período',    value: fmt(totalGeneral),  cls: 'text-kp-white' },
          { label: 'Comprometido',     value: fmt(comprometido),  cls: comprometido > 0 ? 'text-orange-300 font-bold' : 'text-kp-gray' },
          { label: 'Rechazados',       value: fmt(rechazado),     cls: rechazado > 0 ? 'text-red-400 font-bold' : 'text-kp-gray' },
          { label: 'Facturas/egresos', value: String(grupos.length), cls: 'text-kp-white' },
        ].map(card => (
          <div key={card.label} className="bg-kp-surface border border-kp-border rounded-xl p-4">
            <p className="text-xs text-kp-gray uppercase tracking-wide font-semibold mb-1">{card.label}</p>
            <p className={`text-xl font-bold tabular-nums ${card.cls}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla pivot por mes */}
      <div className="rounded-xl border border-kp-border overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-kp-surface2 text-kp-gray text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-kp-surface2 z-10 min-w-[180px]">
                Proveedor
              </th>
              <th className="px-4 py-3 text-left font-semibold min-w-[120px]">N° Factura</th>
              <th className="px-4 py-3 text-left font-semibold">Sucursal</th>
              {meses.map(m => (
                <th key={m} className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {fmtMes(m)}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {grupos.map(g => (
              <>
                {/* Fila del grupo */}
                <tr
                  key={g.key}
                  className="hover:bg-kp-surface2 transition-colors cursor-pointer"
                  onClick={() => setExpandido(expandido === g.key ? null : g.key)}
                >
                  <td className="px-4 py-3 sticky left-0 bg-kp-surface hover:bg-kp-surface2 transition-colors z-10">
                    <div className="flex items-center gap-2">
                      <svg
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        className={`w-3 h-3 text-kp-gray flex-shrink-0 transition-transform ${expandido === g.key ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="font-semibold text-kp-white truncate">{g.proveedor_nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-kp-gray font-mono text-xs">
                    {g.nro_factura ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-kp-gray text-xs">{g.sucursal_nombre}</td>
                  {meses.map(m => (
                    <td key={m} className="px-4 py-3 text-right tabular-nums">
                      {g.porMes[m] ? (
                        <span className="font-semibold text-kp-white">{fmt(g.porMes[m])}</span>
                      ) : (
                        <span className="text-kp-border text-xs">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-kp-white">
                    {fmt(g.totalGeneral)}
                  </td>
                </tr>

                {/* Detalle de cheques del grupo */}
                {expandido === g.key && g.cheques.map(ch => (
                  <tr key={ch.cheque_id} className="bg-kp-surface2/60 border-b border-kp-border/40">
                    <td className="pl-10 pr-4 py-2.5 sticky left-0 bg-kp-surface2/80 z-10" colSpan={1}>
                      <p className="text-xs font-medium text-kp-white">{ch.banco}</p>
                      <p className="text-xs text-kp-gray font-mono">{ch.numero_cheque}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-kp-gray">
                      Vcto: <span className="text-kp-white">{fmtFecha(ch.fecha_vencimiento)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${BADGE[ch.estado] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600'}`}>
                        {LABEL_ESTADO[ch.estado] ?? ch.estado}
                      </span>
                    </td>
                    {meses.map(m => {
                      const mesCh = ch.mes_venc ? new Date(ch.mes_venc).toISOString().slice(0, 7) : '';
                      return (
                        <td key={m} className="px-4 py-2.5 text-right tabular-nums text-xs">
                          {mesCh === m ? (
                            <span className="text-kp-white font-semibold">{fmt(ch.importe)}</span>
                          ) : (
                            <span className="text-kp-border">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-kp-white">
                      {fmt(ch.importe)}
                    </td>
                  </tr>
                ))}

                {expandido === g.key && (
                  <tr className="bg-kp-surface2/60">
                    <td colSpan={3 + meses.length + 1} className="px-10 py-2 text-right">
                      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                        {/* Botón cambiar estado para cada cheque ya está arriba */}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}

            {/* Fila de totales */}
            <tr className="bg-kp-surface2 font-bold border-t-2 border-kp-border">
              <td className="px-4 py-3 sticky left-0 bg-kp-surface2 z-10 text-kp-white text-xs uppercase tracking-wide" colSpan={3}>
                TOTALES
              </td>
              {meses.map(m => (
                <td key={m} className="px-4 py-3 text-right tabular-nums text-sm">
                  {totalesPorMes[m] ? (
                    <span className="text-kp-white">{fmt(totalesPorMes[m])}</span>
                  ) : (
                    <span className="text-kp-border">—</span>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right tabular-nums text-sm text-kp-white">
                {fmt(totalGeneral)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
