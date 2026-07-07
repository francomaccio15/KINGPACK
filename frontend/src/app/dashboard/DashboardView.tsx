'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConciliacionCard from './ConciliacionCard';

// ─── Types ────────────────────────────────────────────────────────────────────
export type DayData = { dia: string; cantidad: number; monto: number };

export type ChequeItem = {
  id: string;
  banco: string;
  numero_cheque: string;
  fecha_vencimiento: string;
  importe: number;
  dias: number;
  referencia: string;
};

export type MedioPagoData = {
  nombre:   string;
  cantidad: number;
  monto:    number;
};

export type CuentaData = {
  cuenta_destino: string;
  cantidad:       number;
  monto:          number;
  monto_mes?:     number;
};

export type TransaccionHoy = {
  id:         string;
  numero:     number;
  fecha:      string;
  estado:     string;
  total:      number;
  cliente:    string;
  medios_pago: string | null;
};

export type CajaFuerteData = {
  sucursal_id:     string;
  sucursal_nombre: string;
  saldo:           number;
  updated_at:      string | null;
};

export type SaldoBancarioData = {
  id:     string;
  nombre: string;
  banco:  string | null;
  saldo:  number;
};

export type DashboardData = {
  ventas_hoy:        { cantidad: number; monto: number };
  ventas_ayer:       { cantidad: number; monto: number };
  ventas_mes:        { cantidad: number; monto: number };
  ventas_mes_ant:    { cantidad: number; monto: number };
  costo_mercaderia_hoy:     { monto: number };
  costo_mercaderia_ayer:    { monto: number };
  costo_mercaderia_mes:     { monto: number };
  costo_mercaderia_mes_ant: { monto: number };
  gastos_operativos_hoy:     { monto: number };
  gastos_operativos_ayer:    { monto: number };
  gastos_operativos_mes:     { monto: number };
  gastos_operativos_mes_ant: { monto: number };
  resultado_hoy:     number;
  resultado_ayer:    number;
  resultado_mes:     number;
  resultado_mes_ant: number;
  stock_bajo:        number;
  pedidos_pendientes: number;
  ventas_mes_diario: DayData[];
  ultimas_ventas: {
    id: string; numero: number; total: number;
    fecha: string; estado: string; cliente: string | null;
  }[];
  cheques_a_cobrar:       ChequeItem[];
  cheques_a_pagar:        ChequeItem[];
  ventas_por_medio:       MedioPagoData[];
  transacciones_hoy:      TransaccionHoy[];
  cobros_por_cuenta_hoy:  CuentaData[];
  cobros_por_cuenta_mes:  { cuenta_destino: string; monto_mes: number }[];
  caja_fuerte:            CajaFuerteData[];
  saldos_bancarios:       SaldoBancarioData[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return fmt(n);
};

function calcTrend(ahora: number, antes: number) {
  if (antes === 0) return null;
  return ((ahora - antes) / Math.abs(antes)) * 100;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LastUpdated({ since }: { since: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor((Date.now() - since) / 1000);
  const label =
    secs < 5   ? 'ahora mismo' :
    secs < 60  ? `hace ${secs}s` :
                 `hace ${Math.floor(secs / 60)}min`;
  return <span className="text-xs text-kp-gray">{label}</span>;
}

function TrendBadge({ ahora, antes, label }: { ahora: number; antes: number; label: string }) {
  const pct = calcTrend(ahora, antes);
  if (pct === null) return <span className="text-xs text-kp-gray">{label}</span>;
  const up = pct >= 0;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={[
        'inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full',
        up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400',
      ].join(' ')}>
        {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
      </span>
      <span className="text-xs text-kp-gray">{label}</span>
    </div>
  );
}

function KpiCard({
  label, value, sub, iconBg, iconColor, icon, trendAhora, trendAntes, trendLabel, negative,
}: {
  label: string; value: string; sub?: string;
  iconBg: string; iconColor: string; icon: React.ReactNode;
  trendAhora?: number; trendAntes?: number; trendLabel?: string;
  negative?: boolean;
}) {
  return (
    <div className={[
      'rounded-xl border bg-kp-surface p-5 flex flex-col gap-4 transition-colors',
      negative ? 'border-rose-500/30' : 'border-kp-border hover:border-kp-border/70',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        {trendAhora !== undefined && trendAntes !== undefined && trendLabel && (
          <TrendBadge ahora={trendAhora} antes={trendAntes} label={trendLabel} />
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray mb-1">{label}</p>
        <p className={`text-2xl font-bold leading-none ${negative ? 'text-rose-400' : 'text-kp-white'}`}>{value}</p>
        {sub && <p className="text-xs text-kp-gray mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function QuickAction({ href, label, sub, iconBg, iconColor, icon }: {
  href: string; label: string; sub: string;
  iconBg: string; iconColor: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-xl border border-kp-border bg-kp-surface p-4 hover:bg-kp-surface2 hover:border-kp-border/60 transition-all duration-150">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg} group-hover:scale-110 transition-transform duration-150`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-kp-white leading-none">{label}</p>
        <p className="text-xs text-kp-gray mt-1">{sub}</p>
      </div>
    </Link>
  );
}

function VencimientoBadge({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 whitespace-nowrap">
        Vencido {Math.abs(dias)}d
      </span>
    );
  }
  if (dias === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 whitespace-nowrap">
        Vence hoy
      </span>
    );
  }
  if (dias <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 whitespace-nowrap">
        {dias}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 whitespace-nowrap">
      {dias}d
    </span>
  );
}

function ChequesPanel({ titulo, cheques, acento }: {
  titulo: string;
  cheques: ChequeItem[];
  acento: 'emerald' | 'violet';
}) {
  const acentoClasses = {
    emerald: { border: 'border-emerald-500/20', dot: 'bg-emerald-400', label: 'text-emerald-400', sum: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    violet:  { border: 'border-violet-500/20',  dot: 'bg-violet-400',  label: 'text-violet-400',  sum: 'text-violet-400',  badge: 'bg-violet-500/10  text-violet-400  border-violet-500/20'  },
  }[acento];

  const total = cheques.reduce((a, c) => a + c.importe, 0);
  const vencidos = cheques.filter(c => c.dias < 0).length;

  return (
    <div className={`rounded-xl border bg-kp-surface flex flex-col ${acentoClasses.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-kp-border">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${acentoClasses.dot}`} />
          <p className={`text-xs font-bold uppercase tracking-widest ${acentoClasses.label}`}>{titulo}</p>
          <span className="text-[10px] font-semibold text-kp-gray bg-kp-surface2 border border-kp-border rounded px-1.5 py-0.5">
            {cheques.length}
          </span>
          {vencidos > 0 && (
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1.5 py-0.5">
              {vencidos} vencido{vencidos !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className={`text-sm font-bold ${acentoClasses.sum}`}>{fmtCompact(total)}</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-kp-border/60 flex-1">
        {cheques.length === 0 ? (
          <p className="px-5 py-6 text-xs text-kp-gray text-center">
            Sin cheques próximos a vencer
          </p>
        ) : cheques.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-kp-surface2 transition-colors">
            {/* Banco + número */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-kp-white truncate">{c.referencia}</p>
              <p className="text-[10px] text-kp-gray mt-0.5 truncate">
                {c.banco} · #{c.numero_cheque}
              </p>
            </div>
            {/* Fecha + badge */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs font-bold text-kp-white">{fmt(c.importe)}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-kp-gray whitespace-nowrap">
                  {new Date(c.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
                <VencimientoBadge dias={c.dias} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoCart   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4.5 h-4.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
const IcoReceipt= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4.5 h-4.5"><path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="9" x2="16" y2="9"/></svg>;
const IcoTrend  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4.5 h-4.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
const IcoBox    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
const IcoOrder  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const IcoRefresh= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>;
const IcoWarn   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoCheque = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/><path d="M14 14h4"/></svg>;
const IcoCash   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>;
const IcoCard   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>;
const IcoTransfer=() => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const IcoQR     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="5" y="5" width="3" height="3"/><rect x="16" y="5" width="3" height="3"/><rect x="5" y="16" width="3" height="3"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/></svg>;
const IcoBank   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2L2 7h20L12 2z"/></svg>;
const IcoVault  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V6M12 18v-2.5M15.5 12H18M6 12h2.5"/></svg>;

// ─── Medio de pago helpers ────────────────────────────────────────────────────
function medioStyle(nombre: string): { icon: React.ReactNode; bg: string; color: string; bar: string } {
  const n = nombre.toLowerCase();
  if (n.includes('efectivo'))   return { icon: <IcoCash />,     bg: 'bg-emerald-500/10', color: 'text-emerald-400', bar: 'bg-emerald-500' };
  if (n.includes('crédito'))    return { icon: <IcoCard />,     bg: 'bg-violet-500/10',  color: 'text-violet-400',  bar: 'bg-violet-500'  };
  if (n.includes('débito'))     return { icon: <IcoCard />,     bg: 'bg-sky-500/10',     color: 'text-sky-400',     bar: 'bg-sky-500'     };
  if (n.includes('transferen')) return { icon: <IcoTransfer />, bg: 'bg-blue-500/10',    color: 'text-blue-400',    bar: 'bg-blue-500'    };
  if (n.includes('mercado'))    return { icon: <IcoTransfer />, bg: 'bg-cyan-500/10',    color: 'text-cyan-400',    bar: 'bg-cyan-500'    };
  if (n.includes('qr'))         return { icon: <IcoQR />,       bg: 'bg-indigo-500/10',  color: 'text-indigo-400',  bar: 'bg-indigo-500'  };
  if (n.includes('cuenta'))     return { icon: <IcoBank />,     bg: 'bg-amber-500/10',   color: 'text-amber-400',   bar: 'bg-amber-500'   };
  if (n.includes('cheque'))     return { icon: <IcoCheque />,   bg: 'bg-rose-500/10',    color: 'text-rose-400',    bar: 'bg-rose-500'    };
  return                               { icon: <IcoCash />,     bg: 'bg-kp-surface2',    color: 'text-kp-gray',     bar: 'bg-kp-border'   };
}

// ─── CobrosDelDia component ───────────────────────────────────────────────────
function CobrosDelDia({
  medios, transacciones,
}: {
  medios: MedioPagoData[];
  transacciones: TransaccionHoy[];
}) {
  const totalMonto    = medios.reduce((a, m) => a + m.monto, 0);
  const totalOps      = transacciones.length;

  return (
    <section className="space-y-4">
      {/* Encabezado de sección */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray flex items-center gap-2">
          <span className="w-5 h-px bg-kp-border inline-block" />
          Cobros del día · por método de pago
          <span className="flex-1 h-px bg-kp-border inline-block" />
        </p>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-xs text-kp-gray">{totalOps} transacciones</span>
          <span className="text-sm font-bold text-kp-white">{fmt(totalMonto)}</span>
        </div>
      </div>

      {/* Cards por método */}
      {medios.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-8 text-center text-kp-gray text-sm">
          Sin cobros registrados hoy todavía.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {medios.map(m => {
            const s   = medioStyle(m.nombre);
            const pct = totalMonto > 0 ? (m.monto / totalMonto) * 100 : 0;
            return (
              <div key={m.nombre} className="rounded-xl border border-kp-border bg-kp-surface p-4 flex flex-col gap-3">
                {/* Icono + nombre */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                    <span className={s.color}>{s.icon}</span>
                  </div>
                  <p className="text-xs font-semibold text-kp-white leading-tight">{m.nombre}</p>
                </div>
                {/* Monto */}
                <div>
                  <p className={`text-lg font-bold leading-none ${s.color}`}>{fmt(m.monto)}</p>
                  <p className="text-[10px] text-kp-gray mt-1">{m.cantidad} op. · {pct.toFixed(1)}%</p>
                </div>
                {/* Barra proporcional */}
                <div className="h-1 rounded-full bg-kp-border/50 overflow-hidden">
                  <div className={`h-full rounded-full ${s.bar} opacity-70`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── EstadoCuentasPanel: caja fuerte + saldos bancarios (solo administrador) ───
function EstadoCuentasPanel({
  cajas, bancos,
}: {
  cajas: CajaFuerteData[];
  bancos: SaldoBancarioData[];
}) {
  const hayCajas  = cajas && cajas.length > 0;
  const hayBancos = bancos && bancos.length > 0;
  if (!hayCajas && !hayBancos) return null;

  const totalCajas  = (cajas  ?? []).reduce((a, c) => a + c.saldo, 0);
  const totalBancos = (bancos ?? []).reduce((a, c) => a + c.saldo, 0);
  const total       = totalCajas + totalBancos;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray flex items-center gap-2">
          <span className="w-5 h-px bg-kp-border inline-block" />
          Estado de cuentas
          <span className="flex-1 h-px bg-kp-border inline-block" />
        </p>
        <span className="text-xs text-kp-gray ml-3 flex-shrink-0">
          Total: <span className="text-kp-white font-bold">{fmt(total)}</span>
        </span>
      </div>

      {/* Caja fuerte */}
      {hayCajas && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cajas.map(c => (
            <div key={c.sucursal_id} className="rounded-xl border border-emerald-500/20 bg-kp-surface p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10">
                <span className="text-emerald-400"><IcoVault /></span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray mb-1">
                  Caja fuerte · {c.sucursal_nombre}
                </p>
                <p className="text-2xl font-bold leading-none text-emerald-400 tabular-nums">{fmt(c.saldo)}</p>
                {c.updated_at && (
                  <p className="text-[10px] text-kp-gray mt-1.5">
                    Últ. cierre: {new Date(c.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saldos bancarios */}
      {hayBancos && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bancos.map(b => (
            <div key={b.id} className="rounded-xl border border-kp-border bg-kp-surface p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-sky-500/10">
                <span className="text-sky-400"><IcoBank /></span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-kp-white leading-tight truncate">{b.nombre}</p>
                <p className="text-lg font-bold leading-none text-sky-400 tabular-nums mt-1">{fmt(b.saldo)}</p>
                {b.banco && <p className="text-[10px] text-kp-gray mt-1 truncate">{b.banco}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── CuentasBancariasPanel ────────────────────────────────────────────────────
function CuentasBancariasPanel({
  hoy,
  mes,
}: {
  hoy: CuentaData[];
  mes: { cuenta_destino: string; monto_mes: number }[];
}) {
  if (hoy.length === 0 && mes.length === 0) return null;

  // Merge hoy + mes keyed by cuenta_destino
  const allCuentas = Array.from(
    new Set([...hoy.map(c => c.cuenta_destino), ...mes.map(c => c.cuenta_destino)])
  );

  const totalHoy = hoy.reduce((a, c) => a + c.monto, 0);

  // Color palette per account (cycles)
  const palettes = [
    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-400' },
    { bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     text: 'text-sky-400',     bar: 'bg-sky-500',     dot: 'bg-sky-400'     },
    { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-400',  bar: 'bg-violet-500',  dot: 'bg-violet-400'  },
    { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   bar: 'bg-amber-500',   dot: 'bg-amber-400'   },
    { bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400',    bar: 'bg-rose-500',    dot: 'bg-rose-400'    },
  ];

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray flex items-center gap-2">
          <span className="w-5 h-px bg-kp-border inline-block" />
          Cuentas bancarias · cobros
          <span className="flex-1 h-px bg-kp-border inline-block" />
        </p>
        {totalHoy > 0 && (
          <span className="text-xs text-kp-gray ml-3 flex-shrink-0">
            Hoy total: <span className="text-kp-white font-bold">{fmt(totalHoy)}</span>
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {allCuentas.map((cuenta, i) => {
          const pal     = palettes[i % palettes.length];
          const dataHoy = hoy.find(c => c.cuenta_destino === cuenta);
          const dataMes = mes.find(c => c.cuenta_destino === cuenta);
          const montoHoy = dataHoy?.monto ?? 0;
          const montoMes = dataMes?.monto_mes ?? 0;
          const pct      = totalHoy > 0 ? (montoHoy / totalHoy) * 100 : 0;

          // Shorten name for display
          const shortName = cuenta.length > 28 ? cuenta.slice(0, 26) + '…' : cuenta;

          return (
            <div key={cuenta} className={`rounded-xl border ${pal.border} bg-kp-surface p-4 flex flex-col gap-3`}>
              {/* Nombre cuenta */}
              <div className="flex items-start gap-2">
                <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${pal.dot}`} />
                <p className="text-xs font-semibold text-kp-white leading-tight">{shortName}</p>
              </div>

              {/* HOY */}
              <div>
                <p className="text-[9px] uppercase tracking-widest text-kp-gray mb-0.5">Hoy</p>
                <p className={`text-xl font-bold leading-none ${pal.text}`}>
                  {fmt(montoHoy)}
                </p>
                {dataHoy && (
                  <p className="text-[10px] text-kp-gray mt-1">
                    {dataHoy.cantidad} {dataHoy.cantidad === 1 ? 'operación' : 'operaciones'}
                    {pct > 0 && ` · ${pct.toFixed(1)}%`}
                  </p>
                )}
                {montoHoy === 0 && (
                  <p className="text-[10px] text-kp-gray mt-1">Sin movimientos hoy</p>
                )}
              </div>

              {/* Barra proporcional */}
              <div className="h-1 rounded-full bg-kp-border/40 overflow-hidden">
                <div className={`h-full rounded-full ${pal.bar} opacity-70 transition-all`} style={{ width: `${pct}%` }} />
              </div>

              {/* MES */}
              <div className="pt-1 border-t border-kp-border/50">
                <p className="text-[9px] uppercase tracking-widest text-kp-gray mb-0.5">Este mes</p>
                <p className="text-sm font-semibold text-kp-white tabular-nums">
                  {fmt(montoMes)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── VentasMesTabla: registro diario del mes en curso ─────────────────────────
function VentasMesTabla({ data }: { data: DayData[] }) {
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const totalMonto = data.reduce((a, d) => a + d.monto, 0);
  const totalOps   = data.reduce((a, d) => a + d.cantidad, 0);
  const maxMonto   = Math.max(...data.map(d => d.monto), 1);
  const hoyStr     = new Date().toISOString().slice(0, 10);

  // Acumulado del mes hasta cada día (orden ascendente)
  let acum = 0;
  const filas = data.map(d => {
    acum += d.monto;
    const fecha = new Date(d.dia + 'T12:00:00');
    return {
      ...d,
      acumulado: acum,
      esHoy: d.dia === hoyStr,
      dayLabel: DAYS[fecha.getDay()],
      diaNum: fecha.getDate(),
    };
  });

  const mesLabel = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <section className="rounded-xl border border-kp-border overflow-hidden">
      <div className="px-4 py-3 border-b border-kp-border bg-kp-surface2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-kp-white">Registro de ventas del mes</p>
          <p className="text-xs text-kp-gray mt-0.5 capitalize">
            {mesLabel} · día por día hasta hoy
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-kp-gray">{totalOps} operaciones</span>
          <span className="text-sm font-bold text-kp-white">{fmt(totalMonto)}</span>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm bg-kp-surface">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-kp-border bg-kp-surface2">
              <th className="px-4 py-2.5 text-left  text-[10px] font-bold uppercase tracking-wider text-kp-gray">Día</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-kp-gray">Operaciones</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-kp-gray">Ventas del día</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-kp-gray hidden sm:table-cell">Acumulado mes</th>
              <th className="px-4 py-2.5 text-left  text-[10px] font-bold uppercase tracking-wider text-kp-gray hidden md:table-cell w-[28%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {filas.map(f => {
              const pct = (f.monto / maxMonto) * 100;
              return (
                <tr key={f.dia} className={`transition-colors ${f.esHoy ? 'bg-kp-red/5' : 'hover:bg-kp-surface2'}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${f.esHoy ? 'text-kp-red' : 'text-kp-white'}`}>
                      {String(f.diaNum).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] text-kp-gray ml-2">{f.esHoy ? 'Hoy' : f.dayLabel}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-kp-gray">
                    {f.cantidad > 0 ? f.cantidad : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right text-sm font-bold tabular-nums whitespace-nowrap ${f.monto > 0 ? 'text-kp-white' : 'text-kp-gray'}`}>
                    {f.monto > 0 ? fmt(f.monto) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-kp-gray whitespace-nowrap hidden sm:table-cell">
                    {fmt(f.acumulado)}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <div className="h-1.5 rounded-full bg-kp-border/40 overflow-hidden">
                      <div className="h-full rounded-full bg-kp-red opacity-70" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-kp-border bg-kp-surface2">
              <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-kp-gray">Total mes</td>
              <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-kp-white">{totalOps}</td>
              <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-kp-white whitespace-nowrap">{fmt(totalMonto)}</td>
              <td className="px-4 py-2.5 hidden sm:table-cell" />
              <td className="px-4 py-2.5 hidden md:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardView({
  data, userName, userRol,
}: {
  data: DashboardData | null;
  userName: string;
  userRol?: string;
}) {
  const router   = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt]   = useState(Date.now());

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  const refresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => { setRefreshing(false); setUpdatedAt(Date.now()); }, 1400);
  }, [router]);

  if (!data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 text-kp-gray">
        <p>No se pudo cargar el resumen diario.</p>
        <button onClick={refresh} className="text-sm text-kp-red hover:underline">Reintentar</button>
      </div>
    );
  }

  const d = data;
  const tienesCheques = d.cheques_a_cobrar.length > 0 || d.cheques_a_pagar.length > 0;
  const chequesVencidos = [...d.cheques_a_cobrar, ...d.cheques_a_pagar].filter(c => c.dias < 0).length;

  return (
    <div className="p-5 md:p-7 space-y-6 max-w-6xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-5 bg-kp-red rounded-full block" />
            <h1 className="text-xl font-bold text-kp-white">Resumen diario</h1>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {greeting}, <span className="text-kp-white font-medium">{(userName ?? '').split(' ')[0]}</span>
            {' · '}
            <span className="capitalize">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <LastUpdated since={updatedAt} />
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-kp-border bg-kp-surface hover:bg-kp-surface2 text-kp-gray hover:text-kp-white text-xs font-medium transition-all disabled:opacity-50"
          >
            <span className={refreshing ? 'animate-spin' : ''}><IcoRefresh /></span>
            Actualizar
          </button>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction href="/ventas"               label="Nueva Venta"   sub="Registrar operación"   iconBg="bg-emerald-500/10" iconColor="text-emerald-400" icon={<IcoCart />} />
        <QuickAction href="/gastos/nuevo"          label="Nuevo Egreso"  sub="Egresos y compras"     iconBg="bg-amber-500/10"   iconColor="text-amber-400"   icon={<IcoReceipt />} />
        <QuickAction href="/articulos"             label="Artículos"     sub="Gestionar catálogo"    iconBg="bg-sky-500/10"     iconColor="text-sky-400"     icon={<IcoBox />} />
        <QuickAction href="/pedidos-proveedores"   label="Pedidos"       sub="Órdenes a proveedores" iconBg="bg-violet-500/10"  iconColor="text-violet-400"  icon={<IcoOrder />} />
      </div>

      {/* ── Alerts ── */}
      {(d.stock_bajo > 0 || d.pedidos_pendientes > 0 || chequesVencidos > 0) && (
        <div className="flex flex-wrap gap-2">
          {chequesVencidos > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <IcoCheque />
              {chequesVencidos} cheque{chequesVencidos !== 1 ? 's' : ''} vencido{chequesVencidos !== 1 ? 's' : ''}
            </div>
          )}
          {d.stock_bajo > 0 && (
            <Link href="/articulos?stock_bajo=true" className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/15 transition-colors">
              <IcoWarn />
              {d.stock_bajo} artículo{d.stock_bajo !== 1 ? 's' : ''} con stock bajo
              <span className="text-amber-500/60 ml-1">→</span>
            </Link>
          )}
          {d.pedidos_pendientes > 0 && (
            <Link href="/pedidos-proveedores" className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400 text-xs font-semibold hover:bg-violet-500/15 transition-colors">
              <IcoOrder />
              {d.pedidos_pendientes} pedido{d.pedidos_pendientes !== 1 ? 's' : ''} pendiente{d.pedidos_pendientes !== 1 ? 's' : ''}
              <span className="text-violet-500/60 ml-1">→</span>
            </Link>
          )}
        </div>
      )}

      {/* ── KPI Hoy ── */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray mb-3 flex items-center gap-2">
          <span className="w-5 h-px bg-kp-border inline-block" />
          Hoy
          <span className="flex-1 h-px bg-kp-border inline-block" />
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Ventas" value={fmt(d.ventas_hoy.monto)}
            sub={`${d.ventas_hoy.cantidad} op.`}
            iconBg="bg-emerald-500/10" iconColor="text-emerald-400" icon={<IcoCart />}
            trendAhora={d.ventas_hoy.monto} trendAntes={d.ventas_ayer.monto} trendLabel="vs ayer"
          />
          <KpiCard
            label="Costo de mercadería" value={fmt(d.costo_mercaderia_hoy.monto)}
            iconBg="bg-orange-500/10" iconColor="text-orange-400" icon={<IcoBox />}
            trendAhora={d.costo_mercaderia_hoy.monto} trendAntes={d.costo_mercaderia_ayer.monto} trendLabel="vs ayer"
          />
          <KpiCard
            label="Gastos operativos" value={fmt(d.gastos_operativos_hoy.monto)}
            iconBg="bg-amber-500/10" iconColor="text-amber-400" icon={<IcoReceipt />}
            trendAhora={d.gastos_operativos_hoy.monto} trendAntes={d.gastos_operativos_ayer.monto} trendLabel="vs ayer"
          />
          <KpiCard
            label="Resultado" value={fmt(d.resultado_hoy)}
            iconBg={d.resultado_hoy >= 0 ? 'bg-sky-500/10' : 'bg-rose-500/10'}
            iconColor={d.resultado_hoy >= 0 ? 'text-sky-400' : 'text-rose-400'} icon={<IcoTrend />}
            trendAhora={d.resultado_hoy} trendAntes={d.resultado_ayer} trendLabel="vs ayer"
            negative={d.resultado_hoy < 0}
          />
        </div>
      </section>

      {/* ── Estado de cuentas (caja fuerte + bancos) — solo administrador ── */}
      {userRol === 'administrador' && (
        <EstadoCuentasPanel
          cajas={d.caja_fuerte ?? []}
          bancos={d.saldos_bancarios ?? []}
        />
      )}

      {/* ── Cobros del día por medio de pago ── */}
      <CobrosDelDia
        medios={d.ventas_por_medio ?? []}
        transacciones={d.transacciones_hoy ?? []}
      />

      {/* ── Cuentas bancarias ── */}
      <CuentasBancariasPanel
        hoy={d.cobros_por_cuenta_hoy ?? []}
        mes={d.cobros_por_cuenta_mes ?? []}
      />

      {/* ── Conciliación bancaria (acreditado vs ARCA del mes anterior) ── */}
      <ConciliacionCard />

      {/* ── KPI Mes ── */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray mb-3 flex items-center gap-2">
          <span className="w-5 h-px bg-kp-border inline-block" />
          Este mes
          <span className="flex-1 h-px bg-kp-border inline-block" />
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Ventas" value={fmt(d.ventas_mes.monto)}
            sub={`${d.ventas_mes.cantidad} op.`}
            iconBg="bg-emerald-500/10" iconColor="text-emerald-400" icon={<IcoCart />}
            trendAhora={d.ventas_mes.monto} trendAntes={d.ventas_mes_ant.monto} trendLabel="vs mes ant."
          />
          <KpiCard
            label="Costo de mercadería" value={fmt(d.costo_mercaderia_mes.monto)}
            iconBg="bg-orange-500/10" iconColor="text-orange-400" icon={<IcoBox />}
            trendAhora={d.costo_mercaderia_mes.monto} trendAntes={d.costo_mercaderia_mes_ant.monto} trendLabel="vs mes ant."
          />
          <KpiCard
            label="Gastos operativos" value={fmt(d.gastos_operativos_mes.monto)}
            iconBg="bg-amber-500/10" iconColor="text-amber-400" icon={<IcoReceipt />}
            trendAhora={d.gastos_operativos_mes.monto} trendAntes={d.gastos_operativos_mes_ant.monto} trendLabel="vs mes ant."
          />
          <KpiCard
            label="Resultado" value={fmt(d.resultado_mes)}
            iconBg={d.resultado_mes >= 0 ? 'bg-sky-500/10' : 'bg-rose-500/10'}
            iconColor={d.resultado_mes >= 0 ? 'text-sky-400' : 'text-rose-400'} icon={<IcoTrend />}
            trendAhora={d.resultado_mes} trendAntes={d.resultado_mes_ant} trendLabel="vs mes ant."
            negative={d.resultado_mes < 0}
          />
        </div>
      </section>

      {/* ── Registro de ventas del mes (día por día) ── */}
      <VentasMesTabla data={d.ventas_mes_diario ?? []} />

      {/* ── Cheques próximos — solo administrador ── */}
      {tienesCheques && userRol === 'administrador' && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-kp-border inline-block" />
            Cheques próximos · 30 días
            <span className="flex-1 h-px bg-kp-border inline-block" />
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChequesPanel
              titulo="A cobrar"
              cheques={d.cheques_a_cobrar}
              acento="emerald"
            />
            <ChequesPanel
              titulo="A pagar"
              cheques={d.cheques_a_pagar}
              acento="violet"
            />
          </div>
        </section>
      )}


    </div>
  );
}
