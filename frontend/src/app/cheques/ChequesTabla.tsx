'use client';

import { useState } from 'react';
import CambiarEstado from './CambiarEstado';
import FichaCheque from './FichaCheque';
import { ACCIONES, CAUSALES_RECHAZO, ESTADO_BADGE as BADGE, ESTADO_LABEL as LABEL_ESTADO } from '@/lib/cheques';
import { EmptyState, MobileCards, RecordCard, TableWrap } from '@/components/ui/ResponsiveTable';

interface Cheque {
  tipo:              'recibido' | 'emitido';
  id:                string;
  banco:             string;
  numero_cheque:     string;
  fecha_emision:     string | null;
  fecha_vencimiento: string;
  importe:           string;
  estado:            string;
  fecha_estado:      string | null;
  observaciones:     string | null;
  origen_nombre:     string;
  sucursal_nombre:   string;
  vencido:           boolean;
  // mig 059 — NULL en el histórico
  forma?:            'fisico' | 'echeq' | null;
  modalidad?:        'al_dia' | 'diferido' | null;
  librador_cuit?:    string | null;
  librador_nombre?:  string | null;
  rechazo_causal?:   string | null;
}

// Acción habitual del cheque como botón directo; el resto, en la ficha.
function AccionPrincipal({ c }: { c: Cheque }) {
  const a = ACCIONES[c.tipo][c.estado]?.[0];
  if (!a) return null;
  return <CambiarEstado chequeId={c.id} tipo={c.tipo} estadoActual={c.estado} estadoFijo={a.estado} label={a.label} primario />;
}

const btnVer = 'px-3 py-1.5 text-xs font-semibold rounded-md border border-kp-border text-kp-gray-lt hover:text-kp-white hover:border-kp-white transition-colors';

