'use client';

// Calendario de cheques: qué entra y qué sale de la cuenta de cheques semana a
// semana y cómo queda el saldo. Contesta "¿me alcanza?" sin cruzar pestañas.
// Cada cheque cae en la semana en que impacta el banco (vencimiento + 2 días).

import { Fragment, useState } from 'react';
import { ESTADO_LABEL, formatoFecha, formatoMonto, type TipoCheque } from '@/lib/cheques';
import FichaCheque from './FichaCheque';

interface ChequeCal {
  tipo: TipoCheque;
  id: string;
  banco: string;
  numero_cheque: string;
  importe: number;
  estado: string;
  origen_nombre: string;
  librador_nombre: string | null;
  fecha_vencimiento: string;
  fecha_impacto: string;
  en_cuenta_cheques: boolean;
}

interface Grupo {
  desde?: string;
  hasta?: string;
  entran: number;
  salen: number;
  neto: number;
  saldo_proyectado?: number;
  cheques: ChequeCal[];
}

export interface Calendario {
  hoy: string;
  dias_impacto: number;
  cuenta: { nombre: string; saldo: number | null } | null;
  atrasados: Grupo;
  semanas: Grupo[];
  mas_adelante: Grupo;
}

const ddmm = (iso: string) => formatoFecha(iso).slice(0, 5);
const monto0 = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function etiquetaSemana(g: Grupo, i: number) {
  if (i === 0) return 'Esta semana';
  if (i === 1) return 'Próxima semana';
  return `${ddmm(g.desde!)} al ${ddmm(g.hasta!)}`;
}

