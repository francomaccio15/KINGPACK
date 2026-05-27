'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export type DashboardData = {
  ventas_hoy:        { cantidad: number; monto: number };
  ventas_ayer:       { cantidad: number; monto: number };
  ventas_mes:        { cantidad: number; monto: number };
  ventas_mes_ant:    { cantidad: number; monto: number };
  egresos_hoy:       { monto: number };
  egresos_ayer:      { monto: number };
  egresos_mes:       { monto: number };
  egresos_mes_ant:   { monto: number };
  resultado_hoy:     number;
  resultado_ayer:    number;
  resultado_mes:     number;
  resultado_mes_ant: number;
  stock_bajo:        number;
  pedidos_pendientes: number;
  ventas_7dias:      DayData[];
  ultimas_ventas: {
    id: string; numero: number; total: number;
    fecha: string; estado: string; cliente: string | null;
  }[];
  cheques_a_cobrar: ChequeItem[];
  cheques_a_pagar:  ChequeItem[];
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

function AreaChart({ data }: { data: DayData[] }) {
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const W = 560; const H = 110;
  const PL = 4; const PR = 4; const PT = 20; const PB = 26;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const n   = data.length;
  const max = Math.max(...data.map(d => d.monto), 1);

  const pts = data.map((d, i) => ({
    x: PL + (n === 1 ? cW / 2 : (i / (n - 1)) * cW),
    y: PT + cH - (d.monto / max) * cH,
    ...d,
    dayLabel: DAYS[new Date(d.dia + 'T12:00:00').getDay()],
    isToday: i === n - 1,
  }));

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = n > 1
    ? `${line} L${pts[n-1].x.toFixed(1)},${(PT+cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PT+cH).toFixed(1)} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 110 }}>
      <defs>
        <linearGradient id="kp-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e3000f" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#e3000f" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.33, 0.66].map(f => (
        <line key={f}
          x1={PL} y1={(PT + cH * (1 - f)).toFixed(1)}
          x2={W - PR} y2={(PT + cH * (1 - f)).toFixed(1)}
          stroke="#2d2d2d" strokeWidth="1" strokeDasharray="3 4"
        />
      ))}

      {/* Area + line */}
      {n > 1 && <path d={area} fill="url(#kp-area)" />}
      {n > 1 && <path d={line} fill="none" stroke="#e3000f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

      {/* Points + labels */}
      {pts.map(p => (
        <g key={p.dia}>
          {/* Value above dot */}
          {p.monto > 0 && (
            <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="9" fill={p.isToday ? '#ffffff' : '#8a8a8a'} fontWeight={p.isToday ? '700' : '400'}>
              {fmtCompact(p.monto)}
            </text>
          )}
          {/* Outer ring on today */}
          {p.isToday && <circle cx={p.x} cy={p.y} r="7" fill="none" stroke="#e3000f" strokeWidth="1.5" strokeOpacity="0.4" />}
          {/* Dot */}
          <circle cx={p.x} cy={p.y} r={p.isToday ? 4.5 : 3} fill={p.isToday ? '#e3000f' : '#b80000'} />
          {/* Day label */}
          <text x={p.x} y={H - 5} textAnchor="middle" fontSize="10"
            fill={p.isToday ? '#e3000f' : '#8a8a8a'}
            fontWeight={p.isToday ? '700' : '400'}>
            {p.isToday ? 'Hoy' : p.dayLabel}
          </text>
        </g>
      ))}
    </svg>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    confirmada: 'bg-emerald-500/15 text-emerald-400',
    facturada:  'bg-sky-500/15 text-sky-400',
    preventa:   'bg-amber-500/15 text-amber-400',
    anulada:    'bg-rose-500/15 text-rose-400',
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${map[estado] ?? 'bg-kp-surface2 text-kp-gray'}`}>
      {estado}
    </span>
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
const IcoPct    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4.5 h-4.5"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>;
const IcoBox    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
const IcoOrder  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
const IcoRefresh= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>;
const IcoWarn   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoCheque = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/><path d="M14 14h4"/></svg>;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardView({
  data, userName,
}: {
  data: DashboardData | null;
  userName: string;
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
  const margenHoy = d.ventas_hoy.monto > 0 ? (d.resultado_hoy / d.ventas_hoy.monto) * 100 : 0;
  const margenMes = d.ventas_mes.monto > 0 ? (d.resultado_mes / d.ventas_mes.monto) * 100 : 0;
  const totalSemana = d.ventas_7dias.reduce((a, b) => a + b.monto, 0);
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
            {greeting}, <span className="text-kp-white font-medium">{userName.split(' ')[0]}</span>
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
        <QuickAction href="/gastos/nuevo"          label="Nuevo Egreso"  sub="Gastos y compras"      iconBg="bg-amber-500/10"   iconColor="text-amber-400"   icon={<IcoReceipt />} />
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
            label="Egresos" value={fmt(d.egresos_hoy.monto)}
            iconBg="bg-amber-500/10" iconColor="text-amber-400" icon={<IcoReceipt />}
            trendAhora={d.egresos_hoy.monto} trendAntes={d.egresos_ayer.monto} trendLabel="vs ayer"
          />
          <KpiCard
            label="Resultado" value={fmt(d.resultado_hoy)}
            iconBg={d.resultado_hoy >= 0 ? 'bg-sky-500/10' : 'bg-rose-500/10'}
            iconColor={d.resultado_hoy >= 0 ? 'text-sky-400' : 'text-rose-400'} icon={<IcoTrend />}
            trendAhora={d.resultado_hoy} trendAntes={d.resultado_ayer} trendLabel="vs ayer"
            negative={d.resultado_hoy < 0}
          />
          <KpiCard
            label="Margen" value={`${margenHoy.toFixed(1)}%`}
            iconBg="bg-violet-500/10" iconColor="text-violet-400" icon={<IcoPct />}
            negative={margenHoy < 0}
          />
        </div>
      </section>

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
            label="Egresos" value={fmt(d.egresos_mes.monto)}
            iconBg="bg-amber-500/10" iconColor="text-amber-400" icon={<IcoReceipt />}
            trendAhora={d.egresos_mes.monto} trendAntes={d.egresos_mes_ant.monto} trendLabel="vs mes ant."
          />
          <KpiCard
            label="Resultado" value={fmt(d.resultado_mes)}
            iconBg={d.resultado_mes >= 0 ? 'bg-sky-500/10' : 'bg-rose-500/10'}
            iconColor={d.resultado_mes >= 0 ? 'text-sky-400' : 'text-rose-400'} icon={<IcoTrend />}
            trendAhora={d.resultado_mes} trendAntes={d.resultado_mes_ant} trendLabel="vs mes ant."
            negative={d.resultado_mes < 0}
          />
          <KpiCard
            label="Margen" value={`${margenMes.toFixed(1)}%`}
            iconBg="bg-violet-500/10" iconColor="text-violet-400" icon={<IcoPct />}
            negative={margenMes < 0}
          />
        </div>
      </section>

      {/* ── Chart ── */}
      <section className="rounded-xl border border-kp-border bg-kp-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-kp-white">Ventas — últimos 7 días</p>
            <p className="text-xs text-kp-gray mt-0.5">Total del período: <span className="text-kp-white font-semibold">{fmt(totalSemana)}</span></p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-kp-gray px-2 py-1 rounded border border-kp-border">
            {d.ventas_7dias.reduce((a, b) => a + b.cantidad, 0)} operaciones
          </span>
        </div>
        <AreaChart data={d.ventas_7dias} />
      </section>

      {/* ── Cheques próximos ── */}
      {tienesCheques && (
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

      {/* ── Recent Sales ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray flex items-center gap-2">
            <span className="w-5 h-px bg-kp-border inline-block" />
            Últimas ventas
            <span className="flex-1 h-px bg-kp-border inline-block" />
          </p>
          <Link href="/ventas" className="text-xs text-kp-red hover:underline font-semibold">Ver todas →</Link>
        </div>
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kp-border">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-kp-gray">#</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-kp-gray">Cliente</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-kp-gray hidden md:table-cell">Estado</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-kp-gray">Total</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-kp-gray hidden sm:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {d.ultimas_ventas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-kp-gray text-sm">
                    No hay ventas registradas aún.
                  </td>
                </tr>
              ) : d.ultimas_ventas.map(v => (
                <tr key={v.id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/ventas/${v.id}`} className="font-mono font-bold text-kp-red hover:underline text-xs">
                      #{v.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-kp-white text-sm">
                    {v.cliente ?? <span className="text-kp-gray italic text-xs">Consumidor final</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell"><EstadoBadge estado={v.estado} /></td>
                  <td className="px-4 py-3 text-right font-semibold text-kp-white">{fmt(v.total)}</td>
                  <td className="px-4 py-3 text-right text-kp-gray text-xs hidden sm:table-cell whitespace-nowrap">
                    {new Date(v.fecha).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