function fmt(n: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  // La fecha puede venir como 'YYYY-MM-DD' o como ISO completo
  // ('2026-07-09T00:00:00.000Z'). Tomamos solo la parte de fecha para
  // evitar 'Invalid Date' y desfases de zona horaria.
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

interface Props {
  cheques:     Cheque[];
  tipoActivo:  string;
}

export default function ChequesTabla({ cheques, tipoActivo }: Props) {
  const [ficha, setFicha] = useState<Cheque | null>(null);

  if (cheques.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-12 text-center text-kp-gray text-sm">
        No hay cheques con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div>
      <TableWrap>
      <table className="w-full text-sm table-fixed">
        <thead className="bg-kp-surface2 text-kp-gray text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-3 text-left font-semibold">Cheque</th>
            <th className="w-[118px] px-3 py-3 text-left font-semibold">Vencimiento</th>
            <th className="w-[140px] px-3 py-3 text-right font-semibold">Importe</th>
            <th className="w-[130px] px-3 py-3 text-left font-semibold">Estado</th>
            <th className="w-[22%] px-3 py-3 text-left font-semibold">Origen</th>
            <th className="w-[124px] px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-kp-border">
          {cheques.map(c => (
            <tr
              key={`${c.tipo}-${c.id}`}
              onClick={() => setFicha(c)}
              className={[
                'hover:bg-kp-surface2 transition-colors cursor-pointer',
                c.vencido ? 'bg-red-950/20' : '',
              ].join(' ')}
            >
              <td className="px-3 py-3 min-w-0">
                <p className="font-medium text-kp-white truncate">
                  {tipoActivo === 'todos' && (
                    <span className={[
                      'mr-1.5 px-1.5 py-px text-[10px] font-bold rounded border align-middle',
                      c.tipo === 'recibido'
                        ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                        : 'bg-orange-900/30 text-orange-300 border-orange-700/40',
                    ].join(' ')}>
                      {c.tipo === 'recibido' ? 'REC' : 'EMI'}
                    </span>
                  )}
                  {c.banco}
                  {c.forma === 'echeq' && (
                    <span className="ml-1.5 px-1.5 py-px text-[10px] font-bold rounded border border-sky-700/50 bg-sky-900/40 text-sky-300 align-middle">ECHEQ</span>
                  )}
                  {c.modalidad === 'diferido' && (
                    <span className="ml-1 px-1.5 py-px text-[10px] font-semibold rounded border border-kp-border text-kp-gray align-middle">CPD</span>
                  )}
                </p>
                <p className="text-xs text-kp-gray font-mono">{c.numero_cheque}</p>
                {c.librador_cuit && (
                  <p className="text-[11px] text-kp-gray truncate" title={`${c.librador_nombre ?? ''} ${c.librador_cuit}`}>
                    {c.librador_nombre} · <span className="font-mono">{c.librador_cuit}</span>
                  </p>
                )}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <span className={c.vencido ? 'text-red-400 font-semibold' : 'text-kp-white'}>
                  {fmtFecha(c.fecha_vencimiento)}
                </span>
                {c.vencido
                  ? <p className="text-xs text-red-400">Vencido</p>
                  : <p className="text-[11px] text-kp-gray">Emi. {fmtFecha(c.fecha_emision)}</p>}
              </td>
              <td className="px-3 py-3 text-right font-semibold text-kp-white whitespace-nowrap tabular-nums">
                {fmt(c.importe)}
              </td>
              <td className="px-3 py-3">
                <span className={[
                  'inline-block px-2 py-0.5 text-xs font-semibold rounded border',
                  BADGE[c.estado] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600',
                ].join(' ')}>
                  {LABEL_ESTADO[c.estado] ?? c.estado}
                </span>
                {c.fecha_estado && (
                  <p className="text-xs text-kp-gray mt-0.5">{fmtFecha(c.fecha_estado)}</p>
                )}
                {c.estado === 'rechazado' && c.rechazo_causal && (
                  <p className="text-[11px] text-red-400 mt-0.5">{CAUSALES_RECHAZO[c.rechazo_causal] ?? c.rechazo_causal}</p>
                )}
              </td>
              <td className="px-3 py-3 min-w-0">
                <p className="text-kp-gray truncate" title={c.origen_nombre}>{c.origen_nombre}</p>
                <p className="text-[11px] text-kp-gray/70">{c.sucursal_nombre}</p>
              </td>
              {/* stopPropagation: los modales de la acción son hijos de esta
                  fila en React y sus clics abrirían también la ficha. */}
              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-stretch gap-1.5 [&>button]:w-full">
                  <AccionPrincipal c={c} />
                  <button type="button" onClick={() => setFicha(c)} className={btnVer}>Ver</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableWrap>

      {/* Mobile: importe y vencimiento son lo que se consulta; el cambio de
          estado queda al pie de la tarjeta, a ancho completo. */}
      <MobileCards>
        {cheques.map(c => (
          <RecordCard
            key={`card-${c.tipo}-${c.id}`}
            title={`${c.banco}${c.forma === 'echeq' ? ' · ECHEQ' : ''}`}
            subtitle={`N° ${c.numero_cheque}${c.origen_nombre ? ' · ' + c.origen_nombre : ''}${c.estado === 'rechazado' && c.rechazo_causal ? ' · ' + (CAUSALES_RECHAZO[c.rechazo_causal] ?? c.rechazo_causal) : ''}`}
            badge={{
              label: LABEL_ESTADO[c.estado] ?? c.estado,
              tone: c.vencido ? 'danger' : c.estado === 'acreditado' ? 'ok' : 'neutral',
            }}
            fields={[
              { label: 'Importe', value: fmt(c.importe), strong: true },
              { label: c.vencido ? 'Vencido el' : 'Vence', value: fmtFecha(c.fecha_vencimiento), align: 'right' },
            ]}
            actions={
              <div className="flex-1 flex gap-2 [&>button]:flex-1">
                <AccionPrincipal c={c} />
                <button type="button" onClick={() => setFicha(c)} className={btnVer}>Ver</button>
              </div>
            }
          />
        ))}
        {cheques.length === 0 && <EmptyState title="No hay cheques para mostrar." />}
      </MobileCards>

      {ficha && <FichaCheque tipo={ficha.tipo} id={ficha.id} onClose={() => setFicha(null)} />}
    </div>
  );
}