function Kpi({ label, value, sub, tono }: { label: string; value: string; sub?: string; tono?: 'ok' | 'mal' }) {
  return (
    <div className={[
      'rounded-xl border p-4 space-y-1',
      tono === 'mal' ? 'bg-red-950/40 border-red-800/50' : 'bg-kp-surface border-kp-border',
    ].join(' ')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-kp-gray">{label}</p>
      <p className={[
        'text-base sm:text-lg xl:text-2xl font-bold tabular-nums whitespace-nowrap',
        tono === 'mal' ? 'text-red-400' : tono === 'ok' ? 'text-emerald-400' : 'text-kp-white',
      ].join(' ')}>{value}</p>
      {sub && <p className="text-xs text-kp-gray">{sub}</p>}
    </div>
  );
}

export default function ChequesCalendario({ data }: { data: Calendario }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ficha, setFicha] = useState<{ tipo: TipoCheque; id: string } | null>(null);

  const conSaldo = data.cuenta?.saldo != null;
  const filas: { key: string; titulo: string; sub?: string; g: Grupo }[] = [
    ...(data.atrasados.cheques.length
      ? [{ key: 'atrasados', titulo: 'Vencidos sin impactar', sub: 'El banco los toma en estos días', g: data.atrasados }]
      : []),
    ...data.semanas.map((g, i) => ({
      key: g.desde!, titulo: etiquetaSemana(g, i), sub: i < 2 ? `${ddmm(g.desde!)} al ${ddmm(g.hasta!)}` : undefined, g,
    })),
    ...(data.mas_adelante.cheques.length
      ? [{ key: 'mas', titulo: 'Más adelante', g: data.mas_adelante }]
      : []),
  ];

  const horizonte = [data.atrasados, ...data.semanas];
  const entran = horizonte.reduce((s, g) => s + g.entran, 0);
  const salen  = horizonte.reduce((s, g) => s + g.salen, 0);
  const ultimaSemana = data.semanas[data.semanas.length - 1];

  // Primera semana en que la cuenta queda en rojo: el aviso que importa.
  const enRojo = conSaldo ? filas.find(f => (f.g.saldo_proyectado ?? 0) < 0) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {conSaldo ? (
          <Kpi label={`Saldo hoy · ${data.cuenta!.nombre}`} value={monto0(data.cuenta!.saldo!)} />
        ) : (
          <Kpi label="Cuenta de cheques" value={data.cuenta?.nombre ?? 'Sin definir'} />
        )}
        <Kpi label={`Entran · ${data.semanas.length} semanas`} value={monto0(entran)} sub="Cheques de clientes" tono="ok" />
        <Kpi label={`Salen · ${data.semanas.length} semanas`} value={monto0(salen)} sub="Cheques propios" />
        {conSaldo ? (
          <Kpi
            label={`Saldo al ${ddmm(ultimaSemana.hasta!)}`}
            value={monto0(ultimaSemana.saldo_proyectado ?? 0)}
            sub="Si no entra ni sale otra plata"
            tono={(ultimaSemana.saldo_proyectado ?? 0) < 0 ? 'mal' : undefined}
          />
        ) : (
          <Kpi label="Neto" value={monto0(entran - salen)} tono={entran - salen < 0 ? 'mal' : 'ok'} />
        )}
      </div>

      {enRojo && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          <b>{enRojo.titulo}{enRojo.sub ? ` (${enRojo.sub})` : ''}</b> la cuenta de cheques queda en{' '}
          <b className="tabular-nums">{monto0(enRojo.g.saldo_proyectado!)}</b>. Hay que cubrir esa diferencia
          antes de que se debiten los cheques propios.
        </div>
      )}

      <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_140px_140px_140px_150px_28px] gap-3 px-4 py-2.5 bg-kp-surface2 text-xs uppercase tracking-wide text-kp-gray font-semibold">
          <span>Semana</span>
          <span className="text-right">Entran</span>
          <span className="text-right">Salen</span>
          <span className="text-right">Neto</span>
          <span className="text-right">{conSaldo ? 'Saldo proyectado' : ''}</span>
          <span />
        </div>

        <div className="divide-y divide-kp-border">
          {filas.map(({ key, titulo, sub, g }) => {
            const open = abierta === key;
            const vacia = g.cheques.length === 0;
            const rojo = conSaldo && (g.saldo_proyectado ?? 0) < 0;
            return (
              <Fragment key={key}>
                <button
                  type="button"
                  disabled={vacia}
                  onClick={() => setAbierta(open ? null : key)}
                  aria-expanded={open}
                  className={[
                    'w-full text-left px-4 py-3 grid grid-cols-2 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,130px))_minmax(0,150px)_20px] gap-x-3 gap-y-1 items-center transition-colors',
                    vacia ? 'opacity-50 cursor-default' : 'hover:bg-kp-surface2 cursor-pointer',
                    rojo ? 'bg-red-950/20' : '',
                  ].join(' ')}
                >
                  <span className="col-span-2 lg:col-span-1">
                    <span className="block font-semibold text-kp-white">{titulo}</span>
                    <span className="block text-xs text-kp-gray">
                      {sub ? `${sub} · ` : ''}
                      {vacia ? 'sin cheques' : `${g.cheques.length} cheque${g.cheques.length > 1 ? 's' : ''}`}
                    </span>
                  </span>
                  <span className="text-sm lg:text-right tabular-nums text-emerald-400">
                    <span className="lg:hidden text-xs text-kp-gray mr-1">Entran</span>
                    {g.entran ? `+${monto0(g.entran)}` : '—'}
                  </span>
                  <span className="text-sm text-right tabular-nums text-red-400">
                    <span className="lg:hidden text-xs text-kp-gray mr-1">Salen</span>
                    {g.salen ? `−${monto0(g.salen)}` : '—'}
                  </span>
                  <span className={`hidden lg:block text-sm text-right tabular-nums ${g.neto < 0 ? 'text-red-400' : 'text-kp-white'}`}>
                    {g.neto ? monto0(g.neto) : '—'}
                  </span>
                  <span className={`col-span-2 lg:col-span-1 text-sm text-right tabular-nums font-semibold ${rojo ? 'text-red-400' : 'text-kp-white'}`}>
                    {conSaldo && (
                      <>
                        <span className="lg:hidden text-xs font-normal text-kp-gray mr-1">Saldo proyectado</span>
                        {monto0(g.saldo_proyectado ?? 0)}
                      </>
                    )}
                  </span>
                  <span className="hidden lg:flex justify-end text-kp-gray">
                    {!vacia && (
                      <svg viewBox="0 0 24 24" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </span>
                </button>

                {open && (
                  <ul className="bg-kp-bg/40 divide-y divide-kp-border/60">
                    {g.cheques.map(c => (
                      <li key={`${c.tipo}-${c.id}`}>
                        <button
                          type="button"
                          onClick={() => setFicha({ tipo: c.tipo, id: c.id })}
                          className="w-full text-left px-4 lg:pl-8 py-2.5 flex items-center gap-3 hover:bg-kp-surface2 transition-colors"
                        >
                          <span className={[
                            'shrink-0 px-1.5 py-px text-[10px] font-bold rounded border',
                            c.tipo === 'recibido'
                              ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/40'
                              : 'bg-orange-900/30 text-orange-300 border-orange-700/40',
                          ].join(' ')}>
                            {c.tipo === 'recibido' ? 'ENTRA' : 'SALE'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-kp-white truncate">
                              {c.tipo === 'recibido' ? (c.librador_nombre || c.origen_nombre) : c.origen_nombre}
                            </span>
                            <span className="block text-[11px] text-kp-gray truncate">
                              {c.banco} #{c.numero_cheque} · vence {formatoFecha(c.fecha_vencimiento)} · {ESTADO_LABEL[c.estado] ?? c.estado}
                              {!c.en_cuenta_cheques && ' · otra cuenta'}
                            </span>
                          </span>
                          <span className={`shrink-0 text-sm font-semibold tabular-nums ${c.tipo === 'recibido' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {c.tipo === 'recibido' ? '+' : '−'}{formatoMonto(c.importe)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-kp-gray">
        Cada cheque cae en la semana en que impacta el banco: {data.dias_impacto} días después del vencimiento.
        Los cheques de clientes en cartera se cuentan como si se depositaran; los endosados no pasan por la cuenta.
        Tocá una semana para ver sus cheques y un cheque para ver su ficha.
      </p>

      {ficha && <FichaCheque tipo={ficha.tipo} id={ficha.id} onClose={() => setFicha(null)} />}
    </div>
  );
}
