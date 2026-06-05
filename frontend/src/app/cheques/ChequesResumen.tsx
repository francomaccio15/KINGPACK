'use client';

interface Resumen {
  recibidos_en_cartera:     string;
  recibidos_por_vencer_7d:  string;
  recibidos_vencidos:       string;
  recibidos_vencidos_cant:  string;
  recibidos_rechazados_mes: string;
  emitidos_comprometidos:   string;
  emitidos_por_vencer_7d:   string;
  emitidos_rechazados_cant: string;
  emitidos_rechazados_monto: string;
}

function fmt(n: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
  alerta?: boolean;
  positivo?: boolean;
}

function Card({ label, value, sub, alerta, positivo }: CardProps) {
  return (
    <div className={[
      'rounded-xl border p-4 space-y-1',
      alerta
        ? 'bg-red-950/40 border-red-800/50'
        : positivo
          ? 'bg-emerald-950/40 border-emerald-800/50'
          : 'bg-kp-surface border-kp-border',
    ].join(' ')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-kp-gray">{label}</p>
      <p className={[
        'text-2xl font-bold',
        alerta ? 'text-red-400' : positivo ? 'text-emerald-400' : 'text-kp-white',
      ].join(' ')}>{value}</p>
      {sub && <p className="text-xs text-kp-gray">{sub}</p>}
    </div>
  );
}

export default function ChequesResumen({ resumen }: { resumen: Resumen }) {
  const vencidosCant = parseInt(resumen.recibidos_vencidos_cant);
  const rechazadosCant = parseInt(resumen.emitidos_rechazados_cant);

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Recibidos</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          label="En cartera"
          value={fmt(resumen.recibidos_en_cartera)}
        />
        <Card
          label="Por vencer en 7 días"
          value={fmt(resumen.recibidos_por_vencer_7d)}
          alerta={parseFloat(resumen.recibidos_por_vencer_7d) > 0}
        />
        <Card
          label="Vencidos sin depositar"
          value={fmt(resumen.recibidos_vencidos)}
          sub={vencidosCant > 0 ? `${vencidosCant} cheque${vencidosCant > 1 ? 's' : ''}` : undefined}
          alerta={vencidosCant > 0}
        />
        <Card
          label="Rechazados este mes"
          value={fmt(resumen.recibidos_rechazados_mes)}
          alerta={parseFloat(resumen.recibidos_rechazados_mes) > 0}
        />
      </div>

      <p className="text-xs font-bold uppercase tracking-widest text-kp-gray pt-2">Emitidos</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          label="Comprometidos"
          value={fmt(resumen.emitidos_comprometidos)}
        />
        <Card
          label="A vencer en 7 días"
          value={fmt(resumen.emitidos_por_vencer_7d)}
          alerta={parseFloat(resumen.emitidos_por_vencer_7d) > 0}
        />
        <Card
          label="Rechazados (propios)"
          value={rechazadosCant > 0 ? fmt(resumen.emitidos_rechazados_monto) : '$0'}
          sub={rechazadosCant > 0 ? `${rechazadosCant} sin resolver — CRÍTICO` : 'Sin rechazos'}
          alerta={rechazadosCant > 0}
          positivo={rechazadosCant === 0}
        />
        <div /> {/* espacio libre */}
      </div>
    </div>
  );
}
