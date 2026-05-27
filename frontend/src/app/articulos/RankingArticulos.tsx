// Componente servidor puro — sin 'use client'

type RankingItem = {
  id: string;
  nombre: string;
  codigo: string;
  categoria: string;
  total_unidades: number;
  total_ingresos: number;
};

type Props = {
  mes: string;
  masVendidos: RankingItem[];
  menosVendidos: RankingItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPesos(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

function formatUnidades(n: number) {
  if (n === 0) return '0 u.';
  return `${n % 1 === 0 ? n.toLocaleString('es-AR') : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} u.`;
}

// ─── Medalla ──────────────────────────────────────────────────────────────────
function Medalla({ pos, variant }: { pos: number; variant: 'top' | 'low' }) {
  if (variant === 'top') {
    if (pos === 1) return <span className="text-base leading-none">🥇</span>;
    if (pos === 2) return <span className="text-base leading-none">🥈</span>;
    if (pos === 3) return <span className="text-base leading-none">🥉</span>;
  }
  return (
    <span className={[
      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
      variant === 'top'
        ? 'bg-violet-500/20 text-violet-300'
        : 'bg-kp-surface border border-kp-border text-kp-gray',
    ].join(' ')}>
      {pos}
    </span>
  );
}

// ─── Fila de ranking ──────────────────────────────────────────────────────────
function RankRow({
  item, pos, max, variant,
}: {
  item: RankingItem;
  pos: number;
  max: number;
  variant: 'top' | 'low';
}) {
  const pct = max > 0 ? (item.total_unidades / max) * 100 : 0;

  const barColor = variant === 'top'
    ? pos === 1 ? 'bg-amber-400'
    : pos === 2 ? 'bg-slate-300'
    : pos === 3 ? 'bg-amber-700'
    : 'bg-violet-500'
    : item.total_unidades === 0
    ? 'bg-rose-500/60'
    : 'bg-kp-border';

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-kp-surface2 transition-colors group">
      {/* Posición */}
      <div className="w-6 flex-shrink-0 flex items-center justify-center">
        <Medalla pos={pos} variant={variant} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-kp-white truncate leading-tight">{item.nombre}</p>
        <p className="text-[10px] text-kp-gray truncate">{item.categoria}</p>
        {/* Barra */}
        <div className="mt-1.5 h-1 rounded-full bg-kp-border/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.max(pct, item.total_unidades === 0 ? 0 : 4)}%` }}
          />
        </div>
      </div>

      {/* Unidades + ingresos */}
      <div className="text-right flex-shrink-0">
        <p className={[
          'text-xs font-bold tabular-nums',
          variant === 'top' ? 'text-kp-white' : item.total_unidades === 0 ? 'text-rose-400' : 'text-kp-gray-lt',
        ].join(' ')}>
          {formatUnidades(item.total_unidades)}
        </p>
        {item.total_ingresos > 0 && (
          <p className="text-[10px] text-kp-gray tabular-nums">{formatPesos(item.total_ingresos)}</p>
        )}
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({
  title, subtitle, items, variant, emptyMsg,
}: {
  title: string;
  subtitle: string;
  items: RankingItem[];
  variant: 'top' | 'low';
  emptyMsg: string;
}) {
  const max = items[0]?.total_unidades ?? 0;

  const accentClass = variant === 'top'
    ? 'border-violet-500/30 bg-violet-500/5'
    : 'border-kp-border bg-transparent';

  const titleColor = variant === 'top' ? 'text-violet-300' : 'text-kp-gray-lt';

  return (
    <div className={`rounded-xl border ${accentClass} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-kp-border/60 flex items-center justify-between gap-2">
        <div>
          <h3 className={`text-sm font-bold uppercase tracking-wide ${titleColor}`}>{title}</h3>
          <p className="text-[10px] text-kp-gray mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xl leading-none">
          {variant === 'top' ? '📈' : '📉'}
        </span>
      </div>

      {/* Lista */}
      <div className="p-2">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-kp-gray">{emptyMsg}</p>
          </div>
        ) : (
          items.map((item, i) => (
            <RankRow
              key={item.id}
              item={item}
              pos={i + 1}
              max={max}
              variant={variant}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RankingArticulos({ mes, masVendidos, menosVendidos }: Props) {
  const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);

  return (
    <section className="space-y-3">
      {/* Título de sección */}
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 bg-violet-500 rounded-full block" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-kp-gray-lt">
          Ranking de ventas
        </h3>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-kp-surface2 border border-kp-border text-kp-gray capitalize">
          {mesCapitalizado}
        </span>
      </div>

      {/* Dos paneles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Más vendidos"
          subtitle={`Top ${masVendidos.length} productos con mayor volumen`}
          items={masVendidos}
          variant="top"
          emptyMsg="Sin ventas registradas este mes."
        />
        <Panel
          title="Menos vendidos"
          subtitle={`Top ${menosVendidos.length} productos con menor movimiento`}
          items={menosVendidos}
          variant="low"
          emptyMsg="No hay artículos activos."
        />
      </div>
    </section>
  );
}
